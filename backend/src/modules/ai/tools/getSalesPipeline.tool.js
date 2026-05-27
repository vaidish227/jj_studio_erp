// Tool: get sales pipeline buckets — the 3 columns shown on the dashboard:
// new leads, scheduled meetings, and proposal-sent leads. Useful for "show me
// the pipeline", "what's in the funnel", "how does sales look this week".

const mongoose = require("mongoose");
const CRMClient = require("../../crm/models/CRMClient.model");
const Meeting = require("../../crm/models/Metting.model");

const WIDER_PERMS = ["*", "crm.read", "users.manage"];

function hasWiderView(permissions = []) {
  return permissions.some((p) => WIDER_PERMS.includes(p));
}

module.exports = {
  name: "getSalesPipeline",
  permission: "crm.read",
  description:
    "Get the sales pipeline preview shown on the dashboard: new leads, scheduled meetings, and proposal-sent leads (top N each). Use for 'show pipeline', 'what's in the funnel', 'sales pipeline', 'pipeline overview'. Default scope auto-widens for managers/admins.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      scope: {
        type: "string",
        enum: ["me", "team"],
        description: "'me' = only items assigned to me. 'team' = everything I'm allowed to see. Defaults to 'team' for crm.read; otherwise 'me'.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 20,
        description: "Max items per bucket (default 5).",
      },
    },
    required: [],
  },

  handler: async (args, ctx) => {
    const canSeeTeam = hasWiderView(ctx.permissions);
    const scope = args.scope || (canSeeTeam ? "team" : "me");
    const limit = Math.min(args.limit || 5, 20);

    if (scope === "team" && !canSeeTeam) {
      return {
        ok: false,
        error: "denied",
        summaryText: "You don't have permission to view team-wide pipeline.",
        uiHint: "error",
      };
    }

    const userId = new mongoose.Types.ObjectId(ctx.userId);
    const leadFilter = scope === "me" ? { assignedTo: userId } : {};
    const meetingFilter = scope === "me" ? { assignedTo: userId } : {};

    const [newLeadsRaw, meetingsRaw, proposalLeadsRaw, totals] = await Promise.all([
      CRMClient.find({ ...leadFilter, status: "new" })
        .select("trackingId name phone projectType city budget status updatedAt")
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean(),
      Meeting.find({ ...meetingFilter, status: "scheduled" })
        .populate("leadId", "name trackingId phone city projectType")
        .sort({ date: 1 })
        .limit(limit)
        .lean(),
      CRMClient.find({ ...leadFilter, status: "proposal_sent" })
        .select("trackingId name phone projectType city budget status updatedAt")
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean(),
      Promise.all([
        CRMClient.countDocuments({ ...leadFilter, status: "new" }),
        Meeting.countDocuments({ ...meetingFilter, status: "scheduled" }),
        CRMClient.countDocuments({ ...leadFilter, status: "proposal_sent" }),
      ]),
    ]);

    const [newLeadsTotal, meetingsTotal, proposalLeadsTotal] = totals;

    const newLeads = newLeadsRaw.map((l) => ({
      id: String(l._id),
      trackingId: l.trackingId,
      name: l.name,
      phone: l.phone,
      projectType: l.projectType,
      city: l.city,
      budget: l.budget,
      url: "/crm/new-leads",
    }));

    const meetings = meetingsRaw.map((m) => ({
      id: String(m._id),
      date: m.date,
      type: m.type,
      durationMinutes: m.durationMinutes,
      lead: m.leadId
        ? {
            id: String(m.leadId._id),
            name: m.leadId.name,
            trackingId: m.leadId.trackingId,
            phone: m.leadId.phone,
            city: m.leadId.city,
            projectType: m.leadId.projectType,
          }
        : null,
      url: "/crm/meetings",
    }));

    const proposalLeads = proposalLeadsRaw.map((l) => ({
      id: String(l._id),
      trackingId: l.trackingId,
      name: l.name,
      phone: l.phone,
      projectType: l.projectType,
      city: l.city,
      budget: l.budget,
      url: "/crm/proposal",
    }));

    const ownership = scope === "team" ? "" : "your ";
    const summaryText =
      `Pipeline${scope === "me" ? " (yours)" : ""}: ` +
      `${newLeadsTotal} new lead${newLeadsTotal === 1 ? "" : "s"}, ` +
      `${meetingsTotal} scheduled meeting${meetingsTotal === 1 ? "" : "s"}, ` +
      `${proposalLeadsTotal} proposal-sent.`;

    return {
      data: { newLeads, meetings, proposalLeads },
      totals: {
        newLeads: newLeadsTotal,
        meetings: meetingsTotal,
        proposalLeads: proposalLeadsTotal,
      },
      summaryText,
      uiHint: "salesPipeline",
      viewAllUrl: "/dashboard",
      llmSummary: {
        scope,
        ownership: ownership.trim() || "team",
        buckets: {
          newLeads: {
            total: newLeadsTotal,
            shown: newLeads.length,
            items: newLeads.slice(0, 10).map((l) => ({
              id: l.id,
              trackingId: l.trackingId,
              name: l.name,
              projectType: l.projectType,
              city: l.city,
              budget: l.budget,
            })),
          },
          meetings: {
            total: meetingsTotal,
            shown: meetings.length,
            items: meetings.slice(0, 10).map((m) => ({
              id: m.id,
              when: m.date,
              type: m.type,
              leadName: m.lead?.name || null,
              trackingId: m.lead?.trackingId || null,
            })),
          },
          proposalLeads: {
            total: proposalLeadsTotal,
            shown: proposalLeads.length,
            items: proposalLeads.slice(0, 10).map((l) => ({
              id: l.id,
              trackingId: l.trackingId,
              name: l.name,
              projectType: l.projectType,
              city: l.city,
              budget: l.budget,
            })),
          },
        },
      },
    };
  },
};
