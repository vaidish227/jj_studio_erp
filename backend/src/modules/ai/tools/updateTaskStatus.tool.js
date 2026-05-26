// Write tool: change a task's status, with lifecycle validation. Two-phase
// (dryRun + apply) — the AI proposes; the user confirms in chat before the
// write happens. Mirrors the rules from existing Task.controller.js so the
// AI cannot make transitions the human UI wouldn't allow.

const mongoose = require("mongoose");
const Task = require("../../pms/models/Task.model");
const Project = require("../../pms/models/Project.model");
const { logActivity } = require("../../../shared/activityLogger");

// Allowed transitions per source status. Keep in sync with the Task UI.
const ALLOWED_TRANSITIONS = {
  not_started:             ["in_progress", "on_hold"],
  in_progress:             ["pending_review", "on_hold", "not_started"],
  pending_review:          ["approved", "revision_requested", "pending_client_approval", "in_progress"],
  revision_requested:      ["in_progress", "pending_review", "on_hold"],
  pending_client_approval: ["approved", "revision_requested"],
  approved:                ["released_to_site", "revision_requested"],
  released_to_site:        ["completed", "revision_requested"],
  completed:               [],
  on_hold:                 ["in_progress", "not_started", "revision_requested"],
};

// Status changes that require elevated permission (not just being the assignee).
const APPROVAL_TARGETS = new Set([
  "approved", "released_to_site", "revision_requested", "pending_client_approval",
]);

const APPROVE_PERMS = ["*", "tasks.approve"];

function canApprove(permissions = []) {
  return permissions.some((p) => APPROVE_PERMS.includes(p));
}

async function loadAndAuthorize(args, ctx) {
  if (!mongoose.isValidObjectId(args.taskId)) {
    return { error: { ok: false, error: "invalid_args", summaryText: "Invalid task ID." } };
  }
  const task = await Task.findById(args.taskId).lean();
  if (!task) {
    return { error: { ok: false, error: "not_found", summaryText: "Task not found." } };
  }
  const isAssignee = String(task.assignedTo || "") === String(ctx.userId);
  const elevated = canApprove(ctx.permissions);

  if (APPROVAL_TARGETS.has(args.status)) {
    if (!elevated) {
      return { error: { ok: false, error: "denied",
        summaryText: `Only an approver (tasks.approve) can move a task to "${args.status}".` } };
    }
  } else if (!isAssignee && !elevated) {
    return { error: { ok: false, error: "denied",
      summaryText: "Only the assignee (or an approver) can change this task." } };
  }

  const fromStatus = task.status;
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(args.status)) {
    return { error: { ok: false, error: "invalid_transition",
      summaryText: `Cannot move task from "${fromStatus}" to "${args.status}". Allowed: ${allowed.join(", ") || "(none — task is closed)"}.` } };
  }
  if (args.status === "on_hold" && !args.reason?.trim()) {
    return { error: { ok: false, error: "invalid_args",
      summaryText: "Setting on_hold requires a non-empty reason." } };
  }

  return { task };
}

module.exports = {
  name: "updateTaskStatus",
  permission: "tasks.update",
  isWrite: true,
  description:
    "Change a task's workflow status (e.g. start work, mark for review, approve, put on hold, mark completed). Validates the transition is legal given the current status. Approval-side transitions (approved, released_to_site, revision_requested) require tasks.approve.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      taskId: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
      status: {
        type: "string",
        enum: [
          "not_started", "in_progress", "pending_review", "revision_requested",
          "pending_client_approval", "approved", "released_to_site", "completed", "on_hold",
        ],
      },
      reason: { type: "string", maxLength: 500, description: "Required when status='on_hold'. Optional otherwise." },
    },
    required: ["taskId", "status"],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const t = r.task;
    return {
      ok: true,
      proposalDescription:
        `Change task "${t.title}" status: ${t.status} → ${args.status}` +
        (args.reason ? ` · reason: ${args.reason}` : ""),
      args,
      preview: {
        taskId: String(t._id),
        taskTitle: t.title,
        from: t.status,
        to: args.status,
        reason: args.reason || null,
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx); // re-validate at apply time
    if (r.error) return r.error;
    const t = r.task;

    const update = { status: args.status, updatedAt: new Date() };
    if (args.status === "on_hold") update.holdReason = args.reason || "";
    if (args.status === "completed") update.completedAt = new Date();
    if (args.status === "approved")  update.approvedAt  = new Date();
    if (args.status === "approved")  update.approvedBy  = new mongoose.Types.ObjectId(ctx.userId);
    if (args.status === "pending_review") update.submittedAt = new Date();

    await Task.updateOne({ _id: t._id }, { $set: update });

    // Audit — task status changes are first-class activity log entries.
    logActivity({
      projectId: t.projectId,
      actorId: ctx.userId,
      entityType: "task",
      entityId: t._id,
      action: "status_changed",
      description: `[AI] ${t.title}: ${t.status} → ${args.status}` + (args.reason ? ` (${args.reason})` : ""),
      metadata: { from: t.status, to: args.status, reason: args.reason || null, viaAI: true },
    });

    return {
      ok: true,
      summaryText: `Task "${t.title}" is now ${args.status}.`,
      uiHint: "actionDone",
      data: { taskId: String(t._id), title: t.title, status: args.status, url: `/projects/${t.projectId}?taskId=${t._id}` },
    };
  },
};
