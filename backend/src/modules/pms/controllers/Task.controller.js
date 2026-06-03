const Task = require("../models/Task.model");
const Project = require("../models/Project.model");
const User = require("../../auth/models/user.model");
const workflowEngine = require("../services/workflowEngine");

const WORKFLOW_ENGINE_V1 =
  String(process.env.WORKFLOW_ENGINE_V1 || "").toLowerCase() === "true";
const {
  createTaskSchema,
  updateTaskSchema,
  checklistUpdateSchema,
  submitTaskSchema,
  approveTaskSchema,
  requestRevisionSchema,
  reassignTaskSchema,
} = require("../validator/Task.validator");
const Drawing = require("../models/Drawing.model");
const ApprovalGate = require("../models/ApprovalGate.model");
const { logActivity } = require("../../../shared/activityLogger");
const mailService      = require("../../mail/service/mail.service");
const { dispatch: notify } = require("../../notifications/services/notificationDispatcher");
const whatsappService  = require("../../whatsapp/service/whatsapp.service");

/**
 * Decorate a single task or an array of tasks with `blockingTasks[]` and
 * `blockingGates[]` so the frontend BlockedByChip can show real blocker names.
 *
 * Optimised for cost:
 *   - tasks with no dependsOn AND not blocked/open-gated → decorated with empty arrays only.
 *   - all dependent Task ids batched into one find.
 *   - all gates blocking these tasks batched into one find.
 *
 * Returns the same shape it was given (single doc or array).
 */
async function decorateWithBlockers(input) {
  const isArray = Array.isArray(input);
  const tasks = isArray ? input : [input];
  if (!tasks.length) return input;

  // Normalise to plain objects so we can attach fields without touching Mongoose internals
  const plain = tasks.map((t) => (t && typeof t.toObject === "function" ? t.toObject() : t));

  // Collect prerequisite Task ids
  const prereqIds = new Set();
  for (const t of plain) {
    (t.dependsOn || []).forEach((id) => prereqIds.add(String(id)));
  }

  // Collect candidate task ids for gate lookup (only those that might be gated)
  const gateCandidateIds = plain
    .filter((t) => t && (t.status === "blocked" || t.gateStatus === "open"))
    .map((t) => t._id);

  const [prereqDocs, gateDocs] = await Promise.all([
    prereqIds.size
      ? Task.find({ _id: { $in: [...prereqIds] } })
          .select("_id title status taskType")
          .lean()
      : Promise.resolve([]),
    gateCandidateIds.length
      ? ApprovalGate.find({
          blockedTaskIds: { $in: gateCandidateIds },
          status: "open",
        })
          .select("_id key label gateType approverType listensTo blockedTaskIds")
          .lean()
      : Promise.resolve([]),
  ]);

  const prereqById = new Map(prereqDocs.map((d) => [String(d._id), d]));

  // Index gates by which task they block
  const gatesByTask = new Map();
  for (const g of gateDocs) {
    for (const tid of g.blockedTaskIds || []) {
      const k = String(tid);
      if (!gatesByTask.has(k)) gatesByTask.set(k, []);
      gatesByTask.get(k).push({
        _id: g._id,
        key: g.key,
        label: g.label,
        gateType: g.gateType,
        approverType: g.approverType,
        listensTo: g.listensTo,
      });
    }
  }

  for (const t of plain) {
    t.blockingTasks = (t.dependsOn || [])
      .map((id) => prereqById.get(String(id)))
      .filter((d) => d && d.status !== "approved");
    t.blockingGates = gatesByTask.get(String(t._id)) || [];
  }

  return isArray ? plain : plain[0];
}

