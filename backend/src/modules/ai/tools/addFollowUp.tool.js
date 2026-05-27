// Write tool: schedule a follow-up on a CRM lead. Creates a new FollowUp
// document linked back to the lead.

const mongoose = require("mongoose");
const FollowUp = require("../../crm/models/FollowUp.model");
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
      summaryText: "Only the assigned salesperson (or admin) can add a follow-up to this lead." } };
  }

  const d = new Date(args.date);
  if (Number.isNaN(d.getTime())) {
    return { error: { ok: false, error: "invalid_args", summaryText: "Invalid follow-up date." } };
  }
  return { lead, date: d };
}

module.exports = {
  name: "addFollowUp",
  permission: "crm.update",
  isWrite: true,
  description:
    "Schedule a new follow-up on a CRM lead. Creates a FollowUp record with a date, optional note, and optional next-follow-up date. Use for 'add follow-up for tomorrow on lead X', 'remind me to call X next week'.",
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
      // Lenient date parsing — see scheduleMeeting for rationale.
      date: {
        type: "string",
        minLength: 8,
        maxLength: 64,
        description: "Datetime of the follow-up — any parseable form (e.g. '2026-06-05T10:00:00', '2026-06-05 10:00', 'tomorrow 3pm').",
      },
      note: { type: "string", maxLength: 1000 },
      nextFollowupDate: { type: "string", minLength: 8, maxLength: 64 },
    },
    required: ["leadId", "date"],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const when = r.date.toLocaleString();
    return {
      ok: true,
      proposalDescription:
        `Add follow-up on lead "${r.lead.name}" for ${when}` +
        (args.note ? ` · note: ${args.note.slice(0, 120)}` : ""),
      args,
      preview: {
        leadName: r.lead.name,
        date: r.date,
        note: args.note || null,
        nextFollowupDate: args.nextFollowupDate || null,
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;

    const followup = await FollowUp.create({
      leadId: r.lead._id,
      date: r.date,
      note: args.note || "",
      nextFollowupDate: args.nextFollowupDate ? new Date(args.nextFollowupDate) : null,
      status: "pending",
      assignedTo: r.lead.assignedTo || ctx.userId,
    });

    return {
      ok: true,
      summaryText: `Added follow-up on "${r.lead.name}" for ${r.date.toLocaleDateString()}.`,
      uiHint: "actionDone",
      data: { followupId: String(followup._id), leadId: String(r.lead._id), leadName: r.lead.name,
              date: r.date, url: "/crm/follow-ups" },
    };
  },
};
