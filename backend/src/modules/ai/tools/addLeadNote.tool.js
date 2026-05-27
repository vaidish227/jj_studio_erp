// Write tool: append a note to a CRM lead's interactionHistory. Distinct
// from addTaskNote (which is for PMS tasks). Uses the CRMClient's
// interactionHistory[] event-sourced log with type='note'.

const CRMClient = require("../../crm/models/CRMClient.model");
const User = require("../../auth/models/user.model");
const { resolveLead } = require("../utils/resolveCrm");

const WIDER_PERMS = ["*", "crm.update"];

async function loadAndAuthorize(args, ctx) {
  const r = await resolveLead(args.leadId);
  if (r.error) {
    return { error: { ok: false, error: r.candidates ? "ambiguous" : "not_found", summaryText: r.error } };
  }
  const lead = r.doc;
  const isOwner = String(lead.assignedTo || "") === String(ctx.userId);
  const elevated = (ctx.permissions || []).some((p) => WIDER_PERMS.includes(p));
  if (!isOwner && !elevated) {
    return { error: { ok: false, error: "denied",
      summaryText: "Only the assigned salesperson (or admin) can add notes to this lead." } };
  }
  return { lead };
}

module.exports = {
  name: "addLeadNote",
  permission: "crm.update",
  isWrite: true,
  description:
    "Append a note to a CRM LEAD or CLIENT (NOT a task — use addTaskNote for PMS tasks). The note is recorded on the lead's interaction history with the current user + timestamp. Use for 'add note on Ratan Tata: client called about budget', 'jot down that we offered a discount'.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      leadId: {
        type: "string",
        description: "Lead identifier — accepts ObjectId, trackingId (CLI-YYYY-NNNN), or an unambiguous name fragment.",
        minLength: 2,
        maxLength: 100,
      },
      note: { type: "string", minLength: 2, maxLength: 2000 },
      title: { type: "string", maxLength: 120, description: "Optional short subject for the note." },
    },
    required: ["leadId", "note"],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    return {
      ok: true,
      proposalDescription:
        `Add note to lead "${r.lead.name}" (${r.lead.trackingId}): "${args.note.slice(0, 160)}${args.note.length > 160 ? "…" : ""}"`,
      args,
      preview: {
        leadName: r.lead.name,
        trackingId: r.lead.trackingId,
        title: args.title || null,
        note: args.note,
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const me = await User.findById(ctx.userId).select("name").lean();
    const authorName = me?.name || ctx.email || "Unknown user";

    const entry = {
      type: "note",
      title: args.title || "Note (via AI)",
      description: `[${authorName} via AI] ${args.note}`,
      metadata: { authorId: ctx.userId, viaAI: true },
      createdAt: new Date(),
    };

    await CRMClient.updateOne(
      { _id: r.lead._id },
      { $push: { interactionHistory: entry } }
    );

    return {
      ok: true,
      summaryText: `Note added to lead "${r.lead.name}".`,
      uiHint: "actionDone",
      data: {
        leadId: String(r.lead._id),
        trackingId: r.lead.trackingId,
        name: r.lead.name,
        url: `/crm/clients`,
      },
    };
  },
};
