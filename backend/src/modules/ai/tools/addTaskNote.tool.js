// Write tool: append a timestamped note to a task. Less destructive than the
// other write tools — but still confirmation-gated so users see what's being
// recorded against the task.

const mongoose = require("mongoose");
const Task = require("../../pms/models/Task.model");
const User = require("../../auth/models/user.model");
const { logActivity } = require("../../../shared/activityLogger");

const WIDER_PERMS = ["*", "tasks.approve", "tasks.update"];

async function loadAndAuthorize(args, ctx) {
  if (!mongoose.isValidObjectId(args.taskId)) {
    return { error: { ok: false, error: "invalid_args", summaryText: "Invalid task ID." } };
  }
  const task = await Task.findById(args.taskId).lean();
  if (!task) return { error: { ok: false, error: "not_found", summaryText: "Task not found." } };

  const isAssignee = String(task.assignedTo || "") === String(ctx.userId);
  const elevated = (ctx.permissions || []).some((p) => WIDER_PERMS.includes(p));
  if (!isAssignee && !elevated) {
    return { error: { ok: false, error: "denied",
      summaryText: "Only the assignee or an approver can add notes to this task." } };
  }
  return { task };
}

module.exports = {
  name: "addTaskNote",
  permission: "tasks.update",
  isWrite: true,
  description:
    "Append a short timestamped note to a task. Use when the user says things like 'add a note that…', 'leave a comment on task X', 'mark down that…'. The note is appended to the task's notes field with the current user and date.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      taskId: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
      note:   { type: "string", minLength: 2, maxLength: 1000 },
    },
    required: ["taskId", "note"],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    return {
      ok: true,
      proposalDescription:
        `Add note to "${r.task.title}": "${args.note.slice(0, 160)}${args.note.length > 160 ? "…" : ""}"`,
      args,
      preview: { taskTitle: r.task.title, note: args.note },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const t = r.task;
    const me = await User.findById(ctx.userId).select("name").lean();
    const authorName = me?.name || ctx.email || "Unknown user";
    const stamp = new Date().toLocaleString();
    const line = `[${stamp}] ${authorName} (via AI): ${args.note}`;

    const newNotes = t.notes ? `${t.notes}\n${line}` : line;
    await Task.updateOne({ _id: t._id }, { $set: { notes: newNotes } });

    logActivity({
      projectId: t.projectId,
      actorId: ctx.userId,
      entityType: "task",
      entityId: t._id,
      action: "commented",
      description: `[AI note] ${args.note.slice(0, 200)}`,
      metadata: { viaAI: true },
    });

    return {
      ok: true,
      summaryText: `Note added to "${t.title}".`,
      uiHint: "actionDone",
      data: { taskId: String(t._id), title: t.title,
              url: `/projects/${t.projectId}?taskId=${t._id}` },
    };
  },
};
