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
const ApprovalGate = (() => {
  try { return require("../models/ApprovalGate.model"); }
  catch { return null; }
})();

const { logActivity } = require("../../../shared/activityLogger");
const {
  createRowSchema,
  patchRowSchema,
  bulkPatchSchema,
  bulkAssignSchema,
  bulkDatesSchema,
  masterQuerySchema,
} = require("../validator/Planner.validator");

const DAY_MS = 24 * 60 * 60 * 1000;

const isOid = (v) => mongoose.Types.ObjectId.isValid(String(v));
const dayDiff = (a, b) => {
  if (!a || !b) return null;
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / DAY_MS);
};

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

async function recomputePlanTotals(projectId) {
  const tasks = await Task.find({ projectId })
    .select("planning.plannedHours planning.actualHours planning.plannedStartDate planning.plannedEndDate")
    .lean();
  let plannedHours = 0;
  let actualHours  = 0;
  let earliest = null;
  let latest   = null;
  for (const t of tasks) {
    const p = t.planning || {};
    plannedHours += Number(p.plannedHours || 0);
    actualHours  += Number(p.actualHours || 0);
    if (p.plannedStartDate && (!earliest || p.plannedStartDate < earliest)) earliest = p.plannedStartDate;
    if (p.plannedEndDate   && (!latest   || p.plannedEndDate   > latest))   latest   = p.plannedEndDate;
  }
  const totalPlannedDays = earliest && latest ? Math.max(0, dayDiff(latest, earliest)) : 0;
  await ProjectPlan.updateOne(
    { projectId },
    { $set: { totalPlannedHours: plannedHours, totalActualHours: actualHours, totalPlannedDays } },
    { upsert: true }
  );
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

function buildDrawingSummary(drawing) {
  if (!drawing) return null;
  return {
    _id:           drawing._id,
    status:        drawing.status,
    version:       drawing.version,
    drawingType:   drawing.drawingType,
    subCategory:   drawing.subCategory || "",
    fileType:      drawing.fileType,
    fileUrl:       drawing.fileUrl,
    revisionsCount: 1 + (Array.isArray(drawing.revisionHistory) ? drawing.revisionHistory.length : 0),
    uploadedAt:    drawing.createdAt,
    approvalDate:  drawing.approvalDate,
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
      .select("name trackingId phase startDate estimatedCompletionDate clientApprovals status")
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
    if (q.search)   filter.title                = { $regex: q.search.trim(), $options: "i" };

    const tasks = await Task.find(filter)
      .populate({ path: "assignedTo",            select: "name email" })
      .populate({ path: "planning.designLeadId", select: "name email" })
      .populate({ path: "planning.reviewerId",   select: "name email" })
      .populate({ path: "planning.coordinatorId",select: "name email" })
      .sort({ "planning.plannedStartDate": 1, createdAt: 1 })
      .lean();

    // Drawing join — latest per task. One IN query is cheaper than N round-trips.
    const taskIds = tasks.map((t) => t._id);
    const drawingsByTask = new Map();
    if (taskIds.length) {
      const drawings = await Drawing.find({ taskId: { $in: taskIds } })
        .sort({ version: -1, createdAt: -1 })
        .select("taskId status version drawingType subCategory fileType fileUrl revisionHistory createdAt approvalDate rejectionReason")
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
        stage,
        priority:  t.priority,
        assignedTo: t.assignedTo,
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
      },
      plan: {
        totalPlannedDays:  plan.totalPlannedDays,
        totalPlannedHours: plan.totalPlannedHours,
        totalActualHours:  plan.totalActualHours,
        baselineDate:      plan.baselineDate,
        deadlineOverride:  plan.deadlineOverride,
      },
      counters,
      rows: filtered,
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
      notes: value.notes || "",
      dependsOn: value.dependsOn || [],
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

    // Top-level patchable fields (NOT status / dependsOn — those go through existing
    // controllers so workflowEngine + gateEnforcement run).
    for (const f of ["title", "taskType", "assignedTo", "priority", "notes", "delayReason"]) {
      if (value[f] !== undefined) task[f] = value[f] === "" ? "" : value[f];
    }
    // dependsOn is allowed here for planner use (Phase 1 keeps it simple; the
    // gate-enforcement middleware still blocks unmet deps at action time).
    if (value.dependsOn !== undefined) task.dependsOn = value.dependsOn;

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

    await Drawing.updateMany({ taskId }, { $unset: { taskId: 1 } });
    await Task.deleteOne({ _id: taskId });
    await recomputePlanTotals(task.projectId);
    await logActivity({
      projectId: task.projectId, actorId: req.user?._id,
      entityType: "task", entityId: taskId,
      action: "planner.row.deleted",
      description: `Planner row deleted: ${task.title}`,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("[Planner.deleteRow]", err);
    res.status(500).json({ message: "Failed to delete planner row" });
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

    const result = await Task.updateMany(
      { _id: { $in: value.taskIds } },
      { $set: { assignedTo: value.assignedTo } }
    );
    res.json({ matched: result.matchedCount, modified: result.modifiedCount });
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
