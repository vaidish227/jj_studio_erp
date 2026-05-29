// Tool: get headline CRM dashboard stats — the 6 counters shown on the dashboard.
// Mirrors useDashboardData.js so the AI agent reports the same numbers the user
// sees on the dashboard page. All counts respect the caller's scope.

const mongoose = require("mongoose");
const CRMClient = require("../../crm/models/CRMClient.model");
const FollowUp = require("../../crm/models/FollowUp.model");

const LEAD_STATUSES_ACTIVE = ["new", "contacted", "meeting_done", "proposal_sent"];
const WIDER_PERMS = ["*", "crm.read", "users.manage"];

function hasWiderView(permissions = []) {
  return permissions.some((p) => WIDER_PERMS.includes(p));
}

module.exports = {
  name: "getDashboardStats",
  permission: "crm.read",
  description:
    "PRIMARY dashboard tool. Get the headline CRM/sales dashboard counters shown on the main Dashboard page: totalLeads (active funnel), converted, lostLeads, pending followups, inProgress (contacted + meeting_done), interested (proposal_sent). This is THE default 'dashboard' — use it for any unqualified 'show dashboard', 'dashboard details', 'dashboard stats', 'show all dashboard details', 'overview', 'how is sales going', 'how many converted this period'. For a COMPLETE dashboard view, ALSO call getSalesPipeline and getDashboardFollowUps in the same turn. (NOT for personal task workload — that is getDesignerDashboard.) Default scope auto-widens for managers/admins.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      scope: {
        type: "string",
        enum: ["me", "team"],
        description: "'me' = only items assigned to me. 'team' = everything I'm allowed to see. Defaults to 'team' for crm.read; otherwise 'me'.",
      },
    },
    required: [],
  },

  handler: async (args, ctx) => {
    const canSeeTeam = hasWiderView(ctx.permissions);
    const scope = args.scope || (canSeeTeam ? "team" : "me");

    if (scope === "team" && !canSeeTeam) {
      return {
        ok: false,
        error: "denied",
        summaryText: "You don't have permission to view team-wide dashboard stats.",
        uiHint: "error",
      };
    }

    const leadFilter = scope === "me"
      ? { assignedTo: new mongoose.Types.ObjectId(ctx.userId) }
      : {};
    const followupFilter = scope === "me"
      ? { assignedTo: new mongoose.Types.ObjectId(ctx.userId) }
      : {};

    const [
      totalLeads,
      converted,
      lostLeads,
      contacted,
      meetingDone,
      interested,
      pendingFollowups,
    ] = await Promise.all([
      CRMClient.countDocuments({ ...leadFilter, status: { $in: LEAD_STATUSES_ACTIVE } }),
      CRMClient.countDocuments({ ...leadFilter, status: "converted" }),
      CRMClient.countDocuments({ ...leadFilter, status: "lost" }),
      CRMClient.countDocuments({ ...leadFilter, status: "contacted" }),
      CRMClient.countDocuments({ ...leadFilter, status: "meeting_done" }),
      CRMClient.countDocuments({ ...leadFilter, status: "proposal_sent" }),
      FollowUp.countDocuments({ ...followupFilter, status: "pending" }),
    ]);

    const stats = {
      totalLeads,
      converted,
      lostLeads,
      followups: pendingFollowups,
      inProgress: contacted + meetingDone,
      interested,
    };

    const ownership = scope === "team" ? "" : "your ";
    const summaryText =
      `${ownership.trim() === "" ? "Dashboard" : "Your dashboard"} — ` +
      `${stats.totalLeads} active lead${stats.totalLeads === 1 ? "" : "s"}, ` +
      `${stats.converted} converted, ${stats.interested} in proposal, ` +
      `${stats.followups} pending follow-up${stats.followups === 1 ? "" : "s"}.`;

    return {
      data: stats,
      summaryText,
      uiHint: "dashboardStats",
      llmSummary: {
        scope,
        stats,
        viewAllUrl: "/dashboard",
      },
    };
  },
};
