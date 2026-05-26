// Tool: high-level project summary — team, status, task counts by status,
// drawings overview, client-approval progress. Authorization: must be on the
// project team OR have projects.read.

const mongoose = require("mongoose");
const Project = require("../../pms/models/Project.model");
const Task = require("../../pms/models/Task.model");
const User = require("../../auth/models/user.model");

const WIDER_PROJECT_PERMS = ["*", "projects.read", "projects.update"];

function isOnTeam(project, userId) {
  if (!project || !userId) return false;
  const id = String(userId);
  const team = [
    project.primaryDesigner,
    project.supervisor,
    project.designerB,
    project.designerC,
    project.designerD,
    project.designerE,
    project.contractor,
  ];
  return team.some((m) => String(m || "") === id);
}

module.exports = {
  name: "getProjectSummary",
  permission: "projects.read",
  description:
    "Get a high-level summary of a project: status, team, tasks-by-status counts, overdue tasks count, client-approval progress, kickstart progress. Use for 'project ABC summary', 'project status', 'how is project XYZ going', 'team of project …'. The caller must be on the project team or hold projects.read.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      projectId: {
        type: "string",
        description: "Either the MongoDB ObjectId or the human trackingId (e.g. PRJ-2025-0007).",
      },
    },
    required: ["projectId"],
  },

  handler: async (args, ctx) => {
    if (!args.projectId) {
      return { ok: false, error: "invalid_args", summaryText: "projectId required.", uiHint: "error" };
    }

    const isObjectId = mongoose.isValidObjectId(args.projectId);
    const project = await Project.findOne(
      isObjectId ? { _id: args.projectId } : { trackingId: args.projectId.trim() }
    ).lean();

    if (!project) {
      return { ok: false, error: "not_found", summaryText: "Project not found.", uiHint: "error" };
    }

    const hasWider = (ctx.permissions || []).some((p) => WIDER_PROJECT_PERMS.includes(p));
    if (!isOnTeam(project, ctx.userId) && !hasWider) {
      return {
        ok: false,
        error: "denied",
        summaryText: "You don't have permission to view this project.",
        uiHint: "error",
      };
    }

    const now = new Date();

    // Aggregate task counts in a single roundtrip
    const taskAgg = await Task.aggregate([
      { $match: { projectId: project._id } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lt: ["$dueDate", now] },
                    { $not: [{ $in: ["$status", ["completed", "approved", "released_to_site"]] }] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const byStatus = {};
    let totalTasks = 0;
    let overdueTotal = 0;
    for (const row of taskAgg) {
      byStatus[row._id] = row.count;
      totalTasks += row.count;
      overdueTotal += row.overdue || 0;
    }

    // Resolve team names
    const memberIds = [
      project.primaryDesigner,
      project.supervisor,
      project.designerB,
      project.designerC,
      project.designerD,
      project.designerE,
      project.contractor,
    ].filter(Boolean);

    const members = memberIds.length
      ? await User.find({ _id: { $in: memberIds } }).select("name role designation").lean()
      : [];
    const byId = new Map(members.map((m) => [String(m._id), m]));
    const named = (id, label) => {
      const m = byId.get(String(id || ""));
      return m ? { id: String(m._id), name: m.name, role: m.role, label } : null;
    };

    const team = [
      named(project.primaryDesigner, "Primary Designer"),
      named(project.supervisor, "Supervisor"),
      named(project.designerB, "Designer B"),
      named(project.designerC, "Designer C"),
      named(project.designerD, "Designer D"),
      named(project.designerE, "Designer E"),
      named(project.contractor, "Contractor"),
    ].filter(Boolean);

    const approvals = Array.isArray(project.clientApprovals)
      ? {
          total: project.clientApprovals.length,
          obtained: project.clientApprovals.filter((a) => a.status === "obtained").length,
          pending: project.clientApprovals.filter((a) => a.status === "pending").length,
          items: project.clientApprovals.map((a) => ({
            type: a.type,
            status: a.status,
            obtainedAt: a.obtainedAt,
          })),
        }
      : null;

    const data = {
      id: String(project._id),
      trackingId: project.trackingId,
      name: project.name,
      status: project.status,
      projectType: project.projectType,
      city: project.siteAddress?.city,
      area: project.area,
      budget: project.budget,
      startDate: project.startDate,
      estimatedCompletionDate: project.estimatedCompletionDate,
      actualCompletionDate: project.actualCompletionDate,
      kickstartCompleted: !!project.kickstartCompleted,
      kickstartData: project.kickstartData,
      team,
      tasks: { total: totalTasks, byStatus, overdue: overdueTotal },
      clientApprovals: approvals,
      url: `/projects/${project._id}`,
    };

    return {
      data,
      summaryText: `Project ${project.trackingId} (${project.name}) — ${project.status} · ${totalTasks} tasks · ${overdueTotal} overdue`,
      uiHint: "projectSummary",
      llmSummary: {
        trackingId: data.trackingId,
        name: data.name,
        status: data.status,
        tasks: data.tasks,
        team: team.map((t) => `${t.label}: ${t.name}`),
        approvals: approvals ? `${approvals.obtained}/${approvals.total} approvals obtained` : null,
      },
    };
  },
};
