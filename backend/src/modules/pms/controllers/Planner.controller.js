/**
 * Project Planner / Master Plan controller
 * --------------------------------------------------------------
 * Composes Task + Drawing + ApprovalGate + Project.clientApprovals into a
 * single master-sheet payload. Does NOT introduce parallel approval state —
 * status transitions go through existing Task/Drawing controllers.
 */
const mongoose = require("mongoose");

const Task        = require("../models/Task.model");
const Drawing     = require("../models/Drawing.model");
const Project     = require("../models/Project.model");
const ProjectPlan = require("../models/ProjectPlan.model");
const WorkflowTemplate = require("../models/WorkflowTemplate.model");
const User        = require("../../auth/models/user.model");
const ApprovalGate = (() => {
  try { return require("../models/ApprovalGate.model"); }
  catch { return null; }
})();
const TaskDependency = (() => {
  try { return require("../models/TaskDependency.model"); }
  catch { return null; }
})();
const workflowEngine = require("../services/workflowEngine");
const scheduleEngine = require("../services/scheduleEngine");
const { DAY_MS, dayDiff, recomputePlanTotals } = require("../services/plannerHelpers");

const { logActivity } = require("../../../shared/activityLogger");
const { dispatch: notify } = require("../../notifications/services/notificationDispatcher");
const { dispatchTaskNotifications } = require("../services/taskNotifier");
const {
  createRowSchema,
  patchRowSchema,
  bulkPatchSchema,
  bulkAssignSchema,
  bulkDatesSchema,
  masterQuerySchema,
  phaseCreateSchema,
  phaseRenameSchema,
  phaseDeleteSchema,
  phaseBudgetSchema,
  settingsPatchSchema,
} = require("../validator/Planner.validator");

// DAY_MS / dayDiff / recomputePlanTotals are imported from services/plannerHelpers
// so the scheduling engine and this controller share one implementation.

const isOid = (v) => mongoose.Types.ObjectId.isValid(String(v));
// Case-insensitive phase-name comparison key
const phaseKey = (s) => String(s || "").trim().toLowerCase();

// ---- Internal helpers ---------------------------------------------------

async function getOrCreatePlan(projectId, actorId) {
  let plan = await ProjectPlan.findOne({ projectId }).lean();
  if (plan) return plan;
  plan = await ProjectPlan.findOneAndUpdate(
    { projectId },
    { $setOnInsert: { projectId, createdBy: actorId } },
    { upsert: true, new: true }
  ).lean();
  return plan;
}

/**
 * Post-activation safety net — when a designer is changed (or first assigned)
 * via the Master Sheet AFTER the plan is effective, notify the new owner so
 * they don't get a silent task drop. Reuses the channels the manager picked
 * during activation. No-op when the plan is still in draft (effectiveAt null).
 *
 * Best-effort: failures are logged, never thrown.
 */
