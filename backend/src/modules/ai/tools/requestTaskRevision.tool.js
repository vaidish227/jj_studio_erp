// Write tool: send a task back to the designer for revision. Only allowed
// when the task is currently in pending_review or approved (the same gates
// the existing UI enforces). Requires tasks.approve.

const mongoose = require("mongoose");
const Task = require("../../pms/models/Task.model");
const { logActivity } = require("../../../shared/activityLogger");
const { dispatch: notify } = require("../../notifications/services/notificationDispatcher");

const ALLOWED_FROM = new Set(["pending_review", "pending_client_approval", "approved"]);

async function loadAndAuthorize(args, ctx) {
  if (!mongoose.isValidObjectId(args.taskId)) {
    return { error: { ok: false, error: "invalid_args", summaryText: "Invalid task ID." } };
  }
  const task = await Task.findById(args.taskId).lean();
  if (!task) return { error: { ok: false, error: "not_found", summaryText: "Task not found." } };

  if (!ALLOWED_FROM.has(task.status)) {
    return { error: { ok: false, error: "invalid_transition",
      summaryText: `Task is "${task.status}" — revisions can only be requested from ${[...ALLOWED_FROM].join(", ")}.` } };
  }

  let deadline = null;
  if (args.deadline) {
    const d = new Date(args.deadline);
    if (Number.isNaN(d.getTime())) {
      return { error: { ok: false, error: "invalid_args", summaryText: "Invalid deadline date." } };
    }
    if (d < new Date()) {
      return { error: { ok: false, error: "invalid_args", summaryText: "Deadline must be in the future." } };
    }
    deadline = d;
  }
  return { task, deadline };
}

module.exports = {
  name: "requestTaskRevision",
  permission: "tasks.approve",
  isWrite: true,
  description:
    "Send a task back to the designer for revision with specific instructions. Sets status='revision_requested', records revisionInstructions and revisionDeadline. Only valid when the task is in pending_review, pending_client_approval, or approved.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      taskId:       { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
      instructions: { type: "string", minLength: 5, maxLength: 2000, description: "Clear instructions for the designer." },
      deadline: {
        type: "string",
        minLength: 8,
        maxLength: 64,
        description: "Optional datetime for the revision deadline (any parseable form).",
      },
    },
    required: ["taskId", "instructions"],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const deadlineStr = r.deadline ? ` · deadline ${r.deadline.toLocaleDateString()}` : "";
    return {
      ok: true,
      proposalDescription:
        `Request revision on "${r.task.title}" (currently ${r.task.status})${deadlineStr}\n— "${args.instructions.slice(0, 160)}${args.instructions.length > 160 ? "…" : ""}"`,
      args,
      preview: {
        taskTitle: r.task.title,
        from: r.task.status,
        instructions: args.instructions,
        deadline: r.deadline,
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const t = r.task;

    await Task.updateOne(
      { _id: t._id },
      {
        $set: {
          status: "revision_requested",
          revisionInstructions: args.instructions,
          revisionDeadline: r.deadline,
          updatedAt: new Date(),
        },
      }
    );

    logActivity({
      projectId: t.projectId,
      actorId: ctx.userId,
      entityType: "task",
      entityId: t._id,
      action: "revision_requested",
      description: `[AI] Revision requested on ${t.title}: ${args.instructions.slice(0, 200)}`,
      metadata: { from: t.status, deadline: r.deadline, viaAI: true },
    });

    if (t.assignedTo) {
      notify({
        type: "task.revision_requested",
        module: "pms",
        priority: "high",
        title: `Revision requested: ${t.title}`,
        message: `${args.instructions} (via AI assistant).`,
        link: `/tasks/${t._id}`,
        recipients: [t.assignedTo],
        actor: { _id: ctx.userId, name: ctx.userName || "AI Assistant" },
        notifyActor: true,
        relatedTo: { module: "pms", recordId: t._id },
        metadata: { taskTitle: t.title, deadline: r.deadline, viaAI: true },
      });
    }

    return {
      ok: true,
      summaryText: `Sent "${t.title}" back for revision.`,
      uiHint: "actionDone",
      data: { taskId: String(t._id), title: t.title, status: "revision_requested",
              url: `/projects/${t.projectId}?taskId=${t._id}` },
    };
  },
};
