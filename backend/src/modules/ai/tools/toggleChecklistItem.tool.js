// Write tool: tick (or untick) a single embedded checklist item on a task.
// Mirrors the existing PATCH /api/pms/task/checklist/:taskId/:itemIndex endpoint.

const mongoose = require("mongoose");
const Task = require("../../pms/models/Task.model");
const { logActivity } = require("../../../shared/activityLogger");

const WIDER_PERMS = ["*", "tasks.approve"];

async function loadAndAuthorize(args, ctx) {
  if (!mongoose.isValidObjectId(args.taskId)) {
    return { error: { ok: false, error: "invalid_args", summaryText: "Invalid task ID." } };
  }
  const task = await Task.findById(args.taskId).lean();
  if (!task) {
    return { error: { ok: false, error: "not_found", summaryText: "Task not found." } };
  }
  const isAssignee = String(task.assignedTo || "") === String(ctx.userId);
  const elevated = (ctx.permissions || []).some((p) => WIDER_PERMS.includes(p));
  if (!isAssignee && !elevated) {
    return { error: { ok: false, error: "denied",
      summaryText: "Only the assignee can tick checklist items on this task." } };
  }

  const idx = args.itemIndex;
  if (!Array.isArray(task.checklist) || idx < 0 || idx >= task.checklist.length) {
    return { error: { ok: false, error: "invalid_args",
      summaryText: `Item index ${idx} is out of range — task has ${task.checklist?.length || 0} item(s).` } };
  }
  return { task };
}

module.exports = {
  name: "toggleChecklistItem",
  permission: "tasks.update",
  isWrite: true,
  description:
    "Mark a checklist item complete (or incomplete) on a task. Use after the user explicitly mentions a checklist item — e.g. 'tick item 2 on task X', 'mark site visit done in the checklist'. Only the task's assignee may change their own checklist.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      taskId:      { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
      itemIndex:   { type: "integer", minimum: 0 },
      isCompleted: { type: "boolean" },
    },
    required: ["taskId", "itemIndex", "isCompleted"],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const item = r.task.checklist[args.itemIndex];
    const action = args.isCompleted ? "Mark complete" : "Mark incomplete";
    return {
      ok: true,
      proposalDescription:
        `${action} on task "${r.task.title}" → item ${args.itemIndex + 1}: "${item.item}"`,
      args,
      preview: {
        taskTitle: r.task.title,
        itemIndex: args.itemIndex,
        itemText: item.item,
        from: !!item.isCompleted,
        to: !!args.isCompleted,
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const t = r.task;
    const setKey = `checklist.${args.itemIndex}.isCompleted`;
    const setDate = `checklist.${args.itemIndex}.completedAt`;
    const update = { [setKey]: !!args.isCompleted };
    update[setDate] = args.isCompleted ? new Date() : null;
    await Task.updateOne({ _id: t._id }, { $set: update });

    logActivity({
      projectId: t.projectId,
      actorId: ctx.userId,
      entityType: "task",
      entityId: t._id,
      action: "checklist_updated",
      description: `[AI] ${t.title} — ${args.isCompleted ? "✓" : "○"} ${t.checklist[args.itemIndex].item}`,
      metadata: { itemIndex: args.itemIndex, isCompleted: !!args.isCompleted, viaAI: true },
    });

    return {
      ok: true,
      summaryText: `Updated checklist item ${args.itemIndex + 1} on "${t.title}".`,
      uiHint: "actionDone",
      data: {
        taskId: String(t._id),
        title: t.title,
        url: `/projects/${t.projectId}?taskId=${t._id}`,
      },
    };
  },
};