async function notifyTaskDelegation({ task, projectId, actorId, actorName }) {
  try {
    if (!task?.assignedTo) return;
    const plan = await ProjectPlan.findOne({ projectId })
      .select("effectiveAt effectiveNotifyChannels")
      .lean();
    if (!plan?.effectiveAt) return; // plan still in draft → planner edits stay silent

    const project = await Project.findById(projectId).select("name trackingId").lean();
    if (!project) return;

    const assignedUser = await User.findById(task.assignedTo).select("_id name email phone").lean();
    if (!assignedUser) return;

    const notifyMail     = !!plan.effectiveNotifyChannels?.mail;
    const notifyWhatsApp = !!plan.effectiveNotifyChannels?.whatsapp;

    notify({
      type: "task.assigned",
      module: "pms",
      priority: "high",
      title: `New task assigned: ${task.title}`,
      message: `Project: ${project.name}${task.dueDate ? ` · Due ${new Date(task.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}` : ""}`,
      link: `/tasks/${task._id}`,
      recipients: [task.assignedTo],
      actor: actorId ? { _id: actorId, name: actorName } : undefined,
      relatedTo: { module: "pms", recordId: task._id },
      metadata: { taskTitle: task.title, projectName: project.name, viaPlannerReassign: true },
    });

    if (notifyMail || notifyWhatsApp) {
      await dispatchTaskNotifications({
        task,
        project,
        assignedUser,
        actorId,
        notifyMail,
        notifyWhatsApp,
      });
    }

    // Stamp delegatedAt so the activation preview / counters stay correct
    await Task.updateOne({ _id: task._id }, { $set: { delegatedAt: new Date() } });
  } catch (e) {
    console.error("[Planner.notifyTaskDelegation]", e.message);
  }
}

/** Derive planner-displayed stage from Task + Drawing state. */
function deriveStage(task, latestDrawing) {
  if (task.status === "completed") return "Completed";
  if (task.status === "on_hold")   return "On Hold";
  if (latestDrawing?.status === "released_to_site") return "Released to Site";
  if (task.status === "pending_client_approval")    return "Pending Client Approval";
  if (latestDrawing?.status === "approved")         return "Approved Internally";
  if (task.status === "revision_requested" || latestDrawing?.status === "rejected") return "Revision Required";
  if (task.status === "pending_review" || latestDrawing?.status === "sent_for_approval") return "Submitted for Review";
  if (task.status === "in_progress") return "In Progress";
  if (task.status === "blocked" || task.gateStatus === "open") return "Blocked";
  if (latestDrawing) return "Not Started";
  return "Draft";
}

function computeDelayDays(task) {
  const end = task?.planning?.plannedEndDate;
  if (!end) return 0;
  if (["completed", "on_hold"].includes(task.status)) return 0;
  const diff = dayDiff(Date.now(), end);
  return diff > 0 ? diff : 0;
}

/**
 * Lazy-backfill `phase` (and `templateTaskKey` when derivable) on tasks that
 * predate the schema field. Runs the FIRST time an old project's master sheet
 * is opened — afterwards every row already has phase saved, so it's a no-op.
 *
 * Matching strategy, in order of preference:
 *   1. existing task.templateTaskKey  →  template.phases keyToPhase lookup
 *   2. case-insensitive trimmed task.title  →  template.tasks titleToKey
 *
 * Tasks added manually via "Add Drawing Row" won't match a template entry and
 * stay phase-less (rendered under the "Other" group). That's by design.
 *
 * Source of truth, in order:
 *   1. project.planSnapshot — the plan frozen on the project at seed time
 *      (includes any initiation-time customization). Using the snapshot means
 *      a later edit to the global WorkflowTemplate can NEVER re-shape an
 *      existing project's master sheet.
 *   2. live WorkflowTemplate (legacy projects seeded before snapshots existed)
 */
async function backfillTaskPhases(project, tasks) {
  const missing = tasks.filter((t) => !t.phase);
  if (!missing.length) return tasks;

  let template = null;
  if (project?.planSnapshot?.phases?.length) {
    template = project.planSnapshot;
  } else if (project?.workflowTemplateId) {
    template = await WorkflowTemplate.findById(project.workflowTemplateId).lean();
  }
  if (!template) return tasks;

  const keyToPhase = new Map();
  for (const p of template.phases || []) {
    for (const k of (p.taskKeys || [])) {
      if (k) keyToPhase.set(k, p.name || "");
    }
  }
  const titleToKey = new Map();
  for (const t of template.tasks || []) {
    if (t.title) titleToKey.set(String(t.title).toLowerCase().trim(), t.key);
  }

  const bulkOps = [];
  for (const t of missing) {
    let key = t.templateTaskKey || null;
    if (!key && t.title) {
      key = titleToKey.get(String(t.title).toLowerCase().trim()) || null;
    }
    const phaseName = key ? keyToPhase.get(key) : null;
    if (!phaseName) continue; // no confident match — leave in "Other"

    // Patch in-memory copy so the response already reflects the phase
    t.phase = phaseName;
    if (key && !t.templateTaskKey) t.templateTaskKey = key;

    const set = { phase: phaseName };
    if (key && !t.templateTaskKey) set.templateTaskKey = key;
    bulkOps.push({ updateOne: { filter: { _id: t._id }, update: { $set: set } } });
  }

  if (bulkOps.length) {
    try { await Task.bulkWrite(bulkOps, { ordered: false }); }
    catch (e) { console.warn("[Planner.backfillTaskPhases] bulkWrite failed:", e.message); }
  }
  return tasks;
}

/** Snapshot phases sorted by order, shaped for API responses. */
function snapshotPhases(planSnapshot) {
  return (planSnapshot?.phases || [])
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((p) => ({
      name: p.name,
      order: p.order,
      startDayOffset: p.startDayOffset || 0,
      dayBudget: p.dayBudget != null ? p.dayBudget : null,
    }));
}

/**
 * Compute per-phase rollups from the project's tasks (parents + subtasks):
 * computed start/end (min/max planned dates) and progress (mean of
 * planning.progressPercent). Keyed case-insensitively by phase name.
 */
function computePhaseRollups(tasks) {
  const byPhase = new Map(); // phaseKeyLower -> { start, end, progSum, count }
  for (const t of tasks) {
    const name = (t.phase || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!byPhase.has(key)) byPhase.set(key, { start: null, end: null, progSum: 0, count: 0 });
    const agg = byPhase.get(key);
    const s = t.planning?.plannedStartDate;
    const e = t.planning?.plannedEndDate;
    if (s && (!agg.start || s < agg.start)) agg.start = s;
    if (e && (!agg.end || e > agg.end)) agg.end = e;
    agg.progSum += Number(t.planning?.progressPercent || 0);
    agg.count += 1;
  }
  const out = {};
  for (const [key, agg] of byPhase) {
    out[key] = {
      computedStart: agg.start || null,
      computedEnd: agg.end || null,
      computedDays: agg.start && agg.end ? Math.max(0, dayDiff(agg.end, agg.start)) : null,
      progressPercent: agg.count ? Math.round(agg.progSum / agg.count) : 0,
      taskCount: agg.count,
    };
  }
  return out;
}

function buildDrawingSummary(drawing) {
  if (!drawing) return null;
  return {
    _id:           drawing._id,
    status:        drawing.status,
    version:       drawing.version,
    drawingType:   drawing.drawingType,
    subCategory:   drawing.subCategory || "",
    fileName:      drawing.fileName || "",
    fileType:      drawing.fileType,
    fileUrl:       drawing.fileUrl,
    revisionsCount: 1 + (Array.isArray(drawing.revisionHistory) ? drawing.revisionHistory.length : 0),
    uploadedAt:    drawing.createdAt,
    approvalDate:  drawing.approvalDate,
    rejectedAt:    drawing.rejectedAt,
    rejectionReason: drawing.rejectionReason,
  };
}

// ---- Endpoints ----------------------------------------------------------

/**
 * GET /api/pms/planner/:projectId/master
 * Returns project header + plan totals + counters + grid rows.
 */
exports.getMasterSheet = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!isOid(projectId)) return res.status(400).json({ message: "Invalid projectId" });

    const { value: q, error: qErr } = masterQuerySchema.validate(req.query, { stripUnknown: true });
    if (qErr) return res.status(400).json({ message: qErr.message });

    const project = await Project.findById(projectId)
      .select("name trackingId phase startDate estimatedCompletionDate clientApprovals status workflowTemplateId planSnapshot settings")
      .lean();
    if (!project) return res.status(404).json({ message: "Project not found" });

    const plan = await getOrCreatePlan(projectId, req.user?._id);

    // Build task filter
    const filter = { projectId };
    if (q.zone)     filter["planning.zoneName"] = q.zone;
    if (q.floor)    filter["planning.floor"]    = q.floor;
    if (q.designer) filter.assignedTo           = q.designer;
    if (q.status)   filter.status               = q.status;
    if (q.priority) filter.priority             = q.priority;
    if (q.workStatus) filter.workStatus         = q.workStatus;
    if (q.search)   filter.title                = { $regex: q.search.trim(), $options: "i" };

    const tasks = await Task.find(filter)
      .populate({ path: "assignedTo",            select: "name email" })
      .populate({ path: "planning.designLeadId", select: "name email" })
      .populate({ path: "planning.reviewerId",   select: "name email" })
      .populate({ path: "planning.coordinatorId",select: "name email" })
      .select("+checklist")
      .sort({ subtaskOrder: 1, "planning.plannedStartDate": 1, createdAt: 1 })
      .lean();

    // Lazy backfill: pre-phase projects get phase / templateTaskKey filled in
    // from the project's plan snapshot (or, for legacy projects, the linked
    // workflow template) on first open of the master sheet.
    await backfillTaskPhases(project, tasks);

    // Drawing join — latest per task. One IN query is cheaper than N round-trips.
    const taskIds = tasks.map((t) => t._id);
    const drawingsByTask = new Map();
    if (taskIds.length) {
      const drawings = await Drawing.find({ taskId: { $in: taskIds } })
        .sort({ version: -1, createdAt: -1 })
        .select("taskId status version drawingType subCategory fileType fileName fileUrl revisionHistory createdAt approvalDate rejectedAt rejectionReason")
        .lean();
      for (const d of drawings) {
        const key = String(d.taskId);
        if (!drawingsByTask.has(key)) drawingsByTask.set(key, d);
      }
    }

    // ApprovalGate state — currentGateIds is on Project, but we read open gates fresh
    const openGates = ApprovalGate
      ? await ApprovalGate.find({ projectId, status: "open" }).select("blockedTaskIds approverType").lean()
      : [];
    const openGateTaskIds = new Set();
    for (const g of openGates) {
      for (const tid of (g.blockedTaskIds || [])) openGateTaskIds.add(String(tid));
    }

    // Client approval map (key -> status)
    const clientApprovalMap = new Map();
    for (const ca of (project.clientApprovals || [])) {
      clientApprovalMap.set(ca.type, ca.status);
    }

    // Which tasks are a prerequisite of some other task (drives "this edit will
    // shift N dependents" UX). Built once from every task's dependsOn[].
    const hasDependentsSet = new Set();
    for (const t of tasks) {
      for (const dep of (t.dependsOn || [])) hasDependentsSet.add(String(dep));
    }

    const now = new Date();
    const rows = tasks.map((t) => {
      const drawing = drawingsByTask.get(String(t._id)) || null;
      const stage   = deriveStage(t, drawing);
      const delayDays = computeDelayDays(t);
      const isDelayed = delayDays > 0 && !["Completed", "On Hold"].includes(stage);
      const blocked = openGateTaskIds.has(String(t._id)) || t.gateStatus === "open";

      const caKey = t?.planning?.clientApprovalKey;
      const clientApprovalStatus = caKey ? (clientApprovalMap.get(caKey) || null) : null;

      const plannedDays = t.planning?.plannedStartDate && t.planning?.plannedEndDate
        ? Math.max(0, dayDiff(t.planning.plannedEndDate, t.planning.plannedStartDate))
        : null;
      const actualDays = t.startDate && t.completedAt
        ? Math.max(0, dayDiff(t.completedAt, t.startDate))
        : null;

      return {
        taskId:    t._id,
        title:     t.title,
        taskType:  t.taskType,
        status:    t.status,
        // Manual per-row tracking column — independent of workflow status.
        workStatus: t.workStatus || "pending",
        stage,
        priority:  t.priority,
        assignedTo: t.assignedTo,
        delegatedAt: t.delegatedAt || null,
        checklist: Array.isArray(t.checklist)
          ? t.checklist.map((c) => ({ item: c.item, isCompleted: !!c.isCompleted, completedAt: c.completedAt || null }))
          : [],
        // Workflow phase (e.g. "kickoff" / "design") so the master-sheet UI
        // can group rows under phase headers. Empty string when unknown
        // (existing pre-phase projects or ad-hoc rows added without one).
        phase:     t.phase || "",
        templateTaskKey: t.templateTaskKey || "",
        // Template-defined offset — drives "Auto-Schedule" bulk action.
        dayOffsetFromProjectStart: t.dayOffsetFromProjectStart || 0,
        designLead: t.planning?.designLeadId  || null,
        reviewer:   t.planning?.reviewerId    || null,
        coordinator:t.planning?.coordinatorId || null,
        planning: {
          floor:    t.planning?.floor    || "",
          area:     t.planning?.area     || "",
          zoneName: t.planning?.zoneName || "",
          room:     t.planning?.room     || "",
          block:    t.planning?.block    || "",
          drawingCode: t.planning?.drawingCode || "",
          proposedDrawingType: t.planning?.proposedDrawingType || "",
          proposedSubCategory: t.planning?.proposedSubCategory || "",
          plannedStartDate: t.planning?.plannedStartDate || null,
          plannedEndDate:   t.planning?.plannedEndDate   || null,
          plannedHours:     t.planning?.plannedHours     || 0,
          bufferDays:       t.planning?.bufferDays       || 0,
          targetSubmissionDate: t.planning?.targetSubmissionDate || null,
          actualHours:      t.planning?.actualHours      || 0,
          progressPercent:  t.planning?.progressPercent  || 0,
          complexity:       t.planning?.complexity       || "medium",
          requiredInputs:   t.planning?.requiredInputs   || [],
          siteMeasurementStatus: t.planning?.siteMeasurementStatus || "not_required",
          requiresClientApproval: !!t.planning?.requiresClientApproval,
          clientApprovalKey:      t.planning?.clientApprovalKey || "",
        },
        actualStart: t.startDate   || null,
        actualEnd:   t.completedAt || null,
        plannedDays,
        actualDays,
        delayDays,
        isDelayed,
        blocked,
        gateStatus: t.gateStatus,
        delayReason: t.delayReason || "",
        notes:       t.notes || "",
        dependsOn:   t.dependsOn || [],
        drawing:     buildDrawingSummary(drawing),
        clientApprovalStatus,
        // --- Scheduling engine fields ---
        parentTaskId: t.parentTaskId || null,
        isSubtask:    !!t.isSubtask,
        subtaskOrder: t.subtaskOrder || 0,
        durationDays: t.durationDays != null
          ? t.durationDays
          : (plannedDays != null ? plannedDays : null),
        scheduleStatus:   scheduleEngine.getScheduleStatus(t, now),
        scheduleLocked:   !!t.scheduleLocked,
        autoShiftEnabled: t.autoShiftEnabled,
        calendarMode:     t.calendarMode || null,
        manualOverride:   !!(t.manualOverrideReason && t.manualOverrideReason.length),
        manualOverrideReason: t.manualOverrideReason || "",
        shiftCount:       t.shiftCount || 0,
        lastShiftedAt:    t.lastShiftedAt || null,
        hasDependents:    hasDependentsSet.has(String(t._id)),
        updatedAt: t.updatedAt,
      };
    });

    // Apply post-derivation filters (delayedOnly, category, stage)
    const filtered = rows.filter((r) => {
      if (q.delayedOnly && !r.isDelayed) return false;
      if (q.category && (r.drawing?.drawingType || r.planning.proposedDrawingType) !== q.category) return false;
      if (q.stage && r.stage !== q.stage) return false;
      return true;
    });

    // Nest subtasks under their parent (default). Subtasks are attached to
    // `parent.subtasks[]` and removed from the top level. Orphans (parent
    // filtered out or deleted) surface as top-level rows flagged `orphaned`
    // so nothing is ever hidden. nest=false returns the flat shape (back-compat).
    let responseRows = filtered;
    if (q.nest) {
      const parentIds = new Set(
        filtered.filter((r) => !r.parentTaskId).map((r) => String(r.taskId))
      );
      const childrenByParent = new Map();
      for (const r of filtered) {
        if (!r.parentTaskId) continue;
        const pid = String(r.parentTaskId);
        if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
        childrenByParent.get(pid).push(r);
      }
      responseRows = [];
      for (const r of filtered) {
        if (r.parentTaskId) {
          if (!parentIds.has(String(r.parentTaskId))) {
            responseRows.push({ ...r, orphaned: true });
          }
          continue; // otherwise attached under its parent below
        }
        const kids = childrenByParent.get(String(r.taskId)) || [];
        responseRows.push({ ...r, subtasks: kids });
      }
    }

    // Which template this project's master sheet is built from. Snapshot is
    // authoritative; legacy projects (seeded before snapshots) fall back to
    // the live template reference just to display a name.
    let templateInfo = null;
    if (project.planSnapshot?.baseTemplateId) {
      templateInfo = {
        baseTemplateId: project.planSnapshot.baseTemplateId,
        templateName:   project.planSnapshot.templateName || "",
        appliedAt:      project.planSnapshot.appliedAt || null,
        customized:     !!project.planSnapshot.customized,
      };
    } else if (project.workflowTemplateId) {
      const tpl = await WorkflowTemplate.findById(project.workflowTemplateId).select("name").lean();
      templateInfo = {
        baseTemplateId: project.workflowTemplateId,
        templateName:   tpl?.name || "",
        appliedAt:      null,
        customized:     false,
      };
    }

    // Counters
    const counters = {
      total:            rows.length,
      notStarted:       rows.filter((r) => r.stage === "Not Started" || r.stage === "Draft").length,
      inProgress:       rows.filter((r) => r.stage === "In Progress").length,
      submitted:        rows.filter((r) => r.stage === "Submitted for Review").length,
      revisionRequired: rows.filter((r) => r.stage === "Revision Required").length,
      approved:         rows.filter((r) => r.stage === "Approved Internally").length,
      released:         rows.filter((r) => r.stage === "Released to Site").length,
      completed:        rows.filter((r) => r.stage === "Completed").length,
      delayed:          rows.filter((r) => r.isDelayed).length,
      pendingClient:    rows.filter((r) => r.clientApprovalStatus === "pending").length,
      onHold:           rows.filter((r) => r.stage === "On Hold").length,
    };

    res.json({
      project: {
        _id: project._id,
        name: project.name,
        code: project.trackingId,
        phase: project.phase,
        status: project.status,
        startDate: project.startDate,
        estimatedCompletionDate: project.estimatedCompletionDate,
        settings: {
          autoShiftEnabled: !!project.settings?.autoShiftEnabled,
          calendarMode: project.settings?.calendarMode || "calendar_days",
        },
      },
      plan: {
        totalPlannedDays:  plan.totalPlannedDays,
        totalPlannedHours: plan.totalPlannedHours,
        totalActualHours:  plan.totalActualHours,
        baselineDate:      plan.baselineDate,
        deadlineOverride:  plan.deadlineOverride,
        effectiveAt:       plan.effectiveAt || null,
        effectiveBy:       plan.effectiveBy || null,
        effectiveNotifyChannels: plan.effectiveNotifyChannels || { mail: false, whatsapp: false },
      },
      template: templateInfo,
      // Snapshot phase list (sorted) so the UI can render freshly added
      // EMPTY phase groups that have no rows yet — each enriched with its
      // day budget + computed range/progress rolled up from its tasks+subtasks.
      phases: (() => {
        const rollups = computePhaseRollups(tasks);
        return snapshotPhases(project.planSnapshot).map((p) => ({
          ...p,
          ...(rollups[String(p.name || "").toLowerCase()] || {
            computedStart: null, computedEnd: null, computedDays: null, progressPercent: 0, taskCount: 0,
          }),
        }));
      })(),
      counters,
      rows: responseRows,
    });
  } catch (err) {
    console.error("[Planner.getMasterSheet]", err);
    res.status(500).json({ message: "Failed to load master sheet" });
  }
};

