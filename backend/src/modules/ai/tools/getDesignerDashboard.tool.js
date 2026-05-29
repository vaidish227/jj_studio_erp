// Tool: a rolled-up "what's on my plate" view tailored to designers, but
// returnable for any user — it just shows their own metrics. Mirrors the
// shape of the existing /api/pms/designer/dashboard endpoint but stays
// self-contained so we don't introduce a hard coupling.

const mongoose = require("mongoose");
const Task = require("../../pms/models/Task.model");
const Project = require("../../pms/models/Project.model");

const PENDING_STATUSES = ["not_started", "in_progress", "revision_requested"];
const COMPLETED_STATUSES = ["completed", "approved", "released_to_site"];

module.exports = {
  name: "getDesignerDashboard",
  permission: "tasks.read",
  description:
    "Personal TASK workload view for the calling user (PMS — NOT the CRM/sales dashboard): the user's own tasks by status, overdue task count, upcoming task deadlines (next 14 days), and their active projects. Use ONLY when the user explicitly asks about THEIR OWN tasks/work, e.g. 'my tasks', \"what's on my plate\", 'my workload', 'my pending tasks', 'mere kaam/tasks kya hain'. Do NOT use this for an unqualified 'dashboard', 'dashboard details', or 'overview' — that is the CRM dashboard (use getDashboardStats).",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      upcomingDays: {
        type: "integer",
        minimum: 1,
        maximum: 60,
        description: "Look-ahead window in days for upcoming deadlines. Default 14.",
      },
    },
    required: [],
  },

  handler: async (args, ctx) => {
    const upcomingDays = args.upcomingDays || 14;
    const now = new Date();
    const horizon = new Date(now.getTime() + upcomingDays * 24 * 60 * 60 * 1000);
    const me = new mongoose.Types.ObjectId(ctx.userId);

    const [byStatus, overdueCount, upcoming, activeProjectIds] = await Promise.all([
      Task.aggregate([
        { $match: { assignedTo: me } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Task.countDocuments({
        assignedTo: me,
        dueDate: { $lt: now },
        status: { $nin: COMPLETED_STATUSES },
      }),
      Task.find({
        assignedTo: me,
        dueDate: { $gte: now, $lte: horizon },
        status: { $nin: COMPLETED_STATUSES },
      })
        .select("title status priority dueDate projectId taskType")
        .sort({ dueDate: 1 })
        .limit(15)
        .lean(),
      Task.distinct("projectId", {
        assignedTo: me,
        status: { $in: PENDING_STATUSES.concat(["pending_review", "pending_client_approval"]) },
      }),
    ]);

    const projects = activeProjectIds.length
      ? await Project.find({ _id: { $in: activeProjectIds } })
          .select("trackingId name status")
          .lean()
      : [];
    const projectById = new Map(projects.map((p) => [String(p._id), p]));

    const statusCounts = {};
    let totalAssigned = 0;
    for (const row of byStatus) {
      statusCounts[row._id] = row.count;
      totalAssigned += row.count;
    }

    const upcomingItems = upcoming.map((t) => {
      const p = projectById.get(String(t.projectId));
      return {
        id: String(t._id),
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        project: p ? { trackingId: p.trackingId, name: p.name } : null,
        url: `/projects/${t.projectId}?taskId=${t._id}`,
      };
    });

    const data = {
      totalAssigned,
      overdueCount,
      byStatus: statusCounts,
      upcoming: upcomingItems,
      activeProjects: projects.map((p) => ({
        id: String(p._id),
        trackingId: p.trackingId,
        name: p.name,
        status: p.status,
        url: `/projects/${p._id}`,
      })),
    };

    return {
      data,
      summaryText: `${totalAssigned} tasks · ${overdueCount} overdue · ${data.activeProjects.length} active projects`,
      uiHint: "dashboard",
      llmSummary: {
        totalAssigned,
        overdueCount,
        byStatus: statusCounts,
        upcomingCount: upcomingItems.length,
        activeProjectsCount: data.activeProjects.length,
      },
    };
  },
};
