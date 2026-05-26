// Tool: full task detail + project + assignee + approver lookup.
// Caller MUST be the assignee, OR have a wider permission ('tasks.approve',
// 'projects.read', or admin '*'). Otherwise we return a denied result so the
// model can relay the refusal politely.

const mongoose = require("mongoose");
const Task = require("../../pms/models/Task.model");
const Project = require("../../pms/models/Project.model");
const User = require("../../auth/models/user.model");

const WIDER_VIEW_PERMS = ["*", "tasks.approve", "tasks.reassign", "projects.read"];

function hasWiderView(permissions = []) {
  return permissions.some((p) => WIDER_VIEW_PERMS.includes(p));
}

module.exports = {
  name: "getTaskDetails",
  permission: "tasks.read",
  description:
    "Get full details of a single task by its ID: title, description, status, priority, dates, assignee, project, checklist, submission and revision notes. Use when the user asks 'show task X', 'task ABC details', 'who assigned this', 'what's the status of …', 'when is it due'.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      taskId: {
        type: "string",
        description: "MongoDB ObjectId of the task (24 hex chars).",
        pattern: "^[a-fA-F0-9]{24}$",
      },
    },
    required: ["taskId"],
  },

  handler: async (args, ctx) => {
    if (!mongoose.isValidObjectId(args.taskId)) {
      return { ok: false, error: "invalid_args", summaryText: "Invalid task ID format.", uiHint: "error" };
    }

    const task = await Task.findById(args.taskId).lean();
    if (!task) {
      return { ok: false, error: "not_found", summaryText: "No task found with that ID.", uiHint: "error" };
    }

    // Authorization: assignee/approver/reassigner OR wider role
    const isOwner =
      String(task.assignedTo || "") === String(ctx.userId) ||
      String(task.approvedBy || "") === String(ctx.userId) ||
      String(task.reassignedFrom || "") === String(ctx.userId);

    if (!isOwner && !hasWiderView(ctx.permissions)) {
      return {
        ok: false,
        error: "denied",
        summaryText: "You don't have permission to view this task.",
        uiHint: "error",
      };
    }

    const [project, assignee, approver] = await Promise.all([
      task.projectId
        ? Project.findById(task.projectId).select("trackingId name status primaryDesigner supervisor").lean()
        : null,
      task.assignedTo
        ? User.findById(task.assignedTo).select("name email role").lean()
        : null,
      task.approvedBy
        ? User.findById(task.approvedBy).select("name email role").lean()
        : null,
    ]);

    const total = task.checklist?.length || 0;
    const done  = task.checklist?.filter((c) => c.isCompleted).length || 0;

    const detail = {
      id: String(task._id),
      title: task.title,
      taskType: task.taskType,
      status: task.status,
      priority: task.priority,
      startDate: task.startDate,
      dueDate: task.dueDate,
      completedAt: task.completedAt,
      submittedAt: task.submittedAt,
      approvedAt: task.approvedAt,
      submissionNotes: task.submissionNotes,
      revisionInstructions: task.revisionInstructions,
      revisionDeadline: task.revisionDeadline,
      holdReason: task.holdReason,
      delayReason: task.delayReason,
      notes: task.notes,
      checklistProgress: total > 0 ? { done, total, percent: Math.round((done / total) * 100) } : null,
      checklist: (task.checklist || []).map((c, i) => ({
        index: i,
        item: c.item,
        isCompleted: !!c.isCompleted,
        completedAt: c.completedAt,
      })),
      assignee: assignee
        ? { id: String(assignee._id), name: assignee.name, email: assignee.email, role: assignee.role }
        : null,
      approver: approver
        ? { id: String(approver._id), name: approver.name, email: approver.email }
        : null,
      project: project
        ? {
            id: String(project._id),
            trackingId: project.trackingId,
            name: project.name,
            status: project.status,
          }
        : null,
      url: `/projects/${task.projectId}?taskId=${task._id}`,
    };

    return {
      data: detail,
      summaryText: `Task "${task.title}" — ${task.status}${total ? ` · checklist ${done}/${total}` : ""}`,
      uiHint: "taskDetails",
      llmSummary: {
        id: detail.id,
        title: detail.title,
        status: detail.status,
        priority: detail.priority,
        dueDate: detail.dueDate,
        checklist: detail.checklistProgress,
        assignee: detail.assignee?.name,
        project: detail.project?.trackingId,
      },
    };
  },
};