/** POST /api/pms/planner/:projectId/rows — create a planner row (Task) */
exports.createRow = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!isOid(projectId)) return res.status(400).json({ message: "Invalid projectId" });

    const { value, error } = createRowSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    // Baseline snapshot is set at first save
    const planning = value.planning || {};
    if (planning.plannedStartDate) planning.baselinePlannedStartDate = planning.plannedStartDate;
    if (planning.plannedEndDate)   planning.baselinePlannedEndDate   = planning.plannedEndDate;

    const task = await Task.create({
      projectId,
      title: value.title,
      taskType: value.taskType,
      assignedTo: value.assignedTo || undefined,
      priority: value.priority,
      workStatus: value.workStatus || "pending",
      notes: value.notes || "",
      dependsOn: value.dependsOn || [],
      phase: value.phase || undefined,
      planning,
    });

    await recomputePlanTotals(projectId);
    await logActivity({
      projectId, actorId: req.user?._id,
      entityType: "task", entityId: task._id,
      action: "planner.row.created",
      description: `Planner row created: ${task.title}`,
      metadata: { taskType: task.taskType },
    });

    res.status(201).json({ taskId: task._id });
  } catch (err) {
    console.error("[Planner.createRow]", err);
    res.status(500).json({ message: "Failed to create planner row" });
  }
};

