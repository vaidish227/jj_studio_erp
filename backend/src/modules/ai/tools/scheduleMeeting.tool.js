// Write tool: schedule a Meeting on a CRM lead. Creates a Meeting doc.
// Distinct from addFollowUp (which is a lighter reminder) — meetings are
// first-class objects in the CRM with type, duration, status, outcome.

const mongoose = require("mongoose");
const Meeting = require("../../crm/models/Metting.model");
const User = require("../../auth/models/user.model");
const { resolveLead } = require("../utils/resolveCrm");

const WIDER_PERMS = ["*", "crm.update", "crm.create"];

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
      summaryText: "Only the assigned salesperson (or admin) can schedule meetings for this lead." } };
  }

  const d = new Date(args.date);
  if (Number.isNaN(d.getTime())) {
    return { error: { ok: false, error: "invalid_args", summaryText: "Invalid meeting date." } };
  }
  if (d < new Date(Date.now() - 60_000)) {
    return { error: { ok: false, error: "invalid_args", summaryText: "Meeting date must be in the future." } };
  }
  return { lead, date: d };
}

module.exports = {
  name: "scheduleMeeting",
  permission: "crm.update",
  isWrite: true,
  description:
    "Schedule a new meeting (call, in-office, or site visit) with a CRM lead. Creates a Meeting record. Use for 'schedule a meeting with Ratan Tata on 30 May at 10am', 'set up a site visit for tomorrow', 'book a call'. For lighter reminders use addFollowUp instead.",
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
      // Accept any string — we parse it in dryRun. ajv's strict 'date-time'
      // format requires full RFC3339 with timezone (e.g. '2026-06-05T10:00:00Z'),
      // but the model commonly produces '2026-06-05T10:00:00'. Be lenient.
      date: {
        type: "string",
        minLength: 8,
        maxLength: 64,
        description: "Datetime of the meeting — any parseable form (e.g. '2026-06-05T10:00:00', '2026-06-05 10:00', 'June 5 2026 10am'). No timezone needed — defaults to server local time.",
      },
      type: {
        type: "string",
        enum: ["call", "office", "site"],
        description: "'call' = phone/video. 'office' = at JJ Studio. 'site' = at the client's site.",
      },
      durationMinutes: { type: "integer", minimum: 15, maximum: 480, description: "Default 60." },
      notes: { type: "string", maxLength: 1000 },
    },
    required: ["leadId", "date", "type"],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const when = r.date.toLocaleString();
    const dur = args.durationMinutes || 60;
    return {
      ok: true,
      proposalDescription:
        `Schedule a ${args.type} meeting with "${r.lead.name}" (${r.lead.trackingId}) on ${when} for ${dur} min` +
        (args.notes ? ` · notes: ${args.notes.slice(0, 120)}` : ""),
      args,
      preview: {
        leadName: r.lead.name,
        trackingId: r.lead.trackingId,
        date: r.date,
        type: args.type,
        durationMinutes: dur,
        notes: args.notes || null,
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;

    const meeting = await Meeting.create({
      leadId: r.lead._id,
      date: r.date,
      type: args.type,
      durationMinutes: args.durationMinutes || 60,
      notes: args.notes || "",
      status: "scheduled",
      assignedTo: r.lead.assignedTo || ctx.userId,
      createdBy: ctx.userId,
    });

    return {
      ok: true,
      summaryText: `Meeting scheduled with ${r.lead.name} on ${r.date.toLocaleDateString()} at ${r.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
      uiHint: "actionDone",
      data: {
        meetingId: String(meeting._id),
        leadId: String(r.lead._id),
        leadName: r.lead.name,
        date: r.date,
        type: args.type,
        url: "/crm/meetings",
      },
    };
  },
};
