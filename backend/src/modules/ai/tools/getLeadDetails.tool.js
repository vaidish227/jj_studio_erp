// Tool: get full details for a single CRM lead — basic info, project info,
// status, timeline, communication logs, advance payment. Use when the user
// asks "open lead X", "show me everything about CLI-2026-0003", etc.

const CRMClient = require("../../crm/models/CRMClient.model");
const User = require("../../auth/models/user.model");
const { resolveLead } = require("../utils/resolveCrm");

const WIDER_PERMS = ["*", "crm.read", "users.manage"];

function hasWider(permissions = []) {
  return permissions.some((p) => WIDER_PERMS.includes(p));
}

module.exports = {
  name: "getLeadDetails",
  permission: "crm.read",
  description:
    "Get full details for a single CRM lead/client — contact info, project info, status, lifecycle, recent timeline, advance payment, assignee. Use for 'show details for lead X', 'open Ratan Tata's profile', 'tell me about CLI-2026-0003'. Accepts ObjectId, trackingId, or unambiguous name fragment.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      leadId: {
        type: "string",
        description: "Lead identifier — ObjectId (24 hex), trackingId (CLI-YYYY-NNNN), or an unambiguous name fragment.",
        minLength: 2,
        maxLength: 100,
      },
      historyLimit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        description: "How many recent timeline events to return (default 10).",
      },
    },
    required: ["leadId"],
  },

  handler: async (args, ctx) => {
    const r = await resolveLead(args.leadId);
    if (r.error) {
      return {
        ok: false,
        error: r.candidates ? "ambiguous" : "not_found",
        summaryText: r.error,
        uiHint: "error",
      };
    }

    const lead = await CRMClient.findById(r.doc._id).lean();
    if (!lead) {
      return { ok: false, error: "not_found", summaryText: `Lead not found.`, uiHint: "error" };
    }

    const isOwner = String(lead.assignedTo || "") === String(ctx.userId);
    if (!isOwner && !hasWider(ctx.permissions)) {
      return {
        ok: false,
        error: "denied",
        summaryText: "You don't have permission to view this lead.",
        uiHint: "error",
      };
    }

    let assignee = null;
    if (lead.assignedTo) {
      const u = await User.findById(lead.assignedTo).select("name role email").lean();
      if (u) assignee = { id: String(u._id), name: u.name, role: u.role, email: u.email };
    }

    const historyLimit = Math.min(args.historyLimit || 10, 50);
    const history = (lead.interactionHistory || [])
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, historyLimit)
      .map((h) => ({
        type: h.type,
        title: h.title,
        description: h.description,
        createdAt: h.createdAt,
      }));

    const data = {
      id: String(lead._id),
      trackingId: lead.trackingId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email || null,
      projectType: lead.projectType || null,
      area: lead.area || null,
      budget: lead.budget || null,
      city: lead.city || null,
      source: lead.source,
      priority: lead.priority,
      status: lead.status,
      lifecycleStage: lead.lifecycleStage,
      siteAddress: lead.siteAddress || null,
      spouse: lead.spouse || null,
      referredBy: lead.referredBy || null,
      referrerPhone: lead.referrerPhone || null,
      notes: lead.notes || null,
      assignee,
      advancePayment: lead.advancePayment || null,
      clientInfoCompleted: !!lead.clientInfoCompleted,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      lastInteractionAt: lead.lastInteractionAt || null,
      history,
      url: `/crm/lead/${lead._id}`,
    };

    const summaryText =
      `${lead.name} (${lead.trackingId}) — ${lead.status}, ${lead.projectType || "no project type"}` +
      (lead.budget ? `, budget ${lead.budget}` : "") +
      (lead.city ? `, ${lead.city}` : "") +
      (assignee ? `. Assigned to ${assignee.name}.` : ". Unassigned.");

    return {
      data,
      summaryText,
      uiHint: "leadDetails",
      llmSummary: {
        id: data.id,
        trackingId: data.trackingId,
        name: data.name,
        phone: data.phone,
        email: data.email,
        status: data.status,
        lifecycleStage: data.lifecycleStage,
        projectType: data.projectType,
        budget: data.budget,
        city: data.city,
        priority: data.priority,
        assignee: assignee?.name || null,
        advancePaid: !!data.advancePayment?.received,
        advanceAmount: data.advancePayment?.amount || null,
        recentEvents: history.slice(0, 5).map((h) => ({ when: h.createdAt, title: h.title })),
      },
    };
  },
};
