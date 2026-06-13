// Tool: get converted CRM clients (deals that closed). Used to answer
// "how many clients", "show clients in Bandra", "clients with active projects".

const mongoose = require("mongoose");
const CRMClient = require("../../crm/models/CRMClient.model");

const WIDER_PERMS = ["*", "crm.read", "clients.read"];

function hasWiderView(permissions = []) {
  return permissions.some((p) => WIDER_PERMS.includes(p));
}

module.exports = {
  name: "getClients",
  permission: "clients.read",
  description:
    "Get converted CRM clients (deals that closed — status 'converted'). Use for 'how many clients', 'show clients in Mumbai', 'residential clients'. Default scope auto-widens for managers/admins: if you hold crm.read or clients.read you see ALL clients by default.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      city: { type: "string", description: "Case-insensitive city filter." },
      projectType: {
        type: "string",
        enum: ["Residential", "Commercial", "none"],
        description: "Filter by project type. 'none' = clients with no project type saved (missing/empty).",
      },
      scope: {
        type: "string",
        enum: ["me", "team"],
        description: "'me' = clients explicitly assigned to me. 'team' = all clients I'm allowed to see. Defaults to 'team' for users with crm.read/clients.read; otherwise 'me'.",
      },
      limit: { type: "integer", minimum: 1, maximum: 50 },
    },
    required: [],
  },

  handler: async (args, ctx) => {
    const canSeeTeam = hasWiderView(ctx.permissions);
    const scope = args.scope || (canSeeTeam ? "team" : "me");
    const limit = Math.min(args.limit || 20, 50);

    const q = { status: "converted" };
    if (scope === "team") {
      if (!canSeeTeam) {
        return {
          ok: false,
          error: "denied",
          summaryText: "You don't have permission to view all clients.",
          uiHint: "error",
        };
      }
    } else {
      q.assignedTo = new mongoose.Types.ObjectId(ctx.userId);
    }

    if (args.city) q.city = { $regex: String(args.city).slice(0, 60), $options: "i" };
    if (args.projectType === "none") {
      // Matches null, empty string, AND documents where the field is absent.
      q.projectType = { $in: [null, ""] };
    } else if (args.projectType) {
      q.projectType = args.projectType;
    }

    const clients = await CRMClient.find(q)
      .select("trackingId name phone email projectType area budget city updatedAt")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    const items = clients.map((c) => ({
      id: String(c._id),
      trackingId: c.trackingId,
      name: c.name,
      phone: c.phone,
      email: c.email,
      projectType: c.projectType,
      area: c.area,
      budget: c.budget,
      city: c.city,
      url: `/crm/clients`,
    }));

    return {
      data: items,
      summaryText:
        items.length === 0
          ? "No converted clients found."
          : `${items.length} client${items.length === 1 ? "" : "s"}`,
      uiHint: "clientList",
      llmSummary: items.slice(0, 10).map((c) => ({
        id: c.id,
        trackingId: c.trackingId,
        name: c.name,
        projectType: c.projectType,
        city: c.city,
        budget: c.budget,
      })),
    };
  },
};
