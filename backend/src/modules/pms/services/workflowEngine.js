/**
 * Workflow Engine — JJ Studio ERP
 *
 * Responsibilities (Phase 1):
 *  1. seedProject(projectId, templateId)  — instantiate the design task graph from a WorkflowTemplate
 *  2. closeGate(gateId, opts)             — propagate a gate closure: unblock dependent tasks, advance phase
 *  3. recomputeProjectPhase(projectId)    — derive the current phase from open gates / task statuses
 *  4. evaluateTaskAccess(taskId)          — for the UI: is this task blocked, and by what?
 *
 * Phase 2+ will add: per-vendor WA group spawning, PD review pathway, kitchen routing branch spawn,
 * progressPercent computation, scheduled reminders. Out of scope here.
 *
 * All functions are best-effort: they never throw at the controller's request flow. Errors are
 * logged and swallowed unless the caller explicitly awaits a promise that rejects.
 */

const mongoose = require("mongoose");

const Project = require("../models/Project.model");
const Task = require("../models/Task.model");
const TaskDependency = require("../models/TaskDependency.model");
const ApprovalGate = require("../models/ApprovalGate.model");
const WorkflowTemplate = require("../models/WorkflowTemplate.model");
const ChecklistTemplate = require("../models/ChecklistTemplate.model");
const Approval = require("../models/Approval.model");
const { KITCHEN_CHILDREN } = require("../validator/Task.validator");

const { logActivity } = require("../../../shared/activityLogger");

let notify = () => {};
try {
  ({ dispatch: notify } = require("../../notifications/services/notificationDispatcher"));
} catch (e) {
  // notifications module optional in dev — engine degrades to no-op.
}

const PHASE_ORDER = [
  "kickoff",
  "layout",
  "design",
  "procurement",
  "release",
  "execution",
  "handover",
];

/**
 * Resolve the active default workflow template for a project.
 * Preference: matching projectType > "Any" > first default.
 */
async function resolveDefaultTemplate(projectType) {
  const tpl =
    (await WorkflowTemplate.findOne({
      isDefault: true,
      isActive: true,
      projectType,
    }).lean()) ||
    (await WorkflowTemplate.findOne({
      isDefault: true,
      isActive: true,
      projectType: "Any",
    }).lean()) ||
    (await WorkflowTemplate.findOne({ isDefault: true, isActive: true }).lean());
  return tpl;
}

/**
 * Build the assignee ObjectId for a given teamSlot, falling back to null.
 * teamSlot values: primaryDesigner, designerB, designerC, designerD, designerE, supervisor, contractor.
 */
function resolveAssignee(project, teamSlot) {
  if (!teamSlot) return null;
  const v = project[teamSlot];
  return v && mongoose.Types.ObjectId.isValid(v) ? v : null;
}

function computeDueDate(projectStartDate, dayOffset) {
  if (!projectStartDate) return undefined;
  const due = new Date(projectStartDate);
  due.setDate(due.getDate() + (Number(dayOffset) || 0));
  return due;
}

/**
 * Snapshot a checklist template into a task.checklist[] array.
 * Falls back gracefully if no template exists for the type.
 */
async function snapshotChecklist(checklistTemplateName, taskType) {
  if (checklistTemplateName) {
    const tpl = await ChecklistTemplate.findOne({
      name: checklistTemplateName,
      isActive: true,
    }).lean();
    if (tpl?.items?.length) {
      return tpl.items
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((i) => ({ item: i.label, isCompleted: false }));
    }
  }
  // Fallback: look up by taskType default
  return ChecklistTemplate.snapshotForTaskType(taskType);
}

/**
 * seedProject — instantiate the full PDF-accurate task graph on a project.
 *
 * Idempotent: if the project already has tasks created by the engine
 * (project.workflowTemplateId set), seedProject becomes a no-op.
 *
 * @param {ObjectId|string} projectId
 * @param {Object}  opts
 * @param {ObjectId|string} [opts.templateId] — override; default = resolveDefaultTemplate
 * @param {ObjectId|string} [opts.actorId]    — for activity log + notifications
 * @returns {Promise<{ tasksCreated:number, gatesCreated:number, depsCreated:number, templateId:ObjectId }>}
 */