/** PATCH /api/pms/planner/rows/:taskId — patch planning fields + safe top-level */
exports.patchRow = async (req, res) => {
  try {
    const { taskId } = req.params;
    if (!isOid(taskId)) return res.status(400).json({ message: "Invalid taskId" });

    const { value, error } = patchRowSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Row not found" });

    // Optimistic concurrency
    if (value.updatedAt && new Date(value.updatedAt).getTime() !== task.updatedAt.getTime()) {
      return res.status(409).json({ code: "STALE_ROW", message: "Row changed since last load", current: task });
    }

    // Snapshot previous assignee so we can detect a change AFTER save and
    // notify the new owner if the plan is already effective.
    const previousAssignee = task.assignedTo ? String(task.assignedTo) : "";

    // Top-level patchable fields (NOT status / dependsOn — those go through existing
    // controllers so workflowEngine + gateEnforcement run). workStatus is the
    // manual Master Sheet tracking column — safe to patch directly because the
    // engine never reads it.
    for (const f of ["title", "taskType", "assignedTo", "priority", "notes", "delayReason", "workStatus", "scheduleLocked"]) {
      if (value[f] !== undefined) task[f] = value[f] === "" ? "" : value[f];
    }
    // dependsOn is allowed here for planner use (Phase 1 keeps it simple; the
    // gate-enforcement middleware still blocks unmet deps at action time).
    if (value.dependsOn !== undefined) task.dependsOn = value.dependsOn;

    // Whole-checklist replacement from the master-sheet checklist modal.
    // Auto-stamps completedAt when an item is newly marked done; clears it
    // when un-marked. Order is preserved as-sent.
    if (value.checklist !== undefined) {
      const now = new Date();
      const prevByItem = new Map(
        (task.checklist || []).map((c) => [c.item, c])
      );
      task.checklist = value.checklist.map((c) => {
        const prev = prevByItem.get(c.item);
        const isCompleted = !!c.isCompleted;
        let completedAt = null;
        if (isCompleted) {
          completedAt = prev?.isCompleted && prev?.completedAt
            ? prev.completedAt
            : (c.completedAt || now);
        }
        return { item: c.item, isCompleted, completedAt };
      });
    }

    if (value.planning) {
      const p = task.planning || {};
      const incoming = value.planning;
      // Baseline lock — set once
      if (incoming.plannedStartDate && !p.baselinePlannedStartDate) {
        incoming.baselinePlannedStartDate = incoming.plannedStartDate;
      }
      if (incoming.plannedEndDate && !p.baselinePlannedEndDate) {
        incoming.baselinePlannedEndDate = incoming.plannedEndDate;
      }
      task.planning = { ...p, ...incoming };

      // Mirror zone to attached drawings so S3 folder + filters stay consistent
      if (incoming.zoneName !== undefined) {
        Drawing.updateMany({ taskId: task._id }, { $set: { zoneName: incoming.zoneName } }).catch(() => {});
      }
    }

    await task.save();
    await recomputePlanTotals(task.projectId);
    await logActivity({
      projectId: task.projectId, actorId: req.user?._id,
      entityType: "task", entityId: task._id,
      action: "planner.row.updated",
      description: `Planner row updated: ${task.title}`,
      metadata: { fields: Object.keys(value) },
    });

    // Post-activation auto-delegation: if assignedTo changed to a real user
    // AND the plan is effective, notify the new owner so they hear about it.
    const newAssignee = task.assignedTo ? String(task.assignedTo) : "";
    if (newAssignee && newAssignee !== previousAssignee) {
      await notifyTaskDelegation({
        task,
        projectId: task.projectId,
        actorId:   req.user?._id,
        actorName: req.user?.name,
      });
    }

    res.json({ taskId: task._id, updatedAt: task.updatedAt });
  } catch (err) {
    console.error("[Planner.patchRow]", err);
    res.status(500).json({ message: "Failed to update planner row" });
  }
};

/** DELETE /api/pms/planner/rows/:taskId — hard delete the Task row.
 *  Released drawings remain (their taskId is nulled) for audit. */
exports.deleteRow = async (req, res) => {
  try {
    const { taskId } = req.params;
    if (!isOid(taskId)) return res.status(400).json({ message: "Invalid taskId" });

    const task = await Task.findById(taskId).select("projectId title").lean();
    if (!task) return res.status(404).json({ message: "Row not found" });

    const released = await Drawing.exists({ taskId, status: "released_to_site" });
    if (released) {
      return res.status(409).json({
        code: "ROW_HAS_RELEASED_DRAWING",
        message: "Cannot delete a row whose drawing has been released to site.",
      });
    }

    // Subtask guard — deleting a parent would orphan its children. Refuse unless
    // the caller opts into cascade (?cascade=true), which deletes the subtasks too.
    const cascade = String(req.query.cascade || "").toLowerCase() === "true";
    const childIds = await Task.find({ parentTaskId: taskId }).select("_id").lean();
    if (childIds.length && !cascade) {
      return res.status(409).json({
        code: "ROW_HAS_SUBTASKS",
        message: `This task has ${childIds.length} subtask(s). Delete or move them first, or confirm cascade delete.`,
        subtaskCount: childIds.length,
      });
    }

    const idsToDelete = [taskId, ...childIds.map((c) => c._id)];

    // A released drawing on ANY cascaded subtask also blocks the delete.
    if (childIds.length) {
      const childReleased = await Drawing.exists({ taskId: { $in: childIds.map((c) => c._id) }, status: "released_to_site" });
      if (childReleased) {
        return res.status(409).json({
          code: "ROW_HAS_RELEASED_DRAWING",
          message: "A subtask has a drawing released to site — cannot delete.",
        });
      }
    }

    await Drawing.updateMany({ taskId: { $in: idsToDelete } }, { $unset: { taskId: 1 } });
    await Task.deleteMany({ _id: { $in: idsToDelete } });
    await recomputePlanTotals(task.projectId);
    await logActivity({
      projectId: task.projectId, actorId: req.user?._id,
      entityType: "task", entityId: taskId,
      action: "planner.row.deleted",
      description: `Planner row deleted: ${task.title}${childIds.length ? ` (+${childIds.length} subtask(s))` : ""}`,
      metadata: { cascadedSubtasks: childIds.length },
    });

    res.json({ ok: true, deleted: idsToDelete.length });
  } catch (err) {
    console.error("[Planner.deleteRow]", err);
    res.status(500).json({ message: "Failed to delete planner row" });
  }
};

