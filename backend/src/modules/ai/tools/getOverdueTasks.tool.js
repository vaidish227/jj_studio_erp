// Tool: surface the caller's overdue tasks (and, optionally, their team's
// overdue tasks if they have a wider permission). Hard-scopes by userId by
// default — wider scopes require explicit permission strings.

const mongoose = require("mongoose");
const Task = require("../../pms/models/Task.model");
const Project = require("../../pms/models/Project.model");
const User = require("../../auth/models/user.model");

const NON_OVERDUE_STATUSES = ["completed", "approved", "released_to_site"];
const TEAM_SCOPE_PERMS = ["*", "tasks.approve", "projects.read"];

function canSeeTeam(permissions = []) {
  return permissions.some((p) => TEAM_SCOPE_PERMS.includes(p));
}

module.exports = {
  name: "getOverdueTasks",
  permission: "tasks.read",
  description:
    "Get overdue tasks (dueDate in the past, status not completed). Default scope is the calling user. Pass scope='team' to see all overdue tasks across the user's team — this requires a manager/admin permission and will be denied otherwise.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      scope: {
        type: "string",
        enum: ["me", "team"],
        description: "'me' = my overdue (default). 'team' = everyone's overdue (manager+ only).",
      },
      limit: { type: "integer", minimum: 1, maximum: 50 },
    },
    required: [],
  },

  handler: async (args, ctx) => {
    const scope = args.scope || "me";
    const limit = Math.min(args.limit || 25, 50);
    const now = new Date();

    const q = {
      dueDate: { $lt: now },
      status: { $nin: NON_OVERDUE_STATUSES },
    };

    if (scope === "team") {
      if (!canSeeTeam(ctx.permissions)) {
        return {
          ok: false,
          error: "denied",
          summaryText: "You don't have permission to view team-wide overdue tasks.",
          uiHint: "error",
        };
      }
      // No assignee filter — team-wide.
    } else {
      q.assignedTo = new mongoose.Types.ObjectId(ctx.userId);
    }

    const tasks = await Task.find(q)
      .select("title status priority dueDate projectId taskType assignedTo")
      .sort({ dueDate: 1 })
      .limit(limit)
      .lean();

    const projectIds = [...new Set(tasks.map((t) => String(t.projectId)).filter(Boolean))];
    const userIds    = [...new Set(tasks.map((t) => String(t.assignedTo)).filter(Boolean))];

    const [projects, users] = await Promise.all([
      projectIds.length
        ? Project.find({ _id: { $in: projectIds } }).select("trackingId name").lean()
        : [],
      scope === "team" && userIds.length
        ? User.find({ _id: { $in: userIds } }).select("name role").lean()
        : [],
    ]);
    const projectById = new Map(projects.map((p) => [String(p._id), p]));
    const userById    = new Map(users.map((u) => [String(u._id), u]));

    const items = tasks.map((t) => {
      const overdueByDays = t.dueDate
        ? Math.max(0, Math.floor((now - new Date(t.dueDate)) / (24 * 60 * 60 * 1000)))
        : 0;
      const p = projectById.get(String(t.projectId));
      const u = userById.get(String(t.assignedTo));
      return {
        id: String(t._id),
        title: t.title,
        status: t.status,
        priority: t.priority,
        taskType: t.taskType,
        dueDate: t.dueDate,
        overdueByDays,
        assignee: u ? { id: String(u._id), name: u.name, role: u.role } : null,
        project: p
          ? { id: String(p._id), trackingId: p.trackingId, name: p.name }
          : null,
        url: `/projects/${t.projectId}?taskId=${t._id}`,
      };
    });

    return {
      data: items,
      summaryText:
        items.length === 0
          ? scope === "team"
            ? "No overdue tasks across the team."
            : "Nothing overdue. Great job."
          : `${items.length} overdue task${items.length === 1 ? "" : "s"} (${scope})`,
      uiHint: "taskList",
      llmSummary: items.slice(0, 10).map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        overdueByDays: t.overdueByDays,
        project: t.project?.trackingId || null,
        assignee: t.assignee?.name || null,
      })),
    };
  },
};
