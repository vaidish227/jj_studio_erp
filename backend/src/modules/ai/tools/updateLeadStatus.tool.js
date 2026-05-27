// Write tool: change a CRM lead's funnel status. Validates the transition
// against the standard funnel order. Requires crm.update.

const mongoose = require("mongoose");
const CRMClient = require("../../crm/models/CRMClient.model");
const { resolveLead } = require("../utils/resolveCrm");

// Funnel forward path. Backwards transitions are usually noise — we allow
// them only when an admin has crm.update.
const FUNNEL_ORDER = ["new", "contacted", "meeting_done", "proposal_sent", "converted", "lost"];
const TERMINAL = new Set(["converted", "lost"]);

const WIDER_PERMS = ["*", "crm.update"];

function hasWider(permissions = []) {
  return permissions.some((p) => WIDER_PERMS.includes(p));
}

async function loadAndAuthorize(args, ctx) {
  const r = await resolveLead(args.leadId);
  if (r.error) {
    return { error: { ok: false, error: r.candidates ? "ambiguous" : "not_found", summaryText: r.error } };
  }
  const lead = r.doc;

  const isOwner = String(lead.assignedTo || "") === String(ctx.userId);
  const elevated = hasWider(ctx.permissions);
  if (!isOwner && !elevated) {
    return { error: { ok: false, error: "denied",
      summaryText: "Only the assigned salesperson (or admin) can change this lead's status." } };
  }

  if (lead.status === args.status) {
    return { error: { ok: false, error: "no_op", summaryText: `Lead is already "${args.status}".` } };
  }
  if (TERMINAL.has(lead.status) && !elevated) {
    return { error: { ok: false, error: "invalid_transition",
      summaryText: `Lead is "${lead.status}" — only an admin can reopen a closed lead.` } };
  }
  // Forward-only progression unless elevated
  if (!elevated) {
    const fromIdx = FUNNEL_ORDER.indexOf(lead.status);
    const toIdx   = FUNNEL_ORDER.indexOf(args.status);
    if (fromIdx >= 0 && toIdx >= 0 && toIdx < fromIdx && !TERMINAL.has(args.status)) {
      return { error: { ok: false, error: "invalid_transition",
        summaryText: `Cannot move a lead backwards from "${lead.status}" to "${args.status}". Ask an admin.` } };
    }
  }

  return { lead };
}

module.exports = {
  name: "updateLeadStatus",
  permission: "crm.update",
  isWrite: true,
  description:
    "Change a CRM lead's funnel status (new → contacted → meeting_done → proposal_sent → converted/lost). Use when the user says 'mark X as contacted', 'lead Y won', 'lost lead Z'. Non-admins can only move forward in the funnel.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      leadId: {
        type: "string",
        description: "Lead identifier — accepts MongoDB ObjectId (24 hex), trackingId (e.g. CLI-2026-0003), or an unambiguous name fragment ('Ratan Tata').",
        minLength: 2,
        maxLength: 100,
      },
      status: { type: "string", enum: FUNNEL_ORDER },
      note:   { type: "string", maxLength: 500, description: "Optional note (e.g. lost-reason)." },
    },
    required: ["leadId", "status"],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    return {
      ok: true,
      proposalDescription:
        `Move lead "${r.lead.name}" from "${r.lead.status}" → "${args.status}"` +
        (args.note ? ` · note: ${args.note}` : ""),
      args,
      preview: {
        leadName: r.lead.name,
        from: r.lead.status,
        to: args.status,
        note: args.note || null,
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const lead = r.lead;
    const update = { status: args.status };
    if (args.status === "converted") update.lifecycleStage = "converted";
    if (args.status === "lost")      update.lifecycleStage = "lost";

    await CRMClient.updateOne({ _id: lead._id }, { $set: update });

    return {
      ok: true,
      summaryText: `Lead "${lead.name}" is now ${args.status}.`,
      uiHint: "actionDone",
      data: { leadId: String(lead._id), name: lead.name, status: args.status,
              url: `/crm/${statusToTab(args.status)}` },
    };
  },
};

function statusToTab(status) {
  return ({
    new: "new-leads",
    contacted: "contacted",
    meeting_done: "meetings",
    proposal_sent: "proposal",
    converted: "converted",
    lost: "lost-leads",
  })[status] || "new-leads";
}
