// Write tool: send an existing manager-approved Proposal to the client by email.
// Mirrors the manual "Send to Client" button in ReviewPage.jsx and the
// POST /proposal/send/:id route. Does NOT create or approve proposals —
// those steps still happen in the proposal dashboard.

const Proposal = require("../../crm/models/Proposal.model");
const { triggerSendToClient } = require("../../crm/controllers/Proposal.controller");
const { resolveLead } = require("../utils/resolveCrm");
const { dispatch: notify } = require("../../notifications/services/notificationDispatcher");

const WIDER_PERMS = ["*", "crm.update"];

// Sendable from these statuses. `manager_approved` is the canonical case;
// the others are re-sends (already-sent proposals the user wants to resend).
const SENDABLE = new Set(["manager_approved", "sent", "esign_received"]);

// Non-sendable statuses get a tailored error explaining the workflow.
const STATUS_HINT = {
  draft:                "Proposal is still a draft. Submit it for manager approval first (in the proposal dashboard).",
  pending_approval:     "Proposal is awaiting manager approval — it can't be sent to the client until a manager approves it.",
  revision_requested:   "Manager requested revisions on this proposal. Edit it and resubmit for approval.",
  rejected:             "Proposal was rejected by the manager. Create a new version instead.",
  payment_received:     "Proposal has already moved past 'sent' (payment received) — re-sending isn't supported here.",
  project_ready:        "Proposal has already moved past 'sent' (project is ready) — re-sending isn't supported here.",
  project_started:      "Proposal has already moved past 'sent' (project has started) — re-sending isn't supported here.",
};

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
      summaryText: "Only the assigned salesperson (or admin) can send a proposal for this lead." } };
  }
  if (!lead.email) {
    return { error: { ok: false, error: "invalid_args",
      summaryText: `Lead "${lead.name}" has no email on file — add one before sending a proposal.` } };
  }

  // Find the proposal to send. Either explicit proposalId, or the most-recent
  // sendable proposal for the lead.
  let proposal = null;
  if (args.proposalId) {
    proposal = await Proposal.findOne({ _id: args.proposalId, leadId: lead._id }).populate("leadId", "name email phone trackingId");
    if (!proposal) {
      return { error: { ok: false, error: "not_found",
        summaryText: `No proposal with id ${args.proposalId} exists for lead "${lead.name}".` } };
    }
  } else {
    proposal = await Proposal.findOne({ leadId: lead._id })
      .sort({ createdAt: -1 })
      .populate("leadId", "name email phone trackingId");
    if (!proposal) {
      return { error: { ok: false, error: "not_found",
        summaryText: `No proposal exists for lead "${lead.name}" yet. Use createAndSendProposal to author and send a new one in this conversation, or create one in the proposal dashboard.` } };
    }
  }

  if (!SENDABLE.has(proposal.status)) {
    const hint = STATUS_HINT[proposal.status] || `Proposal status is "${proposal.status}" — not sendable.`;
    return { error: { ok: false, error: "invalid_state", summaryText: hint } };
  }

  return { lead, proposal };
}

module.exports = {
  name: "sendProposal",
  permission: "crm.update",
  isWrite: true,
  description:
    "Send an existing, manager-approved Proposal to a lead by email. Use for 'send the proposal to Maya Patel', 'email the approved proposal to lead X'. Requires the proposal to already exist and have status 'manager_approved' (or 'sent'/'esign_received' for re-sends). Does NOT create proposals — the user must author them in the proposal dashboard first. If the lead has multiple proposals and no proposalId is given, the most recent sendable one is used.",
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
      proposalId: {
        type: "string",
        description: "Optional: specific Proposal ObjectId to send. If omitted, sends the most-recent sendable proposal for the lead.",
        minLength: 24,
        maxLength: 24,
      },
    },
    required: ["leadId"],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const p = r.proposal;
    const amount = typeof p.finalAmount === "number" && p.finalAmount > 0
      ? `₹${p.finalAmount.toLocaleString("en-IN")}`
      : "no amount set";
    const resend = p.status !== "manager_approved" ? " (RE-SEND — already sent before)" : "";
    return {
      ok: true,
      proposalDescription:
        `Send proposal "${p.title}" (${amount}) to ${r.lead.email} for "${r.lead.name}" (${r.lead.trackingId})${resend}`,
      args,
      preview: {
        proposalId: String(p._id),
        proposalTitle: p.title,
        proposalStatus: p.status,
        finalAmount: p.finalAmount,
        leadName: r.lead.name,
        leadTrackingId: r.lead.trackingId,
        recipientEmail: r.lead.email,
        isResend: p.status !== "manager_approved",
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const p = r.proposal;

    await triggerSendToClient(p);

    p.status = "sent";
    p.sentAt = new Date();
    p.approvalHistory = p.approvalHistory || [];
    p.approvalHistory.push({
      action: "sent",
      performedBy: ctx.userId,
      remarks: "Sent via AI assistant",
      timestamp: new Date(),
    });
    await p.save();

    notify({
      type: "proposal.sent",
      module: "proposal",
      priority: "normal",
      title: `Proposal sent to ${r.lead.name}`,
      message: p.title ? `"${p.title}" delivered to ${r.lead.email} (via AI assistant).` : "Proposal delivered to client.",
      link: `/proposal/review/${p._id}`,
      recipients: p.createdBy ? [p.createdBy] : [],
      actor: { _id: ctx.userId, name: ctx.userName || "AI Assistant" },
      notifyActor: true,
      relatedTo: { module: "proposal", recordId: p._id },
      metadata: { leadName: r.lead.name, viaAI: true },
    });

    return {
      ok: true,
      summaryText: `Proposal "${p.title}" sent to ${r.lead.email} for ${r.lead.name}.`,
      uiHint: "actionDone",
      data: {
        proposalId: String(p._id),
        leadId: String(r.lead._id),
        leadName: r.lead.name,
        recipientEmail: r.lead.email,
        title: p.title,
        finalAmount: p.finalAmount,
        sentAt: p.sentAt,
        url: "/crm/proposal",
      },
    };
  },
};