/**
 * PATCH /api/pms/planner/:projectId/settings
 * Partial update of the project's scheduling settings (autoShiftEnabled +
 * calendarMode). Uses dot-path $set so each field is updated independently —
 * the rest of project.settings is never clobbered.
 */
exports.updateSettings = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!isOid(projectId)) return res.status(400).json({ message: "Invalid projectId" });

    const { value, error } = settingsPatchSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const set = {};
    if (value.autoShiftEnabled !== undefined) set["settings.autoShiftEnabled"] = value.autoShiftEnabled;
    if (value.calendarMode !== undefined)     set["settings.calendarMode"]     = value.calendarMode;
    if (!Object.keys(set).length) return res.status(400).json({ message: "No settings to update" });

    const project = await Project.findByIdAndUpdate(
      projectId,
      { $set: set },
      { new: true, runValidators: true }
    ).select("settings name").lean();
    if (!project) return res.status(404).json({ message: "Project not found" });

    await logActivity({
      projectId, actorId: req.user?._id,
      entityType: "project", entityId: projectId,
      action: "planner.settings.updated",
      description: `Scheduling settings updated`,
      metadata: set,
    }).catch(() => {});

    res.json({
      ok: true,
      settings: {
        autoShiftEnabled: !!project.settings?.autoShiftEnabled,
        calendarMode: project.settings?.calendarMode || "calendar_days",
      },
    });
  } catch (err) {
    console.error("[Planner.updateSettings]", err);
    res.status(500).json({ message: "Failed to update settings" });
  }
};

/** GET /api/pms/planner/:projectId/summary — lightweight dashboard payload */
exports.getSummary = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!isOid(projectId)) return res.status(400).json({ message: "Invalid projectId" });

    const plan = await getOrCreatePlan(projectId, req.user?._id);
    const tasks = await Task.find({ projectId })
      .select("status planning.plannedEndDate planning.plannedHours planning.actualHours planning.progressPercent")
      .lean();

    const now = Date.now();
    let delayed = 0;
    let plannedHrs = 0;
    let actualHrs  = 0;
    let progSum = 0;
    for (const t of tasks) {
      plannedHrs += Number(t.planning?.plannedHours || 0);
      actualHrs  += Number(t.planning?.actualHours  || 0);
      progSum    += Number(t.planning?.progressPercent || 0);
      const end = t.planning?.plannedEndDate;
      if (end && new Date(end).getTime() < now
          && !["completed", "on_hold"].includes(t.status)) delayed++;
    }
    res.json({
      counts: {
        total: tasks.length,
        delayed,
        completed: tasks.filter((t) => t.status === "completed").length,
      },
      hours: { planned: plannedHrs, actual: actualHrs },
      avgProgressPercent: tasks.length ? Math.round(progSum / tasks.length) : 0,
      plan: {
        totalPlannedDays:  plan.totalPlannedDays,
        totalPlannedHours: plan.totalPlannedHours,
        totalActualHours:  plan.totalActualHours,
      },
    });
  } catch (err) {
    console.error("[Planner.getSummary]", err);
    res.status(500).json({ message: "Failed to load planner summary" });
  }
};

/** POST /api/pms/planner/rows/bulk/assign */
exports.bulkAssign = async (req, res) => {
  try {
    const { value, error } = bulkAssignSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const newAssignee = String(value.assignedTo || "");

    // Fetch existing tasks so we can compute which rows actually changed owner.
    const before = await Task.find({ _id: { $in: value.taskIds } })
      .select("_id projectId title dueDate assignedTo")
      .lean();

    const changed = before.filter(
      (t) => String(t.assignedTo || "") !== newAssignee && newAssignee
    );

    const result = await Task.updateMany(
      { _id: { $in: value.taskIds } },
      { $set: { assignedTo: value.assignedTo } }
    );

    // Post-activation auto-delegation — fire per changed task (no-op if any of
    // the affected projects are still in draft state).
    for (const t of changed) {
      await notifyTaskDelegation({
        task: { _id: t._id, title: t.title, dueDate: t.dueDate, assignedTo: newAssignee, priority: t.priority, notes: t.notes },
        projectId: t.projectId,
        actorId:   req.user?._id,
        actorName: req.user?.name,
      });
    }

    res.json({
      matched: result.matchedCount,
      modified: result.modifiedCount,
      delegated: changed.length,
    });
  } catch (err) {
    console.error("[Planner.bulkAssign]", err);
    res.status(500).json({ message: "Failed to bulk assign" });
  }
};

/** POST /api/pms/planner/rows/bulk/dates */
exports.bulkDates = async (req, res) => {
  try {
    const { value, error } = bulkDatesSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    if (value.mode === "set") {
      if (new Date(value.plannedEndDate) < new Date(value.plannedStartDate)) {
        return res.status(422).json({ message: "Planned end cannot be before planned start" });
      }
      const result = await Task.updateMany(
        { _id: { $in: value.taskIds } },
        { $set: {
            "planning.plannedStartDate": value.plannedStartDate,
            "planning.plannedEndDate":   value.plannedEndDate,
        }}
      );
      return res.json({ matched: result.matchedCount, modified: result.modifiedCount });
    }

    // Shift mode — read & rewrite (Mongo can't do per-doc arithmetic on dates easily without an aggregation pipeline)
    const ms = value.shiftDays * DAY_MS;
    const tasks = await Task.find({ _id: { $in: value.taskIds } })
      .select("planning.plannedStartDate planning.plannedEndDate")
      .lean();
    const ops = [];
    for (const t of tasks) {
      const set = {};
      if (t.planning?.plannedStartDate)
        set["planning.plannedStartDate"] = new Date(new Date(t.planning.plannedStartDate).getTime() + ms);
      if (t.planning?.plannedEndDate)
        set["planning.plannedEndDate"] = new Date(new Date(t.planning.plannedEndDate).getTime() + ms);
      if (Object.keys(set).length) ops.push({ updateOne: { filter: { _id: t._id }, update: { $set: set } } });
    }
    if (ops.length) await Task.bulkWrite(ops);
    res.json({ modified: ops.length });
  } catch (err) {
    console.error("[Planner.bulkDates]", err);
    res.status(500).json({ message: "Failed to bulk update dates" });
  }
};

/** POST /api/pms/planner/:projectId/baseline — freeze planned dates as baseline */
exports.freezeBaseline = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!isOid(projectId)) return res.status(400).json({ message: "Invalid projectId" });

    const tasks = await Task.find({ projectId })
      .select("planning.plannedStartDate planning.plannedEndDate")
      .lean();
    const ops = [];
    for (const t of tasks) {
      ops.push({
        updateOne: {
          filter: { _id: t._id },
          update: { $set: {
            "planning.baselinePlannedStartDate": t.planning?.plannedStartDate || null,
            "planning.baselinePlannedEndDate":   t.planning?.plannedEndDate   || null,
          }},
        },
      });
    }
    if (ops.length) await Task.bulkWrite(ops);
    await ProjectPlan.updateOne(
      { projectId },
      { $set: { baselineDate: new Date(), updatedBy: req.user?._id } },
      { upsert: true }
    );
    res.json({ frozen: ops.length });
  } catch (err) {
    console.error("[Planner.freezeBaseline]", err);
    res.status(500).json({ message: "Failed to freeze baseline" });
  }
};