async function seedProject(projectId, opts = {}) {
  const project = await Project.findById(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  // Idempotency: skip if already seeded
  if (project.workflowTemplateId) {
    return {
      tasksCreated: 0,
      gatesCreated: 0,
      depsCreated: 0,
      templateId: project.workflowTemplateId,
      skipped: "already_seeded",
    };
  }

  // Pick template
  let template;
  if (opts.templateId && mongoose.Types.ObjectId.isValid(opts.templateId)) {
    template = await WorkflowTemplate.findById(opts.templateId).lean();
  } else {
    template = await resolveDefaultTemplate(project.projectType);
  }
  if (!template) {
    console.warn(
      `[workflowEngine] No default WorkflowTemplate found for project ${projectId}. Skipping seed.`
    );
    return { tasksCreated: 0, gatesCreated: 0, depsCreated: 0, templateId: null, skipped: "no_template" };
  }

  // 1. Create gates FIRST (tasks will reference them via requiresGateKeys)
  const gateKeyToDoc = new Map();
  for (const g of template.gates || []) {
    const doc = await ApprovalGate.create({
      projectId: project._id,
      workflowTemplateId: template._id,
      key: g.key,
      gateType: g.gateType,
      label: g.label,
      approverType: g.approverType,
      listensTo: g.listensTo,
      blockedActivities: g.blockedActivities || [],
      blockedTaskIds: [], // populated after tasks are made
      status: "open",
    });
    gateKeyToDoc.set(g.key, doc);
  }

  // 2. Create tasks (no dependencies wired yet)
  const taskKeyToDoc = new Map();
  for (const t of template.tasks || []) {
    const assignedTo = resolveAssignee(project, t.teamSlot);
    const dueDate = computeDueDate(project.startDate, t.dayOffsetFromProjectStart);

    const checklist = await snapshotChecklist(t.checklistTemplateName, t.taskType);

    // Tasks with prerequisite tasks OR gates start as blocked
    const hasDeps = (t.dependsOnKeys || []).length > 0;
    const hasGates = (t.requiresGateKeys || []).length > 0;
    const initialStatus = hasDeps || hasGates ? "blocked" : "not_started";
    const gateStatus = hasGates ? "open" : "none";

    const taskDoc = await Task.create({
      projectId: project._id,
      taskType: t.taskType,
      title: t.title,
      assignedTo: assignedTo || undefined,
      status: initialStatus,
      checklist,
      dueDate,
      priority: t.priority || "medium",
      notes: t.notes || "",
      dependsOn: [], // wired below
      gateStatus,
      dayOffsetFromProjectStart: t.dayOffsetFromProjectStart || 0,
      routing: t.taskType === "kitchen_drawing" ? null : undefined,
    });
    taskKeyToDoc.set(t.key, taskDoc);
  }

  // 3. Wire dependencies (TaskDependency records + Task.dependsOn cache)
  let depsCreated = 0;
  for (const t of template.tasks || []) {
    if (!t.dependsOnKeys?.length) continue;
    const toTask = taskKeyToDoc.get(t.key);
    if (!toTask) continue;
    const depIds = [];
    for (const fromKey of t.dependsOnKeys) {
      const fromTask = taskKeyToDoc.get(fromKey);
      if (!fromTask) continue;
      await TaskDependency.create({
        projectId: project._id,
        fromTaskId: fromTask._id,
        toTaskId: toTask._id,
        requiredStatus: "approved",
        hardGate: true,
        workflowTemplateId: template._id,
      });
      depIds.push(fromTask._id);
      depsCreated++;
    }
    if (depIds.length) {
      toTask.dependsOn = depIds;
      await toTask.save();
    }
  }

  // 4. Wire gate → blocked task ids (gates know which tasks they hold)
  for (const t of template.tasks || []) {
    if (!t.requiresGateKeys?.length) continue;
    const taskDoc = taskKeyToDoc.get(t.key);
    if (!taskDoc) continue;
    for (const gateKey of t.requiresGateKeys) {
      const gateDoc = gateKeyToDoc.get(gateKey);
      if (!gateDoc) continue;
      gateDoc.blockedTaskIds.push(taskDoc._id);
      await gateDoc.save();
    }
  }

  // 5. Ensure clientApprovals[] has rows for every gate that listens to one
  const wantedClientApprovals = new Set(
    (template.gates || [])
      .filter((g) => g.listensTo && (g.approverType === "client" || g.approverType === "principal_and_client"))
      .map((g) => g.listensTo)
  );
  const existingApprovalTypes = new Set((project.clientApprovals || []).map((a) => a.type));
  for (const type of wantedClientApprovals) {
    if (!existingApprovalTypes.has(type)) {
      project.clientApprovals.push({ type, status: "pending" });
    }
  }

  // 6. Update project: phase, template link, currentGateIds, initial progress
  project.workflowTemplateId = template._id;
  project.phase = (template.phases?.[0]?.name || "kickoff").toLowerCase();
  project.currentGateIds = Array.from(gateKeyToDoc.values()).map((g) => g._id);
  project.progressPercent = 0;
  await project.save();

  // 7. Activity log + notify
  try {
    if (opts.actorId) await logActivity({
      projectId: project._id,
      actorId: opts.actorId,
      entityType: "project",
      entityId: project._id,
      action: "created",
      description: `Workflow seeded from template "${template.name}" — ${taskKeyToDoc.size} tasks, ${gateKeyToDoc.size} gates, ${depsCreated} dependencies`,
      metadata: { templateId: template._id, templateName: template.name },
    });
  } catch (e) {
    console.warn("[workflowEngine] activity log failed:", e.message);
  }

  try {
    notify({
      type: "project.workflow_seeded",
      module: "pms",
      priority: "normal",
      title: `Project "${project.name}" workflow ready`,
      message: `${taskKeyToDoc.size} tasks and ${gateKeyToDoc.size} gates created from "${template.name}" template.`,
      link: `/projects/${project._id}`,
      recipients: opts.actorId ? [opts.actorId] : [],
      relatedTo: { module: "pms", recordId: project._id },
      metadata: { templateId: template._id, taskCount: taskKeyToDoc.size },
    });
  } catch (e) {
    // best-effort
  }

  return {
    tasksCreated: taskKeyToDoc.size,
    gatesCreated: gateKeyToDoc.size,
    depsCreated,
    templateId: template._id,
  };
}

/**
 * closeGate — mark a gate as closed and unblock dependent tasks.
 * Idempotent.
 *
 * @param {ObjectId|string} gateId
 * @param {Object} opts
 * @param {ObjectId|string} [opts.actorId]
 * @returns {Promise<{ tasksUnblocked:number, gateStatus:string }>}
 */
async function closeGate(gateId, opts = {}) {
  const gate = await ApprovalGate.findById(gateId);
  if (!gate) throw new Error(`Gate ${gateId} not found`);
  if (gate.status === "closed" || gate.status === "overridden") {
    return { tasksUnblocked: 0, gateStatus: gate.status, skipped: true };
  }

  gate.status = "closed";
  gate.closedAt = new Date();
  if (opts.actorId) gate.closedBy = opts.actorId;
  await gate.save();

  // Unblock dependent tasks that have no other open gates and no unmet deps
  let unblocked = 0;
  for (const taskId of gate.blockedTaskIds) {
    const access = await evaluateTaskAccess(taskId);
    if (access.canStart && access.task.status === "blocked") {
      await Task.findByIdAndUpdate(taskId, {
        status: "not_started",
        gateStatus: "closed",
      });
      unblocked++;
    } else if (!access.openGates.length) {
      // still blocked by deps but no gates — cache the gateStatus
      await Task.findByIdAndUpdate(taskId, { gateStatus: "closed" });
    }
  }

  try {
    if (opts.actorId) await logActivity({
      projectId: gate.projectId,
      actorId: opts.actorId,
      entityType: "approval",
      entityId: gate._id,
      action: "approved",
      description: `Gate "${gate.label}" closed — ${unblocked} task(s) unblocked`,
      metadata: { gateType: gate.gateType, gateKey: gate.key, tasksUnblocked: unblocked },
    });
  } catch (e) {
    // best-effort
  }

  try {
    notify({
      type: "gate.closed",
      module: "pms",
      priority: "high",
      title: `Approval gate closed: ${gate.label}`,
      message: `${unblocked} task(s) are now unblocked.`,
      link: `/projects/${gate.projectId}`,
      relatedTo: { module: "pms", recordId: gate.projectId },
      metadata: { gateId: gate._id, gateType: gate.gateType },
    });
  } catch (e) {
    // best-effort
  }

  // Phase 3a — keep progress % in sync after a gate state change
  await recomputeProjectProgress(gate.projectId);

  return { tasksUnblocked: unblocked, gateStatus: "closed" };
}

/**
 * overrideGate — PM bypass with reason. Requires tasks.override_gate permission upstream.
 */
async function overrideGate(gateId, { actorId, overrideReason }) {
  const gate = await ApprovalGate.findById(gateId);
  if (!gate) throw new Error(`Gate ${gateId} not found`);
  if (gate.status !== "open") {
    return { tasksUnblocked: 0, gateStatus: gate.status, skipped: true };
  }
  gate.status = "overridden";
  gate.overrideBy = actorId;
  gate.overrideAt = new Date();
  gate.overrideReason = overrideReason;
  await gate.save();

  // Treat override like a close for unblocking
  let unblocked = 0;
  for (const taskId of gate.blockedTaskIds) {
    const access = await evaluateTaskAccess(taskId);
    if (access.canStart && access.task.status === "blocked") {
      await Task.findByIdAndUpdate(taskId, {
        status: "not_started",
        gateStatus: "overridden",
      });
      unblocked++;
    }
  }

  try {
    if (actorId) await logActivity({
      projectId: gate.projectId,
      actorId,
      entityType: "approval",
      entityId: gate._id,
      action: "status_changed",
      description: `Gate "${gate.label}" overridden — ${unblocked} task(s) unblocked. Reason: ${overrideReason}`,
      metadata: { gateType: gate.gateType, overrideReason },
    });
  } catch (e) {
    // best-effort
  }

  try {
    notify({
      type: "gate.overridden",
      module: "pms",
      priority: "high",
      title: `Gate overridden: ${gate.label}`,
      message: `Reason: ${overrideReason}`,
      link: `/projects/${gate.projectId}`,
      relatedTo: { module: "pms", recordId: gate.projectId },
      metadata: { gateId: gate._id, overrideReason },
    });
  } catch (e) {
    // best-effort
  }

  // Phase 3a — keep progress % in sync after an override
  await recomputeProjectProgress(gate.projectId);

  return { tasksUnblocked: unblocked, gateStatus: "overridden" };
}

/**
 * evaluateTaskAccess — read-only check used by middleware + UI.
 * Returns details on what blocks a task right now.
 *
 * @param {ObjectId|string} taskId
 * @returns {Promise<{ task:Object, canStart:boolean, openGates:Array, unmetDeps:Array }>}
 */
async function evaluateTaskAccess(taskId) {
  const task = await Task.findById(taskId).lean();
  if (!task) throw new Error(`Task ${taskId} not found`);

  // Check open gates that hold this task
  const openGates = await ApprovalGate.find({
    blockedTaskIds: task._id,
    status: "open",
  })
    .select("key gateType label approverType listensTo")
    .lean();

  // Check unmet dependencies
  let unmetDeps = [];
  if (task.dependsOn?.length) {
    const prereqs = await Task.find({ _id: { $in: task.dependsOn } })
      .select("_id title status taskType")
      .lean();
    unmetDeps = prereqs.filter((p) => p.status !== "approved");
  }

  return {
    task,
    canStart: openGates.length === 0 && unmetDeps.length === 0,
    openGates,
    unmetDeps,
  };
}

/**
 * recomputeProjectPhase — advance Project.phase based on gate progress.
 * Simple heuristic v1: pick the highest-order phase from the template that
 * has at least one open gate; if all gates closed, advance to next phase.
 * Phase 2 will refine with task-completion ratios.
 */
async function recomputeProjectPhase(projectId) {
  const project = await Project.findById(projectId);
  if (!project || !project.workflowTemplateId) return null;

  const openCount = await ApprovalGate.countDocuments({
    projectId,
    status: "open",
  });

  // Very simple progression: when furniture_layout gate closes → phase=design
  const flGate = await ApprovalGate.findOne({
    projectId,
    gateType: "gate_furniture_layout",
  }).lean();
  const handoverGate = await ApprovalGate.findOne({
    projectId,
    gateType: "gate_handover",
  }).lean();

  let newPhase = project.phase;
  if (flGate && flGate.status === "open" && project.phase === "kickoff") {
    newPhase = "layout";
  } else if (flGate && flGate.status !== "open" && project.phase === "layout") {
    newPhase = "design";
  }
  if (handoverGate && handoverGate.status !== "open") {
    newPhase = "handover";
  }
  // openCount === 0 → all gates resolved; phase progression is handled by
  // Phase 3 handover module which sets execution/handover explicitly.

  if (newPhase !== project.phase) {
    project.phase = newPhase;
    await project.save();
    try {
      notify({
        type: "project.phase_changed",
        module: "pms",
        priority: "normal",
        title: `Project "${project.name}" advanced to ${newPhase}`,
        link: `/projects/${project._id}`,
        relatedTo: { module: "pms", recordId: project._id },
      });
    } catch (e) {
      // best-effort
    }
  }
  return newPhase;
}

/**
 * On Project.controller.updateClientApproval cycling to "obtained",
 * find gates that listen to that approval type and close them.
 *
 * Phase 2: respects principal_and_client hybrid gates — closes them only if
 * a matching principal_designer Approval record (status=approved) also exists.
 */
async function onClientApprovalObtained({ projectId, approvalType, actorId }) {
  const gates = await ApprovalGate.find({
    projectId,
    listensTo: approvalType,
    status: "open",
    approverType: { $in: ["client", "principal_and_client"] },
  }).select("_id approverType listensTo");

  let closed = 0;
  for (const g of gates) {
    if (g.approverType === "client") {
      await closeGate(g._id, { actorId });
      closed++;
    } else if (g.approverType === "principal_and_client") {
      const r = await tryCloseHybridGate(g._id, { actorId });
      if (r.closed) closed++;
    }
  }
  if (closed) await recomputeProjectPhase(projectId);
  return { closed };
}

/**
 * tryCloseHybridGate — close a principal_and_client gate iff BOTH approvals are recorded.
 *   - client side:   Project.clientApprovals[listensTo].status === "obtained"
 *   - PD side:       Approval.findOne({ gateId, approverType: "principal_designer", status: "approved" })
 *
 * Safe to call from either side of the approval pair.
 */
async function tryCloseHybridGate(gateId, { actorId } = {}) {
  const gate = await ApprovalGate.findById(gateId);
  if (!gate || gate.status !== "open") return { closed: false };
  if (gate.approverType !== "principal_and_client") {
    return { closed: false, reason: "not_hybrid" };
  }

  const project = await Project.findById(gate.projectId).select("clientApprovals").lean();
  const clientRow = (project?.clientApprovals || []).find((a) => a.type === gate.listensTo);
  const clientObtained = clientRow?.status === "obtained";

  const pdApproval = await Approval.findOne({
    projectId: gate.projectId,
    gateId: gate._id,
    approverType: "principal_designer",
    status: "approved",
  }).select("_id").lean();
  const pdApproved = !!pdApproval;

  if (clientObtained && pdApproved) {
    const r = await closeGate(gate._id, { actorId });
    return { closed: true, tasksUnblocked: r.tasksUnblocked };
  }
  return { closed: false, clientObtained, pdApproved };
}

/**
 * onPrincipalDesignerApprovalResponse — called by:
 *   - Approval.controller.respondToApproval (any PD Approval doc with a gateId)
 *   - PDReview endpoint after recording PD approval
 *
 * For a pure principal_designer gate (e.g. gate_pd_3d_review) — closes immediately on approve.
 * For a hybrid principal_and_client gate — defers to tryCloseHybridGate.
 */
async function onPrincipalDesignerResponse({
  projectId,
  gateId,
  approvalStatus,
  actorId,
}) {
  if (!gateId) return { closed: false, reason: "no_gate_link" };
  if (approvalStatus !== "approved") {
    // Rejection / approved_with_changes — gate stays open.
    return { closed: false, reason: "not_approved" };
  }

  const gate = await ApprovalGate.findById(gateId);
  if (!gate || gate.status !== "open") return { closed: false };

  let result;
  if (gate.approverType === "principal_designer") {
    const r = await closeGate(gate._id, { actorId });
    await recomputeProjectPhase(projectId || gate.projectId);
    result = { closed: true, tasksUnblocked: r.tasksUnblocked };
  } else if (gate.approverType === "principal_and_client") {
    result = await tryCloseHybridGate(gate._id, { actorId });
    if (result.closed) await recomputeProjectPhase(projectId || gate.projectId);
  } else {
    result = { closed: false, reason: "unsupported_gate_type" };
  }

  return result;
}

/**
 * onTaskApproved — when a Task transitions to status="approved", look at the
 * outgoing TaskDependency edges and unblock any toTask whose remaining
 * prerequisites are now satisfied and which is not held by an open gate.
 *
 * Call from Task.controller.approveTask after the task is persisted.
 */
async function onTaskApproved(taskId, { actorId } = {}) {
  const deps = await TaskDependency.find({ fromTaskId: taskId }).lean();
  let unblocked = 0;
  for (const dep of deps) {
    const access = await evaluateTaskAccess(dep.toTaskId);
    if (access.canStart && access.task.status === "blocked") {
      await Task.findByIdAndUpdate(dep.toTaskId, {
        status: "not_started",
        gateStatus: access.openGates.length === 0 ? "closed" : "open",
      });
      unblocked++;
    }
  }
  if (unblocked > 0) {
    try {
      const t = await Task.findById(taskId).select("projectId title").lean();
      notify({
        type: "task.unblocked",
        module: "pms",
        priority: "normal",
        title: `${unblocked} task(s) unblocked`,
        message: `Approval of "${t?.title}" unblocked dependents.`,
        link: t ? `/projects/${t.projectId}` : undefined,
        relatedTo: t ? { module: "pms", recordId: t.projectId } : undefined,
      });
    } catch (e) {
      // best-effort
    }
  }

  // Phase 3a — task approval is a progress signal even without unblocks
  try {
    const t = await Task.findById(taskId).select("projectId").lean();
    if (t?.projectId) await recomputeProjectProgress(t.projectId);
  } catch (e) { /* best-effort */ }

  return { unblocked };
}

/**
 * spawnKitchenChildren — Phase 2 Kitchen In-House vs Outsourced branch.
 * Idempotent — re-spawning the same routing is a no-op.
 *
 * Children inherit the parent's projectId and assignedTo, depend on the parent
 * (blocked until parent is approved), and start at parent.dayOffset + 1..N.
 *
 * @param {ObjectId|string} parentTaskId — must be a kitchen_drawing task
 * @param {"in_house"|"outsourced"} routing
 */
async function spawnKitchenChildren(parentTaskId, routing, { actorId } = {}) {
  if (!["in_house", "outsourced"].includes(routing)) {
    return { spawned: 0, reason: "invalid_routing" };
  }
  const parent = await Task.findById(parentTaskId);
  if (!parent) throw new Error(`Task ${parentTaskId} not found`);
  if (parent.taskType !== "kitchen_drawing") {
    throw new Error("spawnKitchenChildren can only run on a kitchen_drawing task");
  }

  const childDefs = KITCHEN_CHILDREN[routing];
  const wantedTypes = childDefs.map((c) => c.taskType);

  // Idempotency: if any kitchen-branch children already exist for this parent, do nothing.
  const existing = await Task.countDocuments({
    projectId: parent.projectId,
    dependsOn: parent._id,
    taskType: { $in: [...KITCHEN_CHILDREN.in_house.map((c) => c.taskType), ...KITCHEN_CHILDREN.outsourced.map((c) => c.taskType)] },
  });
  if (existing > 0) {
    return { spawned: 0, reason: "already_spawned", existing };
  }

  // Parent's gate / approval status drives initial child status.
  const parentApproved = parent.status === "approved";

  const created = [];
  for (let i = 0; i < childDefs.length; i++) {
    const def = childDefs[i];

    // Phase 3b — snapshot the matching ChecklistTemplate so children come with checklists
    const checklist = await ChecklistTemplate.snapshotForTaskType(def.taskType);

    const child = await Task.create({
      projectId: parent.projectId,
      taskType: def.taskType,
      title: def.title,
      assignedTo: parent.assignedTo || undefined,
      status: parentApproved ? "not_started" : "blocked",
      dependsOn: [parent._id],
      gateStatus: "none",
      dayOffsetFromProjectStart: (parent.dayOffsetFromProjectStart || 0) + 1 + i,
      priority: parent.priority || "medium",
      notes: `Auto-spawned by kitchen routing = ${routing}`,
      checklist,
    });
    await TaskDependency.create({
      projectId: parent.projectId,
      fromTaskId: parent._id,
      toTaskId: child._id,
      requiredStatus: "approved",
      hardGate: true,
    });
    created.push(child);
  }

  try {
    notify({
      type: "kitchen.routing_chosen",
      module: "pms",
      priority: "normal",
      title: `Kitchen routing: ${routing.replace("_", " ")}`,
      message: `${created.length} child task(s) spawned for kitchen ${routing}.`,
      link: `/projects/${parent.projectId}`,
      relatedTo: { module: "pms", recordId: parent.projectId },
      metadata: { parentTaskId: parent._id, routing, types: wantedTypes },
    });
  } catch (e) {
    // best-effort
  }

  return { spawned: created.length, children: created.map((c) => c._id) };
}

/**
 * listOpenGatesForProject — feeds the ProjectGatesTab UI.
 * Returns gates with blocking tasks populated and an aging value (days).
 */
async function listGatesForProject(projectId) {
  const gates = await ApprovalGate.find({ projectId })
    .populate("blockedTaskIds", "title taskType status assignedTo")
    .sort({ status: 1, createdAt: 1 })
    .lean();

  const project = await Project.findById(projectId).select("clientApprovals").lean();
  const now = Date.now();

  // For each hybrid gate, attach the PD approval state too
  const hybridGateIds = gates
    .filter((g) => g.approverType === "principal_and_client")
    .map((g) => g._id);
  const pdApprovalsByGate = new Map();
  if (hybridGateIds.length) {
    const docs = await Approval.find({
      projectId,
      gateId: { $in: hybridGateIds },
      approverType: "principal_designer",
    })
      .select("_id gateId status respondedAt comments")
      .lean();
    for (const d of docs) pdApprovalsByGate.set(String(d.gateId), d);
  }

  return gates.map((g) => {
    const ageingDays = Math.max(0, Math.floor((now - new Date(g.createdAt).getTime()) / 86400000));
    const clientApproval = g.listensTo
      ? (project?.clientApprovals || []).find((a) => a.type === g.listensTo) || null
      : null;
    return {
      ...g,
      ageingDays,
      clientApproval,
      pdApproval: pdApprovalsByGate.get(String(g._id)) || null,
      blockingTasks: (g.blockedTaskIds || []).map((t) => ({
        _id: t._id,
        title: t.title,
        taskType: t.taskType,
        status: t.status,
        assignedTo: t.assignedTo,
      })),
    };
  });
}

/**
 * recomputeProjectProgress — Phase 3a.
 *
 * Computes a weighted progress percentage:
 *   60% weight  — approval gates closed/overridden out of total
 *   40% weight  — tasks approved / completed / released_to_site out of total
 *
 * The weighting favours gates because they represent client-facing milestones.
 * A project with all tasks but no closed gates is "in motion but not yet validated";
 * a project with closed gates but tasks not yet approved isn't done either.
 *
 * Cached on Project.progressPercent. Safe to call from any state-change point;
 * returns the new percent (0-100). Best-effort: any failure logs and returns null.
 */
async function recomputeProjectProgress(projectId) {
  try {
    const project = await Project.findById(projectId).select("_id progressPercent");
    if (!project) return null;

    const [totalGates, doneGates, totalTasks, doneTasks] = await Promise.all([
      ApprovalGate.countDocuments({ projectId }),
      ApprovalGate.countDocuments({ projectId, status: { $in: ["closed", "overridden"] } }),
      Task.countDocuments({ projectId }),
      Task.countDocuments({
        projectId,
        status: { $in: ["approved", "released_to_site", "completed"] },
      }),
    ]);

    // Legacy / un-seeded project — no gates and no engine-seeded tasks.
    // Fall back to plain task completion % so the field is still useful.
    if (totalGates === 0 && totalTasks === 0) {
      project.progressPercent = 0;
      await project.save();
      return 0;
    }

    let percent;
    if (totalGates === 0) {
      // Legacy project: pure task completion
      percent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    } else {
      const gateRatio = totalGates > 0 ? doneGates / totalGates : 0;
      const taskRatio = totalTasks > 0 ? doneTasks / totalTasks : 0;
      percent = Math.round((gateRatio * 60 + taskRatio * 40));
    }

    percent = Math.max(0, Math.min(100, percent));
    if (project.progressPercent !== percent) {
      project.progressPercent = percent;
      await project.save();
    }
    return percent;
  } catch (err) {
    console.warn("[workflowEngine.recomputeProjectProgress]", err.message);
    return null;
  }
}

module.exports = {
  seedProject,
  closeGate,
  overrideGate,
  evaluateTaskAccess,
  recomputeProjectPhase,
  onClientApprovalObtained,
  // Phase 2
  tryCloseHybridGate,
  onPrincipalDesignerResponse,
  onTaskApproved,
  spawnKitchenChildren,
  listGatesForProject,
  // Phase 3a
  recomputeProjectProgress,
  PHASE_ORDER,
};