// Returns { mail: { sent, reason? }, whatsapp: { sent, reason? } }
const dispatchTaskNotifications = async ({ task, project, assignedUser, actorId, notifyMail, notifyWhatsApp }) => {
  const results = {};
  const vars = {
    taskTitle:    task.title,
    projectName:  project.name,
    projectId:    project.trackingId,
    priority:     task.priority || "medium",
    dueDate:      task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-IN") : "Not set",
    notes:        task.notes || "—",
    assigneeName: assignedUser.name,
  };

  if (notifyMail) {
    if (!assignedUser.email) {
      results.mail = { sent: false, reason: "no_email" };
    } else {
      try {
        await mailService.sendImmediate({
          to:      assignedUser.email,
          subject: `Task Assigned: ${task.title} — ${project.name}`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
              <h2 style="color:#1a1a2e">Task Assigned to You</h2>
              <table style="width:100%;border-collapse:collapse">
                <tr><td style="padding:8px;font-weight:bold;color:#555">Task</td><td style="padding:8px">${vars.taskTitle}</td></tr>
                <tr style="background:#f8f8f8"><td style="padding:8px;font-weight:bold;color:#555">Project</td><td style="padding:8px">${vars.projectName} (${vars.projectId})</td></tr>
                <tr><td style="padding:8px;font-weight:bold;color:#555">Priority</td><td style="padding:8px;text-transform:capitalize">${vars.priority}</td></tr>
                <tr style="background:#f8f8f8"><td style="padding:8px;font-weight:bold;color:#555">Due Date</td><td style="padding:8px">${vars.dueDate}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;color:#555">Notes</td><td style="padding:8px">${vars.notes}</td></tr>
              </table>
              <p style="color:#888;font-size:12px;margin-top:24px">Please log in to JJ Studio ERP to view full task details.</p>
            </div>
          `,
          relatedTo: { module: "pms", recordId: task._id },
          createdBy: actorId,
        });
        results.mail = { sent: true };
      } catch (e) {
        console.error("[taskNotify:mail]", e.message);
        results.mail = { sent: false, reason: e.message };
      }
    }
  }

  if (notifyWhatsApp) {
    if (!assignedUser.phone) {
      console.warn(`[taskNotify:whatsapp] Skipped — user ${assignedUser._id} has no phone number`);
      results.whatsapp = { sent: false, reason: "no_phone" };
    } else {
      console.log(`[taskNotify:whatsapp] Sending to ${assignedUser.phone} for user ${assignedUser.name}`);
      try {
        await whatsappService.sendImmediate({
          to: assignedUser.phone,
          message:
            `*Task Assigned — JJ Studio ERP*\n\n` +
            `*Task:* ${vars.taskTitle}\n` +
            `*Project:* ${vars.projectName} (${vars.projectId})\n` +
            `*Priority:* ${vars.priority}\n` +
            `*Due Date:* ${vars.dueDate}\n` +
            `*Notes:* ${vars.notes}\n\n` +
            `Please check JJ Studio ERP for full details.`,
          relatedTo: { module: "pms", recordId: task._id },
          createdBy: actorId,
        });
        console.log(`[taskNotify:whatsapp] Sent OK to ${assignedUser.phone}`);
        results.whatsapp = { sent: true };
      } catch (e) {
        console.error("[taskNotify:whatsapp]", e.message);
        results.whatsapp = { sent: false, reason: e.message };
      }
    }
  }

  return results;
};

// Default checklists per task type — from Design Sub-Flow process documentation.
// Applied automatically when a task is created without an explicit checklist.
const DEFAULT_CHECKLISTS = {
  ac_coordination: [
    { item: "Take AC vendor number from Purchase" },
    { item: "Inform Manager to create WhatsApp group (Designer + Principal Designer + Client + AC vendor)" },
    { item: "Send AutoCAD final furniture layout to group/mail (all vendors if multiple)" },
    { item: "Understand from Principal Designer: AC type and tentative location" },
    { item: "Coordinate with vendor for drawings in group/call" },
    { item: "Send all drawings to group" },
    { item: "Close AC position drawing — get final consent from Principal Designer" },
    { item: "Get pipeline drawing based on AC unit position and get approved" },
    { item: "Ask for quotation based on final drawing" },
  ],
  technical_drawing: [
    { item: "Tentative Wall Electrical drawing complete" },
    { item: "Ceiling Electrical drawing complete" },
    { item: "IT Drawings — Camera positions marked" },
    { item: "IT Drawings — LAN / Phone / Internet points marked" },
  ],
  kitchen_drawing: [
    { item: "Layout completed and approved" },
    { item: "Concept + Moodboard prepared" },
    { item: "Basic Elevation complete" },
    { item: "All Drawings updated" },
    { item: "Appliance specifications confirmed" },
    { item: "All material details finalised" },
    { item: "Check DLR for existing drawing references" },
  ],
  bathroom_drawing: [
    { item: "Material selection confirmed (Fittings, Wall & Floor cladding)" },
    { item: "Concept pic sent to client and approved (if needed)" },
    { item: "Layout completed and approved" },
    { item: "2D drawings complete" },
    { item: "3D visualisation approved" },
    { item: "Detail working drawing complete" },
    { item: "All files uploaded to DLR" },
  ],
  furniture_layout: [
    { item: "Site measurements taken as per checklist" },
    { item: "MEP drawings received from client" },
    { item: "Furniture layout completed within deadline" },
    { item: "Layout sent to WhatsApp group for client review" },
    { item: "Client approval received" },
  ],
  civil_drawing: [
    { item: "Original Plan prepared" },
    { item: "Original door/window schedule complete" },
    { item: "Walls to be broken — marked on drawing" },
    { item: "Walls to be constructed — marked on drawing" },
    { item: "Door/window schedule updated as per furniture layout" },
  ],
  "3d_render": [
    { item: "Render created as per approved concept" },
    { item: "Sent to Principal Designer for internal review" },
    { item: "Client presentation completed" },
    { item: "Client approval received" },
    { item: "Working drawing completed post-approval" },
  ],
  concept_making: [
    { item: "Client meeting held with all style concepts presented" },
    { item: "Concept refined area-wise as per client feedback" },
    { item: "Client shortlisting meeting completed" },
    { item: "Final concept direction confirmed (3D render / 2D)" },
  ],
  automation_coordination: [
    { item: "Drawing sent to Automation vendor (EA)" },
    { item: "Quotation received and WhatsApp group created" },
    { item: "Purchase department informed" },
    { item: "Client approval obtained" },
    { item: "Designer C drawing completed and approved" },
    { item: "Drawing uploaded to DLR" },
  ],
  site_measurement: [
    { item: "Measurements taken as per civil checklist" },
    { item: "MEP drawing references collected from client" },
  ],
};

/**
 * @route POST /api/pms/task/create
 */
const createTask = async (req, res) => {
  try {
    const { error, value } = createTaskSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    // Strip notification flags — not persisted to DB
    const { notifyMail = false, notifyWhatsApp = false, ...taskData } = value;

    if (!taskData.assignedTo) delete taskData.assignedTo;

    // Inject default checklist template if none provided
    if (!taskData.checklist || taskData.checklist.length === 0) {
      const template = DEFAULT_CHECKLISTS[taskData.taskType];
      if (template) {
        taskData.checklist = template.map((t) => ({ item: t.item, isCompleted: false }));
      }
    }

    const project = await Project.findById(taskData.projectId).lean();
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const task = await Task.create(taskData);

    logActivity({
      projectId:   task.projectId,
      actorId:     req.user._id,
      entityType:  "task",
      entityId:    task._id,
      action:      "created",
      description: `Task "${task.title}" created`,
    });

    // Run notifications synchronously so results can be returned to the caller
    let notificationResults = {};
    if (taskData.assignedTo && (notifyMail || notifyWhatsApp)) {
      const assignedUser = await User.findById(taskData.assignedTo).select("name email phone").lean();
      if (assignedUser) {
        notificationResults = await dispatchTaskNotifications({
          task,
          project,
          assignedUser,
          actorId: req.user._id,
          notifyMail,
          notifyWhatsApp,
        });
      }
    }

    // In-app notification → the assigned designer
    if (task.assignedTo) {
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
        metadata: { taskTitle: task.title, projectName: project.name, dueDate: task.dueDate },
      });
    }

    res.status(201).json({
      message: "Task created successfully",
      task,
      notificationResults,
    });
  } catch (error) {
    console.error("[createTask]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/task/my-tasks
 * Must be declared before /:id to avoid route shadowing.
 */
const getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ assignedTo: req.user._id })
      .populate("projectId", "name trackingId status")
      .populate("assignedTo", "name email")
      .sort({ dueDate: 1, createdAt: -1 });

    const decorated = await decorateWithBlockers(tasks);
    res.status(200).json({ count: decorated.length, tasks: decorated });
  } catch (error) {
    console.error("[getMyTasks]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/task/project/:projectId
 */
const getTasksByProject = async (req, res) => {
  try {
    const tasks = await Task.find({ projectId: req.params.projectId })
      .populate("assignedTo", "name email")
      .populate("externalCoordination.vendorId", "name phone")
      .sort({ createdAt: 1 });

    const decorated = await decorateWithBlockers(tasks);
    res.status(200).json({ count: decorated.length, tasks: decorated });
  } catch (error) {
    console.error("[getTasksByProject]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/task/:id
 */
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("projectId", "name trackingId status")
      .populate("assignedTo", "name email")
      .populate("externalCoordination.vendorId", "name phone");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const decorated = await decorateWithBlockers(task);
    res.status(200).json({ task: decorated });
  } catch (error) {
    console.error("[getTaskById]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PUT /api/pms/task/update/:id
 * Only fields defined in updateTaskSchema can be changed.
 * Immutable fields (projectId, taskType) are never touched.
 */
const updateTask = async (req, res) => {
  try {
    const { error, value } = updateTaskSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    // Auto-set completedAt when moving to a terminal status
    if (value.status === "completed" || value.status === "released_to_site") {
      value.completedAt = new Date();
    }

    // Capture pre-update state so we can detect changes that trigger workflow side-effects.
    const before = await Task.findById(req.params.id).select("taskType routing").lean();

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    )
      .populate("assignedTo", "name email")
      .populate("externalCoordination.vendorId", "name phone");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Phase 2 — Kitchen routing branch: when a kitchen_drawing task's routing
    // is set/changed, spawn the matching child tasks (in_house or outsourced).
    // Idempotent — won't re-spawn if children already exist.
    let kitchenSpawn = null;
    if (
      WORKFLOW_ENGINE_V1 &&
      task.taskType === "kitchen_drawing" &&
      value.routing &&
      value.routing !== before?.routing
    ) {
      try {
        kitchenSpawn = await workflowEngine.spawnKitchenChildren(
          task._id,
          value.routing,
          { actorId: req.user._id }
        );
      } catch (engineErr) {
        console.error("[updateTask:spawnKitchenChildren]", engineErr);
      }
    }

    const action = value.status ? "status_changed" : "updated";
    const description = value.status
      ? `Task "${task.title}" status changed to ${value.status}`
      : `Task "${task.title}" updated`;

    logActivity({
      projectId:   task.projectId,
      actorId:     req.user._id,
      entityType:  "task",
      entityId:    task._id,
      action,
      description,
      metadata:    value.status ? { to: value.status } : undefined,
    });

    res.status(200).json({ message: "Task updated successfully", task, kitchenSpawn });
  } catch (error) {
    console.error("[updateTask]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PATCH /api/pms/task/checklist/:taskId/:itemIndex
 */
const updateChecklistStatus = async (req, res) => {
  try {
    const { error, value } = checklistUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { taskId, itemIndex } = req.params;
    const idx = Number(itemIndex);

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    if (idx < 0 || idx >= task.checklist.length) {
      return res.status(400).json({ message: "Invalid checklist item index" });
    }

    task.checklist[idx].isCompleted = value.isCompleted;
    task.checklist[idx].completedAt = value.isCompleted ? new Date() : null;

    await task.save();
    res.status(200).json({ message: "Checklist updated", task });
  } catch (error) {
    console.error("[updateChecklistStatus]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route DELETE /api/pms/task/delete/:id
 */
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("[deleteTask]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/task/review-queue
 * PM/PC/MD: all tasks currently pending_review, with designer + drawings
 */
const getReviewQueue = async (req, res) => {
  try {
    const { projectId, page = 1, limit = 30 } = req.query;
    const filter = { status: "pending_review" };
    if (projectId) filter.projectId = projectId;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Task.countDocuments(filter);

    const tasks = await Task.find(filter)
      .populate("projectId",      "name trackingId status")
      .populate("assignedTo",     "name email role")
      .populate("approvedBy",     "name")
      .populate("reassignedFrom", "name")
      .sort({ submittedAt: 1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Attach drawings (draft or sent_for_approval) per task
    const taskIds = tasks.map((t) => t._id);
    const drawings = await Drawing.find({ taskId: { $in: taskIds } })
      .select("taskId title drawingType status version fileUrl fileName uploadedBy")
      .populate("uploadedBy", "name")
      .lean();

    const drawingsByTask = drawings.reduce((acc, d) => {
      const key = String(d.taskId);
      if (!acc[key]) acc[key] = [];
      acc[key].push(d);
      return acc;
    }, {});

    const result = tasks.map((t) => ({
      ...t.toObject(),
      drawings: drawingsByTask[String(t._id)] || [],
    }));

    res.status(200).json({ total, page: Number(page), count: result.length, tasks: result });
  } catch (error) {
    console.error("[getReviewQueue]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PATCH /api/pms/task/submit/:id
 * Designer submits their task for PM/PC/MD internal review.
 * Validates: caller is the assigned designer, status is in_progress or revision_requested.
 */
const submitTask = async (req, res) => {
  try {
    const { error, value } = submitTaskSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });
    }

    const task = await Task.findById(req.params.id).populate("projectId", "name trackingId supervisor primaryDesigner");
    if (!task) return res.status(404).json({ message: "Task not found" });

    // Only the assigned designer can submit
    if (String(task.assignedTo) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only the assigned designer can submit this task" });
    }

    const allowedFromStatuses = ["in_progress", "revision_requested"];
    if (!allowedFromStatuses.includes(task.status)) {
      return res.status(400).json({
        message: `Cannot submit — task is currently "${task.status}". Must be in_progress or revision_requested.`,
      });
    }

    // Transition linked drawings from draft/rejected → sent_for_approval
    await Drawing.updateMany(
      { taskId: task._id, status: { $in: ["draft", "rejected"] } },
      { $set: { status: "sent_for_approval", submissionNotes: value.submissionNotes || "" } }
    );

    task.status          = "pending_review";
    task.submissionNotes = value.submissionNotes || "";
    task.submittedAt     = new Date();
    await task.save();

    logActivity({
      projectId:   task.projectId._id || task.projectId,
      actorId:     req.user._id,
      entityType:  "task",
      entityId:    task._id,
      action:      "status_changed",
      description: `Task "${task.title}" submitted for review`,
      metadata:    { from: "in_progress", to: "pending_review" },
    });

    // In-app notification → reviewers
    notify({
      type: "task.submitted",
      module: "pms",
      priority: "normal",
      title: `Review needed: ${task.title}`,
      message: `${task.projectId?.name || "Project"}${value.submissionNotes ? ` — ${value.submissionNotes}` : ""}`,
      link: `/tasks/${task._id}`,
      recipients: [task.projectId?.supervisor, task.projectId?.primaryDesigner].filter(Boolean),
      actor: req.user ? { _id: req.user._id, name: req.user.name } : undefined,
      relatedTo: { module: "pms", recordId: task._id },
      metadata: { taskTitle: task.title, projectName: task.projectId?.name },
    });

    // Notify reviewers (supervisor + primaryDesigner on the project) — fire-and-forget
    const project = task.projectId;
    const notifyIds = [project?.supervisor, project?.primaryDesigner].filter(Boolean);
    if (notifyIds.length > 0) {
      (async () => {
        const reviewers = await User.find({ _id: { $in: notifyIds } }).select("name email phone").lean();
        const submitter = await User.findById(req.user._id).select("name").lean();
        for (const reviewer of reviewers) {
          const subject = `Review Required: ${task.title}`;
          const html = `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
              <h2 style="color:#1a1a2e">Task Submitted for Review</h2>
              <table style="width:100%;border-collapse:collapse">
                <tr><td style="padding:8px;font-weight:bold;color:#555">Task</td><td style="padding:8px">${task.title}</td></tr>
                <tr style="background:#f8f8f8"><td style="padding:8px;font-weight:bold;color:#555">Project</td><td style="padding:8px">${project.name} (${project.trackingId})</td></tr>
                <tr><td style="padding:8px;font-weight:bold;color:#555">Submitted By</td><td style="padding:8px">${submitter?.name || "Designer"}</td></tr>
                ${value.submissionNotes ? `<tr style="background:#f8f8f8"><td style="padding:8px;font-weight:bold;color:#555">Notes</td><td style="padding:8px">${value.submissionNotes}</td></tr>` : ""}
              </table>
              <p style="color:#888;font-size:12px;margin-top:24px">Please log in to JJ Studio ERP to review.</p>
            </div>`;
          if (reviewer.email) {
            mailService.sendImmediate({ to: reviewer.email, subject, html, relatedTo: { module: "pms", recordId: task._id }, createdBy: req.user._id }).catch(() => {});
          }
          if (reviewer.phone) {
            whatsappService.sendImmediate({
              to: reviewer.phone,
              message: `*Review Required — JJ Studio ERP*\n\n*Task:* ${task.title}\n*Project:* ${project.name}\n*Submitted by:* ${submitter?.name || "Designer"}\n\nPlease check JJ Studio ERP to review.`,
              relatedTo: { module: "pms", recordId: task._id }, createdBy: req.user._id,
            }).catch(() => {});
          }
        }
      })();
    }

    const populated = await Task.findById(task._id)
      .populate("projectId", "name trackingId")
      .populate("assignedTo", "name email");

    res.status(200).json({ message: "Task submitted for review", task: populated });
  } catch (error) {
    console.error("[submitTask]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PATCH /api/pms/task/approve/:id
 * PM/PC/MD approves task — transitions to approved, auto-approves linked drawings.
 */
const approveTask = async (req, res) => {
  try {
    const { error, value } = approveTaskSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const task = await Task.findById(req.params.id).populate("projectId", "name trackingId");
    if (!task) return res.status(404).json({ message: "Task not found" });

    if (task.status !== "pending_review") {
      return res.status(400).json({ message: `Cannot approve — task status is "${task.status}", must be pending_review` });
    }

    task.status     = "approved";
    task.approvedBy = req.user._id;
    task.approvedAt = new Date();
    task.completedAt = new Date();
    if (value.remarks) task.notes = value.remarks;
    await task.save();

    // Auto-approve linked drawings that were sent_for_approval
    await Drawing.updateMany(
      { taskId: task._id, status: "sent_for_approval" },
      { $set: { status: "approved", approvedBy: req.user._id, approvalDate: new Date() } }
    );

    // Phase 2 — Workflow Engine cascade: unblock dependent tasks (e.g. kitchen children)
    let cascade = null;
    if (WORKFLOW_ENGINE_V1) {
      try {
        cascade = await workflowEngine.onTaskApproved(task._id, { actorId: req.user._id });
      } catch (engineErr) {
        console.error("[approveTask:onTaskApproved]", engineErr);
      }
    }

    logActivity({
      projectId:   task.projectId._id || task.projectId,
      actorId:     req.user._id,
      entityType:  "task",
      entityId:    task._id,
      action:      "approved",
      description: `Task "${task.title}" approved`,
      metadata:    { unblocked: cascade?.unblocked ?? 0 },
    });

    // In-app notification → the designer whose work was approved
    if (task.assignedTo) {
      notify({
        type: "task.approved",
        module: "pms",
        priority: "normal",
        title: `Task approved: ${task.title}`,
        message: `${task.projectId?.name || "Project"}${value.remarks ? ` — ${value.remarks}` : ""}`,
        link: `/tasks/${task._id}`,
        recipients: [task.assignedTo],
        actor: req.user ? { _id: req.user._id, name: req.user.name } : undefined,
        relatedTo: { module: "pms", recordId: task._id },
        metadata: { taskTitle: task.title, projectName: task.projectId?.name },
      });
    }

    // Notify designer — fire-and-forget
    if (task.assignedTo) {
      (async () => {
        const designer = await User.findById(task.assignedTo).select("name email phone").lean();
        const reviewer = req.user.name || "Your manager";
        if (!designer) return;
        if (designer.email) {
          mailService.sendImmediate({
            to: designer.email,
            subject: `Task Approved: ${task.title}`,
            html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto"><h2 style="color:#27AE60">Task Approved</h2><p>Your task <strong>${task.title}</strong> has been approved by ${reviewer}.</p>${value.remarks ? `<p><strong>Remarks:</strong> ${value.remarks}</p>` : ""}</div>`,
            relatedTo: { module: "pms", recordId: task._id }, createdBy: req.user._id,
          }).catch(() => {});
        }
        if (designer.phone) {
          whatsappService.sendImmediate({
            to: designer.phone,
            message: `*Task Approved — JJ Studio ERP*\n\n*Task:* ${task.title}\n*Approved by:* ${reviewer}${value.remarks ? `\n*Remarks:* ${value.remarks}` : ""}\n\nGreat work!`,
            relatedTo: { module: "pms", recordId: task._id }, createdBy: req.user._id,
          }).catch(() => {});
        }
      })();
    }

    const populated = await Task.findById(task._id)
      .populate("projectId", "name trackingId")
      .populate("assignedTo", "name email")
      .populate("approvedBy", "name");

    res.status(200).json({ message: "Task approved", task: populated });
  } catch (error) {
    console.error("[approveTask]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PATCH /api/pms/task/request-revision/:id
 * PM/PC/MD sends task back to designer with revision instructions.
 */
const requestRevision = async (req, res) => {
  try {
    const { error, value } = requestRevisionSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });
    }

    const task = await Task.findById(req.params.id).populate("projectId", "name trackingId");
    if (!task) return res.status(404).json({ message: "Task not found" });

    if (task.status !== "pending_review") {
      return res.status(400).json({ message: `Cannot request revision — task status is "${task.status}", must be pending_review` });
    }

    task.status               = "revision_requested";
    task.revisionInstructions = value.revisionInstructions;
    task.revisionDeadline     = value.revisionDeadline || null;
    await task.save();

    // Reject linked drawings with same reason
    await Drawing.updateMany(
      { taskId: task._id, status: "sent_for_approval" },
      {
        $set: {
          status:          "rejected",
          rejectedBy:      req.user._id,
          rejectedAt:      new Date(),
          rejectionReason: value.revisionInstructions,
        },
      }
    );

    logActivity({
      projectId:   task.projectId._id || task.projectId,
      actorId:     req.user._id,
      entityType:  "task",
      entityId:    task._id,
      action:      "revision_requested",
      description: `Revision requested on task "${task.title}"`,
      metadata:    { instructions: value.revisionInstructions },
    });

    // In-app notification → the designer who must revise
    if (task.assignedTo) {
      notify({
        type: "task.revision_requested",
        module: "pms",
        priority: "high",
        title: `Revision requested: ${task.title}`,
        message: value.revisionInstructions || "Please review the feedback and resubmit.",
        link: `/tasks/${task._id}`,
        recipients: [task.assignedTo],
        actor: req.user ? { _id: req.user._id, name: req.user.name } : undefined,
        relatedTo: { module: "pms", recordId: task._id },
        metadata: {
          taskTitle: task.title,
          projectName: task.projectId?.name,
          deadline: value.revisionDeadline,
        },
      });
    }

    // Notify designer — fire-and-forget
    if (task.assignedTo) {
      (async () => {
        const designer = await User.findById(task.assignedTo).select("name email phone").lean();
        const reviewer = req.user.name || "Your manager";
        const deadlineStr = value.revisionDeadline
          ? new Date(value.revisionDeadline).toLocaleDateString("en-IN")
          : "Not specified";
        if (!designer) return;
        if (designer.email) {
          mailService.sendImmediate({
            to: designer.email,
            subject: `Revision Required: ${task.title}`,
            html: `
              <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
                <h2 style="color:#E74C3C">Revision Requested</h2>
                <table style="width:100%;border-collapse:collapse">
                  <tr><td style="padding:8px;font-weight:bold;color:#555">Task</td><td style="padding:8px">${task.title}</td></tr>
                  <tr style="background:#f8f8f8"><td style="padding:8px;font-weight:bold;color:#555">Requested By</td><td style="padding:8px">${reviewer}</td></tr>
                  <tr><td style="padding:8px;font-weight:bold;color:#555">Instructions</td><td style="padding:8px">${value.revisionInstructions}</td></tr>
                  <tr style="background:#f8f8f8"><td style="padding:8px;font-weight:bold;color:#555">Deadline</td><td style="padding:8px">${deadlineStr}</td></tr>
                </table>
              </div>`,
            relatedTo: { module: "pms", recordId: task._id }, createdBy: req.user._id,
          }).catch(() => {});
        }
        if (designer.phone) {
          whatsappService.sendImmediate({
            to: designer.phone,
            message: `*Revision Required — JJ Studio ERP*\n\n*Task:* ${task.title}\n*Requested by:* ${reviewer}\n*Instructions:* ${value.revisionInstructions}\n*Deadline:* ${deadlineStr}\n\nPlease check JJ Studio ERP for details.`,
            relatedTo: { module: "pms", recordId: task._id }, createdBy: req.user._id,
          }).catch(() => {});
        }
      })();
    }

    const populated = await Task.findById(task._id)
      .populate("projectId", "name trackingId")
      .populate("assignedTo", "name email");

    res.status(200).json({ message: "Revision requested", task: populated });
  } catch (error) {
    console.error("[requestRevision]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/task/all
 * PM/PC/MD/Supervisor: all tasks across all projects with optional filters.
 * Supports: projectId, assignedTo, status (comma-separated), taskType, priority, search, page, limit
 */
const getAllTasks = async (req, res) => {
  try {
    const { projectId, assignedTo, status, taskType, priority, search, page = 1, limit = 100 } = req.query;

    const query = {};
    if (projectId)  query.projectId  = projectId;
    if (assignedTo) query.assignedTo = assignedTo;
    if (status)     query.status     = { $in: status.split(",") };
    if (taskType)   query.taskType   = taskType;
    if (priority)   query.priority   = priority;
    if (search)     query.title      = { $regex: search, $options: "i" };

    const skip = (Number(page) - 1) * Number(limit);
    const [tasks, total] = await Promise.all([
      Task.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("projectId",  "name trackingId status")
        .populate("assignedTo", "name email role"),
      Task.countDocuments(query),
    ]);

    const decorated = await decorateWithBlockers(tasks);
    return res.json({ message: "Tasks fetched", tasks: decorated, total, page: Number(page) });
  } catch (error) {
    console.error("[getAllTasks]", error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * @route PATCH /api/pms/task/reassign/:id
 * PM/PC/MD reassigns task to a different designer — resets status to not_started.
 */
const reassignTask = async (req, res) => {
  try {
    const { error, value } = reassignTaskSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });
    }

    const { notifyMail = false, notifyWhatsApp = false, ...updateData } = value;

    const task = await Task.findById(req.params.id).populate("projectId", "name trackingId");
    if (!task) return res.status(404).json({ message: "Task not found" });

    const previousAssignee = task.assignedTo;

    task.reassignedFrom  = previousAssignee || null;
    task.reassignedAt    = new Date();
    task.reassignedReason = updateData.reassignedReason || "";
    task.assignedTo      = updateData.assignedTo;
    task.status          = "not_started";
    task.submissionNotes = "";
    task.submittedAt     = null;
    task.revisionInstructions = "";
    task.revisionDeadline = null;
    if (updateData.priority  !== undefined) task.priority  = updateData.priority;
    if (updateData.startDate !== undefined) task.startDate = updateData.startDate;
    if (updateData.dueDate   !== undefined) task.dueDate   = updateData.dueDate;
    await task.save();

    logActivity({
      projectId:   task.projectId._id || task.projectId,
      actorId:     req.user._id,
      entityType:  "task",
      entityId:    task._id,
      action:      "assigned",
      description: `Task "${task.title}" reassigned`,
      metadata:    { from: previousAssignee, to: updateData.assignedTo, reason: updateData.reassignedReason },
    });

    // Notify new designer — reuse existing dispatchTaskNotifications
    if (notifyMail || notifyWhatsApp) {
      const project      = task.projectId;
      const assignedUser = await User.findById(updateData.assignedTo).select("name email phone").lean();
      if (assignedUser) {
        dispatchTaskNotifications({
          task,
          project,
          assignedUser,
          actorId: req.user._id,
          notifyMail,
          notifyWhatsApp,
        }).catch(() => {});
      }
    }

    const populated = await Task.findById(task._id)
      .populate("projectId",      "name trackingId")
      .populate("assignedTo",     "name email")
      .populate("reassignedFrom", "name");

    res.status(200).json({ message: "Task reassigned", task: populated });
  } catch (error) {
    console.error("[reassignTask]", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createTask,
  getMyTasks,
  getAllTasks,
  getTasksByProject,
  getTaskById,
  updateTask,
  updateChecklistStatus,
  deleteTask,
  getReviewQueue,
  submitTask,
  approveTask,
  requestRevision,
  reassignTask,
};