/**
 * POST /api/pms/planner/:projectId/auto-schedule
 *
 * Bulk-fills planned dates from the template-defined dayOffsetFromProjectStart.
 * For each task:
 *   plannedStartDate = projectStart + dayOffsetFromProjectStart days
 *   plannedEndDate   = plannedStartDate + defaultDurationDays days (3 by default)
 *
 * Modes (body):
 *   - { defaultDurationDays?: number = 3 } — duration applied to every task
 *   - { overwriteExisting?: boolean = false } — when false (default), tasks
 *     that already have plannedStartDate are skipped, so a re-click doesn't
 *     destroy hand-tuned dates.
 */
exports.autoSchedule = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!isOid(projectId)) return res.status(400).json({ message: "Invalid projectId" });

    const defaultDurationDays = Math.max(0, Math.min(365, Number(req.body?.defaultDurationDays ?? 3)));
    const overwriteExisting   = Boolean(req.body?.overwriteExisting);

    const project = await Project.findById(projectId).select("startDate").lean();
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!project.startDate) {
      return res.status(422).json({ message: "Project has no start date — set one before auto-scheduling." });
    }

    const tasks = await Task.find({ projectId })
      .select("dayOffsetFromProjectStart planning.plannedStartDate planning.plannedEndDate planning.baselinePlannedStartDate planning.baselinePlannedEndDate")
      .lean();

    const baseTs = new Date(project.startDate).getTime();
    const ops = [];
    let scheduled = 0;
    let skipped   = 0;

    for (const t of tasks) {
      if (!overwriteExisting && t.planning?.plannedStartDate) {
        skipped++;
        continue;
      }
      const offsetDays = Number(t.dayOffsetFromProjectStart || 0);
      const start = new Date(baseTs + offsetDays * DAY_MS);
      const end   = new Date(start.getTime() + defaultDurationDays * DAY_MS);

      const set = {
        "planning.plannedStartDate": start,
        "planning.plannedEndDate":   end,
      };
      // Snapshot baseline on first set (mirrors patchRow behaviour)
      if (!t.planning?.baselinePlannedStartDate) set["planning.baselinePlannedStartDate"] = start;
      if (!t.planning?.baselinePlannedEndDate)   set["planning.baselinePlannedEndDate"]   = end;

      ops.push({ updateOne: { filter: { _id: t._id }, update: { $set: set } } });
      scheduled++;
    }

    if (ops.length) await Task.bulkWrite(ops);
    await recomputePlanTotals(projectId);
    await logActivity({
      projectId, actorId: req.user?._id,
      entityType: "project", entityId: projectId,
      action: "planner.auto_scheduled",
      description: `Auto-scheduled ${scheduled} task(s) from project start ${new Date(project.startDate).toISOString().slice(0,10)}`,
      metadata: { scheduled, skipped, defaultDurationDays, overwriteExisting },
    });

    res.json({ scheduled, skipped, total: tasks.length });
  } catch (err) {
    console.error("[Planner.autoSchedule]", err);
    res.status(500).json({ message: "Failed to auto-schedule" });
  }
};

/**
 * GET /api/pms/planner/:projectId/activation-preview
 *
 * Lightweight read used by the "Make Plan Effective" confirmation modal so
 * the UI can show what's about to happen before the user commits:
 *   { toDelegate, alreadyDelegated, withoutAssignee, total, uniqueAssignees }
 */
exports.getActivationPreview = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!isOid(projectId)) return res.status(400).json({ message: "Invalid projectId" });

    const plan = await ProjectPlan.findOne({ projectId })
      .select("effectiveAt effectiveBy effectiveNotifyChannels")
      .lean();

    const tasks = await Task.find({ projectId })
      .select("assignedTo delegatedAt")
      .lean();

    const assignees = new Set();
    let toDelegate = 0;
    let alreadyDelegated = 0;
    let withoutAssignee = 0;

    for (const t of tasks) {
      if (!t.assignedTo) { withoutAssignee++; continue; }
      assignees.add(String(t.assignedTo));
      if (t.delegatedAt) alreadyDelegated++;
      else toDelegate++;
    }

    res.json({
      total:            tasks.length,
      toDelegate,
      alreadyDelegated,
      withoutAssignee,
      uniqueAssignees:  assignees.size,
      alreadyEffective: !!plan?.effectiveAt,
      effectiveAt:      plan?.effectiveAt || null,
    });
  } catch (err) {
    console.error("[Planner.getActivationPreview]", err);
    res.status(500).json({ message: "Failed to load activation preview" });
  }
};

/**
 * POST /api/pms/planner/:projectId/activate
 *
 * "Make Plan Effective" — commits the draft project plan by notifying every
 * assignee that hasn't been notified yet, then locking the plan with an
 * effectiveAt stamp. Re-activation is blocked once set.
 *
 * Body:
 *   { notifyMail?: boolean, notifyWhatsApp?: boolean }
 *
 * Side-effects:
 *   - In-app `task.assigned` for each (assignee, task) pair not yet delegated
 *   - Optional mail + WhatsApp via dispatchTaskNotifications
 *   - task.delegatedAt = now (so a second activate is a no-op for these tasks)
 *   - plan.effectiveAt / effectiveBy / effectiveNotifyChannels set
 */
