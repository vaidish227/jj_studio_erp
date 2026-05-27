// Tool: get tasks assigned to the calling user, optionally filtered by status.
// HARD-scoped by ctx.userId — args.status is the ONLY caller-controlled filter.

const mongoose = require("mongoose");
const Task = require("../../pms/models/Task.model");
const Project = require("../../pms/models/Project.model");

const PENDING_STATUSES   = ["not_started", "in_progress", "revision_requested"];
const COMPLETED_STATUSES = ["completed", "approved", "released_to_site"];

module.exports = {
  name: "getMyTasks",
  permission: "tasks.read",
  description:
    "Get tasks assigned to the current user. Use for queries like 'my tasks', 'pending tasks', 'what should I do', 'overdue tasks', 'today's work', etc. Returns task title, status, priority, dueDate, and project. The UI renders this as a clickable task list.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      status: {
        type: "string",
        enum: ["pending", "overdue", "in_progress", "review", "approved", "completed", "on_hold", "all"],
        description:
          "Filter: 'pending' = not started + in progress + revision requested. 'overdue' = pending with dueDate in the past. 'review' = pending_review or pending_client_approval. 'all' = no status filter.",
      },
      priority: {
        type: "string",
        enum: ["low", "medium", "high", "urgent"],
        description: "Optional priority filter.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        description: "Max tasks to return. Default 20.",
      },
    },
    required: [],
  },

  handler: async (args, ctx) => {
    const q = { assignedTo: new mongoose.Types.ObjectId(ctx.userId) };
    const status = args.status || "pending";
    const now = new Date();

    if (status === "pending") {
      q.status = { $in: PENDING_STATUSES };
    } else if (status === "overdue") {
      q.status = { $nin: COMPLETED_STATUSES };
      q.dueDate = { $lt: now };
    } else if (status === "review") {
      q.status = { $in: ["pending_review", "pending_client_approval"] };
    } else if (status === "in_progress") {
      q.status = "in_progress";
    } else if (status === "approved") {
      q.status = "approved";
    } else if (status === "completed") {
      q.status = "completed";
    } else if (status === "on_hold") {
      q.status = "on_hold";
    }
    // status === "all" -> no status filter

    if (args.priority) q.priority = args.priority;

    const limit = Math.min(args.limit || 20, 50);

    const tasks = await Task.find(q)
      .select("title status priority dueDate startDate projectId taskType updatedAt")
      .sort({ dueDate: 1, priority: -1, updatedAt: -1 })
      .limit(limit)
      .lean();

    // Hydrate project trackingId + name in a single batch query
    const projectIds = [...new Set(tasks.filter((t) => t.projectId).map((t) => String(t.projectId)))];
    const projects = projectIds.length
      ? await Project.find({ _id: { $in: projectIds } })
          .select("trackingId name status")
          .lean()
      : [];
    const projectById = new Map(projects.map((p) => [String(p._id), p]));

    const items = tasks.map((t) => {
      const p = projectById.get(String(t.projectId));
      const isOverdue = t.dueDate && t.dueDate < now && !COMPLETED_STATUSES.includes(t.status);
      return {
        id: String(t._id),
        title: t.title,
        status: t.status,
        priority: t.priority,
        taskType: t.taskType,
        dueDate: t.dueDate,
        startDate: t.startDate,
        isOverdue,
        project: p
          ? { id: String(p._id), trackingId: p.trackingId, name: p.name, status: p.status }
          : null,
        url: `/projects/${t.projectId}?taskId=${t._id}`,
      };
    });

    // Render "all" as "" so we get "1 task" instead of "1 all task".
    const label = status === "all" ? "" : `${status} `;
    return {
      data: items,
      summaryText:
        items.length === 0
          ? status === "all"
            ? "No tasks matching your filters."
            : `No ${status} tasks found.`
          : `${items.length} ${label}task${items.length === 1 ? "" : "s"}`,
      uiHint: "taskList",
      // Includes `id` so the model can pass it to write tools
      // (updateTaskStatus, toggleChecklistItem, addTaskNote, reassignTask, etc.).
      llmSummary: items.slice(0, 10).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        project: t.project?.trackingId || null,
        isOverdue: t.isOverdue,
      })),
    };
  },
};
