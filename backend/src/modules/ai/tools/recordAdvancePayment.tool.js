// Write tool: record an advance payment on a CRM lead. Mirrors
// recordAdvancePayment controller — sets status=converted,
// lifecycleStage=project_moved, marks ready for PMS handoff.

const CRMClient = require("../../crm/models/CRMClient.model");
const { resolveLead } = require("../utils/resolveCrm");

const WIDER_PERMS = ["*", "crm.update"];

async function loadAndAuthorize(args, ctx) {
  const r = await resolveLead(args.leadId);
  if (r.error) {
    return { error: { ok: false, error: r.candidates ? "ambiguous" : "not_found", summaryText: r.error, uiHint: "error" } };
  }
  const lead = r.doc;
  const isOwner = String(lead.assignedTo || "") === String(ctx.userId);
  const elevated = (ctx.permissions || []).some((p) => WIDER_PERMS.includes(p));
  if (!isOwner && !elevated) {
    return { error: { ok: false, error: "denied", uiHint: "error",
      summaryText: "Only the assigned salesperson (or admin) can record advance payment for this lead." } };
  }
  if (lead.advancePayment?.received) {
    return { error: { ok: false, error: "no_op", uiHint: "error",
      summaryText: `Advance already recorded for "${lead.name}" (₹${lead.advancePayment.amount || "?"}).` } };
  }

  let receivedAt = null;
  if (args.receivedAt) {
    const d = new Date(args.receivedAt);
    if (Number.isNaN(d.getTime())) {
      return { error: { ok: false, error: "invalid_args", uiHint: "error",
        summaryText: `Invalid receivedAt date: ${args.receivedAt}.` } };
    }
    receivedAt = d;
  }
  return { lead, receivedAt };
}

module.exports = {
  name: "recordAdvancePayment",
  permission: "crm.update",
  isWrite: true,
  description:
    "Record an advance payment received from a CRM lead. Sets status=converted and lifecycleStage=project_moved (ready for project management handoff). Use for 'record 5L advance for X', 'X has paid advance of 2 lakh today'. Refuses if advance is already recorded.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      leadId: {
        type: "string",
        description: "Lead identifier — ObjectId, trackingId, or unambiguous name fragment.",
        minLength: 2,
        maxLength: 100,
      },
      amount: { type: "number", minimum: 1, description: "Advance amount in rupees." },
      note:   { type: "string", maxLength: 500 },
      receivedAt: { type: "string", minLength: 8, maxLength: 64,
        description: "Optional date the advance was received. Any parseable form. Defaults to now." },
    },
    required: ["leadId", "amount"],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const when = (r.receivedAt || new Date()).toLocaleDateString();
    return {
      ok: true,
      proposalDescription:
        `Record advance payment ₹${args.amount} for "${r.lead.name}" (${r.lead.trackingId}) on ${when}` +
        (args.note ? ` · note: ${args.note.slice(0, 120)}` : "") +
        ` — lead will be marked converted & moved to PMS.`,
      args,
      preview: {
        leadName: r.lead.name,
        trackingId: r.lead.trackingId,
        amount: args.amount,
        receivedAt: r.receivedAt || new Date(),
        note: args.note || null,
        newStatus: "converted",
        newLifecycle: "project_moved",
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;

    const receivedAt = r.receivedAt || new Date();
    await CRMClient.updateOne(
      { _id: r.lead._id },
      {
        $set: {
          status: "converted",
          lifecycleStage: "project_moved",
          advancePayment: {
            received: true,
            amount: args.amount,
            note: args.note || "",
            receivedAt,
            movedToProjectManagement: true,
            movedAt: new Date(),
          },
        },
        $push: {
          interactionHistory: {
            type: "advance_payment",
            title: "Advance payment received",
            description: args.note || "Advance payment recorded and marked ready for project management handoff.",
            metadata: { amount: args.amount, receivedAt },
            createdAt: new Date(),
          },
        },
        $currentDate: { lastInteractionAt: true },
      }
    );

    return {
      ok: true,
      summaryText: `Recorded ₹${args.amount} advance from "${r.lead.name}" — lead is now converted and ready for PMS.`,
      uiHint: "actionDone",
      data: {
        leadId: String(r.lead._id),
        trackingId: r.lead.trackingId,
        name: r.lead.name,
        amount: args.amount,
        receivedAt,
        status: "converted",
        url: `/crm/converted`,
      },
    };
  },
};