exports.activatePlan = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!isOid(projectId)) return res.status(400).json({ message: "Invalid projectId" });

    const notifyMail     = Boolean(req.body?.notifyMail);
    const notifyWhatsApp = Boolean(req.body?.notifyWhatsApp);

    const project = await Project.findById(projectId)
      .select("name trackingId")
      .lean();
    if (!project) return res.status(404).json({ message: "Project not found" });

    const plan = await getOrCreatePlan(projectId, req.user?._id);
    if (plan.effectiveAt) {
      return res.status(409).json({
        code: "PLAN_ALREADY_EFFECTIVE",
        message: `This plan was already activated on ${new Date(plan.effectiveAt).toLocaleDateString("en-IN")}.`,
        effectiveAt: plan.effectiveAt,
      });
    }

    // Pull every task that has an assignee and hasn't been delegated yet.
    const tasks = await Task.find({
      projectId,
      assignedTo: { $exists: true, $ne: null },
      $or: [{ delegatedAt: { $exists: false } }, { delegatedAt: null }],
    })
      .select("_id title priority dueDate notes assignedTo")
      .lean();

    if (!tasks.length) {
      return res.status(422).json({
        code: "NOTHING_TO_DELEGATE",
        message: "No tasks have an assignee — assign team members before activating the plan.",
      });
    }

    // Batch-load assignee user docs (one query, not N).
    const userIds = [...new Set(tasks.map((t) => String(t.assignedTo)))];
    const users = await User.find({ _id: { $in: userIds } })
      .select("_id name email phone")
      .lean();
    const userById = new Map(users.map((u) => [String(u._id), u]));

    let notifiedCount = 0;
    const channelStats = { mail: { sent: 0, skipped: 0 }, whatsapp: { sent: 0, skipped: 0 } };
    const delegatedTaskIds = [];

    // Sequential per task — keeps mail/WhatsApp rate-limits sane. Volume per
    // project is small (typically <50 tasks) so this is fine.
    for (const task of tasks) {
      const assignedUser = userById.get(String(task.assignedTo));
      if (!assignedUser) continue;

      // In-app — always fire (cheap, async).
      notify({
        type: "task.assigned",
        module: "pms",
        priority: "high",
        title: `New task assigned: ${task.title}`,
        message: `Project: ${project.name}${task.dueDate ? ` · Due ${new Date(task.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}` : ""}`,
        link: `/tasks/${task._id}`,
        recipients: [task.assignedTo],
        actor: req.user ? { _id: req.user._id, name: req.user.name } : undefined,
        relatedTo: { module: "pms", recordId: task._id },
        metadata: { taskTitle: task.title, projectName: project.name, viaPlanActivation: true },
      });

      // Mail + WhatsApp — opt-in per activation.
      if (notifyMail || notifyWhatsApp) {
        const r = await dispatchTaskNotifications({
          task,
          project,
          assignedUser,
          actorId: req.user?._id,
          notifyMail,
          notifyWhatsApp,
        });
        if (notifyMail)     r.mail?.sent     ? channelStats.mail.sent++     : channelStats.mail.skipped++;
        if (notifyWhatsApp) r.whatsapp?.sent ? channelStats.whatsapp.sent++ : channelStats.whatsapp.skipped++;
      }

      delegatedTaskIds.push(task._id);
      notifiedCount++;
    }

    // Stamp delegatedAt on the tasks we just notified
    if (delegatedTaskIds.length) {
      const now = new Date();
      await Task.updateMany(
        { _id: { $in: delegatedTaskIds } },
        { $set: { delegatedAt: now } }
      );
    }

    // Lock the plan
    const effectiveAt = new Date();
    await ProjectPlan.updateOne(
      { projectId },
      {
        $set: {
          effectiveAt,
          effectiveBy: req.user?._id,
          effectiveNotifyChannels: { mail: notifyMail, whatsapp: notifyWhatsApp },
          updatedBy: req.user?._id,
        },
      },
      { upsert: true }
    );

    await logActivity({
      projectId, actorId: req.user?._id,
      entityType: "project", entityId: projectId,
      action: "planner.activated",
      description: `Plan activated — ${notifiedCount} task(s) delegated to ${userIds.length} team member(s)`,
      metadata: {
        notified: notifiedCount,
        uniqueAssignees: userIds.length,
        channels: { inApp: true, mail: notifyMail, whatsapp: notifyWhatsApp },
        channelStats,
      },
    });

    res.json({
      ok: true,
      effectiveAt,
      notified: notifiedCount,
      uniqueAssignees: userIds.length,
      channelStats,
    });
  } catch (err) {
    console.error("[Planner.activatePlan]", err);
    res.status(500).json({ message: "Failed to activate plan" });
  }
};

/**
 * POST /api/pms/planner/:projectId/change-template
 *
 * Switch THIS project's master sheet to a different workflow template.
 * Project-specific only — the global default template and other projects are
 * never touched.
 *
 * Body: { templateId }
 *
 * What it does:
 *   1. Deletes the rows that came from the OLD template (templateTaskKey set).
 *      Ad-hoc rows added via "Add Drawing Row" are kept.
 *   2. Clears the seed lock (workflowTemplateId + planSnapshot) and re-seeds
 *      from the new template, which also writes a fresh planSnapshot.
 *
 * Refused when the change would destroy real work:
 *   - plan already effective (locked)
 *   - any template-seeded task has started / logged hours
 *   - any template-seeded task has drawings attached
 */
exports.changeTemplate = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { templateId } = req.body || {};
    if (!isOid(projectId))  return res.status(400).json({ message: "Invalid projectId" });
    if (!isOid(templateId)) return res.status(400).json({ message: "Invalid templateId" });

    const project = await Project.findById(projectId)
      .select("name trackingId workflowTemplateId planSnapshot")
      .lean();
    if (!project) return res.status(404).json({ message: "Project not found" });

    const template = await WorkflowTemplate.findOne({ _id: templateId, isActive: true })
      .select("_id name")
      .lean();
    if (!template) {
      return res.status(404).json({ message: "Workflow template not found or inactive" });
    }

    const currentTemplateId = project.planSnapshot?.baseTemplateId || project.workflowTemplateId;
    if (currentTemplateId && String(currentTemplateId) === String(templateId)) {
      return res.status(409).json({
        code: "TEMPLATE_UNCHANGED",
        message: "This project already uses that template.",
      });
    }

    const plan = await ProjectPlan.findOne({ projectId }).select("effectiveAt").lean();
    if (plan?.effectiveAt) {
      return res.status(409).json({
        code: "PLAN_ALREADY_EFFECTIVE",
        message: "The plan is already effective — the template can no longer be changed.",
      });
    }

    // Rows spawned by the current template. Ad-hoc rows have no templateTaskKey
    // and survive the switch untouched.
    const seededTasks = await Task.find({
      projectId,
      templateTaskKey: { $exists: true, $nin: [null, ""] },
    })
      .select("_id status planning.actualHours")
      .lean();

    const startedCount = seededTasks.filter(
      (t) => !["not_started", "blocked"].includes(t.status)
          || Number(t.planning?.actualHours || 0) > 0
    ).length;
    if (startedCount > 0) {
      return res.status(409).json({
        code: "TEMPLATE_TASKS_IN_PROGRESS",
        message: `${startedCount} task(s) from the current template already have work in progress. Changing the template would delete that work.`,
      });
    }

    const seededIds = seededTasks.map((t) => t._id);
    if (seededIds.length && await Drawing.exists({ taskId: { $in: seededIds } })) {
      return res.status(409).json({
        code: "TEMPLATE_TASKS_HAVE_DRAWINGS",
        message: "Drawings are already attached to template tasks — the template can no longer be changed.",
      });
    }

    // Tear down the old template's artifacts (gates + deps only ever come
    // from seeding, so a project-wide delete is safe here).
    if (TaskDependency) await TaskDependency.deleteMany({ projectId });
    if (ApprovalGate)   await ApprovalGate.deleteMany({ projectId });
    if (seededIds.length) await Task.deleteMany({ _id: { $in: seededIds } });

    // Clear the seed lock so seedProject runs again with the new template.
    await Project.updateOne(
      { _id: projectId },
      { $set: { currentGateIds: [] }, $unset: { workflowTemplateId: 1, planSnapshot: 1 } }
    );

    const summary = await workflowEngine.seedProject(projectId, {
      templateId,
      actorId: req.user?._id,
    });
    if (summary.skipped) {
      // Template disappeared between validation and seeding — surface loudly
      // instead of leaving the project with an empty master sheet.
      return res.status(422).json({
        code: "RESEED_FAILED",
        message: "Could not rebuild the master sheet from the selected template. Please refresh and try again.",
      });
    }
    await recomputePlanTotals(projectId);

    await logActivity({
      projectId, actorId: req.user?._id,
      entityType: "project", entityId: projectId,
      action: "planner.template_changed",
      description: `Master sheet template changed to "${template.name}" — ${seededIds.length} old row(s) replaced by ${summary.tasksCreated} new row(s)`,
      metadata: { templateId, templateName: template.name, removedTasks: seededIds.length, tasksCreated: summary.tasksCreated },
    });

    res.json({
      ok: true,
      removedTasks: seededIds.length,
      tasksCreated: summary.tasksCreated,
      templateId:   summary.templateId,
      templateName: template.name,
    });
  } catch (err) {
    console.error("[Planner.changeTemplate]", err);
    res.status(500).json({ message: "Failed to change master sheet template" });
  }
};

/**
 * POST /api/pms/planner/:projectId/phases
 *
 * Add an empty phase to THIS project's plan snapshot. Rows are attached later
 * by creating/moving tasks with the new phase label — the global template is
 * never touched.
 */
