// Tool: get CRM leads (clients still in the sales funnel — not yet converted/lost).
// Hard-scoped by ctx.userId via `assignedTo` UNLESS the caller has a wider
// permission (crm.read, *). Default behavior matches what other CRM screens enforce.

const mongoose = require("mongoose");
const CRMClient = require("../../crm/models/CRMClient.model");
const User = require("../../auth/models/user.model");

const LEAD_STATUSES = ["new", "contacted", "meeting_done", "proposal_sent"];
const WIDER_PERMS = ["*", "crm.read", "users.manage"];

function hasWiderView(permissions = []) {
  return permissions.some((p) => WIDER_PERMS.includes(p));
}

module.exports = {
  name: "getLeads",
  permission: "crm.read",
  description:
    "Get CRM leads — prospective clients still in the sales funnel (not yet converted or lost). Use for 'how many leads', 'how many leads do I have', 'show leads', 'leads in proposal stage'. Default scope auto-widens for managers/admins: if you hold crm.read you see ALL leads by default; otherwise only leads assigned to you. Pass scope explicitly to override.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      status: {
        type: "string",
        enum: ["new", "contacted", "meeting_done", "proposal_sent", "all"],
        description: "Filter by funnel status. 'all' = every non-converted, non-lost lead.",
      },
      projectType: {
        type: "string",
        enum: ["Residential", "Commercial"],
      },
      scope: {
        type: "string",
        enum: ["me", "team"],
        description: "'me' = leads explicitly assigned to me. 'team' = all leads I'm allowed to see. Defaults to 'team' for users with crm.read; otherwise 'me'.",
      },
      limit: { type: "integer", minimum: 1, maximum: 50 },
    },
    required: [],
  },

  handler: async (args, ctx) => {
    // Default scope: 'team' if caller has wider perms, else 'me'.
    const canSeeTeam = hasWiderView(ctx.permissions);
    const scope = args.scope || (canSeeTeam ? "team" : "me");
    const limit = Math.min(args.limit || 20, 50);

    const q = {};
    if (scope === "team") {
      if (!canSeeTeam) {
        return {
          ok: false,
          error: "denied",
          summaryText: "You don't have permission to view team-wide leads.",
          uiHint: "error",
        };
      }
    } else {
      q.assignedTo = new mongoose.Types.ObjectId(ctx.userId);
    }

    if (args.status && args.status !== "all") {
      q.status = args.status;
    } else {
      q.status = { $in: LEAD_STATUSES };
    }
    if (args.projectType) q.projectType = args.projectType;

    const leads = await CRMClient.find(q)
      .select("trackingId name phone email projectType area budget city status lifecycleStage priority assignedTo meetingDate updatedAt")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    const assigneeIds = [...new Set(leads.filter((l) => l.assignedTo).map((l) => String(l.assignedTo)))];
    const assignees = assigneeIds.length
      ? await User.find({ _id: { $in: assigneeIds } }).select("name role").lean()
      : [];
    const byId = new Map(assignees.map((u) => [String(u._id), u]));

    const items = leads.map((l) => ({
      id: String(l._id),
      trackingId: l.trackingId,
      name: l.name,
      phone: l.phone,
      email: l.email,
      projectType: l.projectType,
      area: l.area,
      budget: l.budget,
      city: l.city,
      status: l.status,
      lifecycleStage: l.lifecycleStage,
      priority: l.priority,
      assignee: l.assignedTo ? byId.get(String(l.assignedTo)) || null : null,
      meetingDate: l.meetingDate,
      url: `/crm/${statusToTabSlug(l.status)}`,
    }));

    return {
      data: items,
      summaryText:
        items.length === 0
          ? scope === "team" ? "No active leads in the system." : "No leads assigned to you. (Tip: try scope='team' if you can see others'.)"
          : `${items.length} ${scope === "team" ? "" : "of your "}lead${items.length === 1 ? "" : "s"}${scope === "team" ? "" : " (assigned to you)"}`,
      uiHint: "leadList",
      // Include id + trackingId so the model can pass them to write tools
      // (updateLeadStatus, addFollowUp, scheduleMeeting, addLeadNote).
      llmSummary: items.slice(0, 10).map((l) => ({
        id: l.id,
        trackingId: l.trackingId,
        name: l.name,
        status: l.status,
        projectType: l.projectType,
        city: l.city,
        budget: l.budget,
        assignee: l.assignee?.name || null,
      })),
    };
  },
};

function statusToTabSlug(status) {
  switch (status) {
    case "new":           return "new-leads";
    case "contacted":     return "contacted";
    case "meeting_done":  return "meetings";
    case "proposal_sent": return "proposal";
    case "converted":     return "converted";
    case "lost":          return "lost-leads";
    default:              return "new-leads";
  }
}
