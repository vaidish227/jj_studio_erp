// Tool: fetch the embedded checklist of a single task plus a completion %.
// Authorization mirrors getTaskDetails — assignee or wider-view role.

const mongoose = require("mongoose");
const Task = require("../../pms/models/Task.model");

const WIDER_VIEW_PERMS = ["*", "tasks.approve", "tasks.reassign", "projects.read"];

function hasWiderView(permissions = []) {
  return permissions.some((p) => WIDER_VIEW_PERMS.includes(p));
}

module.exports = {
  name: "getChecklist",
  permission: "tasks.read",
  description:
    "Get the checklist of a single task by its taskId, with completion percentage. Use when the user asks 'show checklist of …', 'what's pending in the checklist', 'how much is done'.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      taskId: {
        type: "string",
        pattern: "^[a-fA-F0-9]{24}$",
      },
    },
    required: ["taskId"],
  },

  handler: async (args, ctx) => {
    if (!mongoose.isValidObjectId(args.taskId)) {
      return { ok: false, error: "invalid_args", summaryText: "Invalid task ID.", uiHint: "error" };
    }

    const task = await Task.findById(args.taskId)
      .select("title status assignedTo approvedBy checklist projectId")
      .lean();
    if (!task) {
      return { ok: false, error: "not_found", summaryText: "Task not found.", uiHint: "error" };
    }

    const isOwner =
      String(task.assignedTo || "") === String(ctx.userId) ||
      String(task.approvedBy || "") === String(ctx.userId);

    if (!isOwner && !hasWiderView(ctx.permissions)) {
      return {
        ok: false,
        error: "denied",
        summaryText: "You don't have permission to view this task's checklist.",
        uiHint: "error",
      };
    }

    const items = (task.checklist || []).map((c, i) => ({
      index: i,
      item: c.item,
      isCompleted: !!c.isCompleted,
      completedAt: c.completedAt,
    }));

    const total = items.length;
    const done = items.filter((i) => i.isCompleted).length;
    const pending = items.filter((i) => !i.isCompleted);
    const progress = total > 0 ? { done, total, percent: Math.round((done / total) * 100) } : null;

    return {
      data: {
        taskId: String(task._id),
        taskTitle: task.title,
        taskStatus: task.status,
        progress,
        items,
        url: `/projects/${task.projectId}?taskId=${task._id}`,
      },
      summaryText:
        total === 0
          ? `Task "${task.title}" has no checklist.`
          : `Checklist: ${done}/${total} done (${progress.percent}%)`,
      uiHint: "checklist",
      llmSummary: {
        task: task.title,
        progress,
        pendingItems: pending.slice(0, 8).map((i) => i.item),
      },
    };
  },
};