exports.addPhase = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!isOid(projectId)) return res.status(400).json({ message: "Invalid projectId" });

    const { value, error } = phaseCreateSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const project = await Project.findById(projectId).select("name planSnapshot");
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!project.planSnapshot || !Array.isArray(project.planSnapshot.phases) || !project.planSnapshot.phases.length) {
      return res.status(409).json({ code: "NO_TEMPLATE_APPLIED", message: "Select a template before managing phases." });
    }

    const name = value.name;
    const duplicate = project.planSnapshot.phases.some((p) => phaseKey(p.name) === phaseKey(name));
    if (duplicate) {
      return res.status(409).json({ code: "PHASE_EXISTS", message: `A phase named "${name}" already exists.` });
    }

    const maxOrder = project.planSnapshot.phases.reduce((m, p) => Math.max(m, Number(p.order || 0)), 0);
    project.planSnapshot.phases.push({ name, order: maxOrder + 1, taskKeys: [] });
    project.markModified("planSnapshot");
    await project.save();

    await logActivity({
      projectId, actorId: req.user?._id,
      entityType: "project", entityId: projectId,
      action: "planner.phase.added",
      description: `Planner phase added: ${name}`,
    });

    res.json({ phases: snapshotPhases(project.planSnapshot) });
  } catch (err) {
    console.error("[Planner.addPhase]", err);
    res.status(500).json({ message: "Failed to add phase" });
  }
};

/**
 * PATCH /api/pms/planner/:projectId/phases/budget
 *
 * Set a phase's day budget (startDayOffset and/or dayBudget) on the project's
 * plan snapshot. Advisory only — does NOT move any task dates (use Recalculate
 * for that). Body: { name, startDayOffset?, dayBudget? }.
 */
exports.updatePhaseBudget = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!isOid(projectId)) return res.status(400).json({ message: "Invalid projectId" });

    const { value, error } = phaseBudgetSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const project = await Project.findById(projectId).select("name planSnapshot");
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!project.planSnapshot || !Array.isArray(project.planSnapshot.phases) || !project.planSnapshot.phases.length) {
      return res.status(409).json({ code: "NO_TEMPLATE_APPLIED", message: "Select a template before managing phases." });
    }

    const phase = project.planSnapshot.phases.find((p) => p.name === value.name)
               || project.planSnapshot.phases.find((p) => phaseKey(p.name) === phaseKey(value.name));
    if (!phase) {
      return res.status(404).json({ code: "PHASE_NOT_FOUND", message: `Phase "${value.name}" not found.` });
    }

    if (value.startDayOffset !== undefined) phase.startDayOffset = value.startDayOffset;
    if (value.dayBudget !== undefined)      phase.dayBudget = value.dayBudget;
    project.markModified("planSnapshot");
    await project.save();

    await logActivity({
      projectId, actorId: req.user?._id,
      entityType: "project", entityId: projectId,
      action: "planner.phase.budget_updated",
      description: `Phase budget updated: ${phase.name}`,
      metadata: { name: phase.name, startDayOffset: phase.startDayOffset, dayBudget: phase.dayBudget },
    }).catch(() => {});

    res.json({ phases: snapshotPhases(project.planSnapshot) });
  } catch (err) {
    console.error("[Planner.updatePhaseBudget]", err);
    res.status(500).json({ message: "Failed to update phase budget" });
  }
};

/**
 * PATCH /api/pms/planner/:projectId/phases/rename
 *
 * Rename a snapshot phase and cascade the label to this project's task rows.
 * Project.phase (the enum-locked workflow stage) is NEVER touched here.
 */
exports.renamePhase = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!isOid(projectId)) return res.status(400).json({ message: "Invalid projectId" });

    const { value, error } = phaseRenameSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const project = await Project.findById(projectId).select("name planSnapshot");
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!project.planSnapshot || !Array.isArray(project.planSnapshot.phases) || !project.planSnapshot.phases.length) {
      return res.status(409).json({ code: "NO_TEMPLATE_APPLIED", message: "Select a template before managing phases." });
    }

    const { from, to } = value;
    // Exact name match first, case-insensitive fallback second
    const phase = project.planSnapshot.phases.find((p) => p.name === from)
               || project.planSnapshot.phases.find((p) => phaseKey(p.name) === phaseKey(from));
    if (!phase) {
      return res.status(404).json({ code: "PHASE_NOT_FOUND", message: `Phase "${from}" not found.` });
    }

    const collision = project.planSnapshot.phases.find(
      (p) => p !== phase && phaseKey(p.name) === phaseKey(to)
    );
    if (collision) {
      return res.status(409).json({ code: "PHASE_EXISTS", message: `A phase named "${to}" already exists.` });
    }

    if (from === to) {
      // No-op rename — nothing to save or cascade
      return res.json({ phases: snapshotPhases(project.planSnapshot), tasksUpdated: 0 });
    }

    const oldExactName = phase.name;
    phase.name = to;
    project.markModified("planSnapshot");
    await project.save();

    // Cascade the label to task rows so master-sheet grouping follows.
    const r = await Task.updateMany(
      { projectId, phase: oldExactName },
      { $set: { phase: to } }
    );

    await logActivity({
      projectId, actorId: req.user?._id,
      entityType: "project", entityId: projectId,
      action: "planner.phase.renamed",
      description: `Planner phase renamed: ${oldExactName} → ${to}`,
      metadata: { from: oldExactName, to, tasksUpdated: r.modifiedCount },
    });

    res.json({ phases: snapshotPhases(project.planSnapshot), tasksUpdated: r.modifiedCount });
  } catch (err) {
    console.error("[Planner.renamePhase]", err);
    res.status(500).json({ message: "Failed to rename phase" });
  }
};

/**
 * DELETE /api/pms/planner/:projectId/phases?name=<phase>
 *
 * Remove an EMPTY snapshot phase. Refused while any task row still carries
 * the phase label — move or delete those rows first.
 */
exports.deletePhase = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!isOid(projectId)) return res.status(400).json({ message: "Invalid projectId" });

    const { value, error } = phaseDeleteSchema.validate(req.query, { stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const project = await Project.findById(projectId).select("name planSnapshot");
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!project.planSnapshot || !Array.isArray(project.planSnapshot.phases) || !project.planSnapshot.phases.length) {
      return res.status(409).json({ code: "NO_TEMPLATE_APPLIED", message: "Select a template before managing phases." });
    }

    const phases = project.planSnapshot.phases;
    const phase = phases.find((p) => p.name === value.name)
               || phases.find((p) => phaseKey(p.name) === phaseKey(value.name));
    if (!phase) {
      return res.status(404).json({ code: "PHASE_NOT_FOUND", message: `Phase "${value.name}" not found.` });
    }

    const inUse = await Task.countDocuments({ projectId, phase: phase.name });
    if (inUse > 0) {
      return res.status(409).json({
        code: "PHASE_HAS_TASKS",
        message: `${inUse} task(s) still belong to this phase — move or delete them first.`,
      });
    }

    // Drop the phase and renumber survivors contiguously (1..n) so ordering
    // stays gap-free for the UI.
    const survivors = phases
      .filter((p) => p !== phase)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    survivors.forEach((p, i) => { p.order = i + 1; });
    project.planSnapshot.phases = survivors;
    project.markModified("planSnapshot");
    await project.save();

    await logActivity({
      projectId, actorId: req.user?._id,
      entityType: "project", entityId: projectId,
      action: "planner.phase.deleted",
      description: `Planner phase deleted: ${phase.name}`,
    });

    res.json({ phases: snapshotPhases(project.planSnapshot) });
  } catch (err) {
    console.error("[Planner.deletePhase]", err);
    res.status(500).json({ message: "Failed to delete phase" });
  }
};
