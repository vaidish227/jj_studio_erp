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
    "Get CRM leads — prospective clients still in the sales funnel (not yet converted or lost). Use for 'how many leads', 'how many leads do I have', 'show leads', 'leads in proposal stage'. Pass `q` to search by name/phone/email fragment (e.g. q='nidhi' finds leads named Nidhi). Default scope auto-widens for managers/admins: if you hold crm.read you see ALL leads by default; otherwise only leads assigned to you. Pass scope explicitly to override.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      q: {
        type: "string",
        description: "Case-insensitive search across name, phone, and email. Use for 'find Nidhi', 'show lead with phone 99...', 'search abc@gmail.com'. When set, status/projectType filters still apply but scope defaults to 'team' (so name searches don't miss leads assigned to others).",
        minLength: 1,
        maxLength: 80,
      },
      status: {
        type: "string",
        enum: ["new", "contacted", "meeting_done", "proposal_sent", "all"],
        description: "Filter by funnel status. 'all' = every non-converted, non-lost lead.",
      },
      projectType: {
        type: "string",
        enum: ["Residential", "Commercial", "none"],
        description: "Filter by project type. 'none' = leads with no project type saved (missing/empty). Use for 'leads without a project type', 'jinke project type nahi hai'.",
      },
      city: {
        type: "string",
        description: "Filter by city. Case-insensitive exact match. Use for 'leads from Mumbai', 'Indore ke leads'. Combine with projectType for 'residential leads from Mumbai'.",
        minLength: 1,
        maxLength: 80,
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
    const searchMode = typeof args.q === "string" && args.q.trim().length > 0;
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
    if (args.projectType === "none") {
      // Matches null, empty string, AND documents where the field is absent.
      q.projectType = { $in: [null, ""] };
    } else if (args.projectType) {
      q.projectType = args.projectType;
    }

    if (typeof args.city === "string" && args.city.trim().length > 0) {
      const cityNeedle = args.city.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Case-insensitive exact match — data has mixed casing (Indore/indore, Bhopal/bhople).
      q.city = new RegExp(`^${cityNeedle}$`, "i");
    }

    if (searchMode) {
      const needle = args.q.trim();
      const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      q.$or = [{ name: re }, { phone: re }, { email: re }, { trackingId: re }];
    }

    const [leads, total] = await Promise.all([
      CRMClient.find(q)
        .select("trackingId name phone email projectType area budget city status lifecycleStage priority assignedTo meetingDate updatedAt")
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean(),
      CRMClient.countDocuments(q),
    ]);

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

    const viewAllUrl = args.status && args.status !== "all"
      ? `/crm/${statusToTabSlug(args.status)}`
      : `/crm/new-leads`;
    const truncated = total > items.length;
    const ownership = scope === "team" ? "" : "your ";
    const trailing = scope === "team" ? "" : " (assigned to you)";

    let summaryText;
    if (items.length === 0) {
      if (searchMode) {
        summaryText = scope === "team"
          ? `No active leads match "${args.q}". (They may be converted/lost — pass status='all' to widen.)`
          : `No leads match "${args.q}" assigned to you. (Tip: try scope='team' if you can see others'.)`;
      } else {
        const filterBits = [];
        if (args.projectType && args.projectType !== "none") filterBits.push(args.projectType);
        if (args.city && args.city.trim()) filterBits.push(`in ${args.city.trim()}`);
        const filterDesc = filterBits.length ? ` ${filterBits.join(" ")}` : "";
        summaryText = scope === "team"
          ? `No active${filterDesc} leads in the system.`
          : `No${filterDesc} leads assigned to you. (Tip: try scope='team' if you can see others'.)`;
      }
    } else if (truncated) {
      summaryText = `Showing ${items.length} of ${total} ${ownership}leads${trailing}`;
    } else {
      summaryText = `${total} ${ownership}lead${total === 1 ? "" : "s"}${trailing}`;
    }

    return {
      data: items,
      total,
      shown: items.length,
      viewAllUrl,
      summaryText,
      uiHint: "leadList",
      // The model reads llmSummary to reason about specific leads AND to know the
      // real total — never claim "Total: N" using items.length alone.
      llmSummary: {
        total,
        shown: items.length,
        truncated,
        viewAllUrl,
        items: items.slice(0, 10).map((l) => ({
          id: l.id,
          trackingId: l.trackingId,
          name: l.name,
          phone: l.phone,
          email: l.email,
          status: l.status,
          projectType: l.projectType,
          city: l.city,
          budget: l.budget,
          assignee: l.assignee?.name || null,
        })),
      },
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
