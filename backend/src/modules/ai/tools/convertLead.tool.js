// Write tool: convert a CRM lead to a client (status=converted,
// lifecycleStage=converted). Mirrors convertClient controller. Distinct from
// updateLeadStatus(status='converted') in that it appends a converted-specific
// timeline event and refuses if already converted.

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
      summaryText: "Only the assigned salesperson (or admin) can convert this lead." } };
  }
  if (lead.status === "converted") {
    return { error: { ok: false, error: "no_op", uiHint: "error",
      summaryText: `Lead "${lead.name}" is already converted.` } };
  }
  if (lead.status === "lost") {
    return { error: { ok: false, error: "invalid_transition", uiHint: "error",
      summaryText: `Lead "${lead.name}" is marked lost — reopen it before converting.` } };
  }
  return { lead };
}

module.exports = {
  name: "convertLead",
  permission: "crm.update",
  isWrite: true,
  description:
    "Convert a CRM lead to a client (sets status=converted, lifecycleStage=converted). Use for 'convert lead X', 'mark Ratan Tata as won', 'X is now a client'. Refuses if already converted or lost.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      leadId: {
        type: "string",
        description: "Lead identifier — ObjectId, trackingId (CLI-YYYY-NNNN), or unambiguous name fragment.",
        minLength: 2,
        maxLength: 100,
      },
      note: { type: "string", maxLength: 500, description: "Optional note recorded on the conversion event." },
    },
    required: ["leadId"],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    return {
      ok: true,
      proposalDescription:
        `Convert lead "${r.lead.name}" (${r.lead.trackingId}) — status "${r.lead.status}" → "converted"` +
        (args.note ? ` · note: ${args.note.slice(0, 120)}` : ""),
      args,
      preview: {
        leadName: r.lead.name,
        trackingId: r.lead.trackingId,
        from: r.lead.status,
        to: "converted",
        note: args.note || null,
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;

    await CRMClient.updateOne(
      { _id: r.lead._id },
      {
        $set: { status: "converted", lifecycleStage: "converted" },
        $push: {
          interactionHistory: {
            type: "status_change",
            title: "Client converted",
            description: args.note || "Client moved into the converted/project-ready stage.",
            createdAt: new Date(),
          },
        },
        $currentDate: { lastInteractionAt: true },
      }
    );

    return {
      ok: true,
      summaryText: `"${r.lead.name}" (${r.lead.trackingId}) is now converted.`,
      uiHint: "actionDone",
      data: {
        leadId: String(r.lead._id),
        trackingId: r.lead.trackingId,
        name: r.lead.name,
        status: "converted",
        url: `/crm/converted`,
      },
    };
  },
};
