// Write tool: drive a proposal through its lifecycle (the canonical
// updateProposalStatus engine). Replicates Proposal.controller.js's
// updateProposalStatus side-effects exactly, reusing the exported
// triggerSendToClient helper — we intentionally mirror the controller rather
// than refactor it, to keep the live UI path untouched.
//
// HEAVY side-effects the dryRun card MUST surface:
//   • manager_approved → emails + WhatsApps the client (with PDF), then → sent
//   • signed / project_started → converts the client + auto-creates a PMS project
//   • esign_received / payment_received → may auto-advance to project_ready

const Proposal = require("../../crm/models/Proposal.model");
const CRMClient = require("../../crm/models/CRMClient.model");
const Project = require("../../pms/models/Project.model");
const { triggerSendToClient } = require("../../crm/controllers/Proposal.controller");
const { dispatch: notify } = require("../../notifications/services/notificationDispatcher");
const { resolveProposal } = require("../utils/resolveCrm");

const WIDER_PERMS = ["*", "crm.update"];
const STATUSES = [
  "draft", "pending_approval", "revision_requested", "manager_approved",
  "sent", "esign_received", "payment_received", "project_ready",
  "rejected", "project_started", "signed",
];
const PAYMENT_METHODS = ["cash", "upi", "bank", "bank_transfer", "cheque", "card"];

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// Parse a date string, treating a bare YYYY-MM-DD as IST midnight (this ERP is
// India-only; a naive date would otherwise slip by 5.5h on a UTC server).
function parseIstDate(s) {
  if (!s) return null;
  const str = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T00:00:00+05:30`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Mirror of the controller's project auto-creation + client conversion.
async function autoCreateProjectFromProposal(updatedProposal, proposalId) {
  const targetClientId = updatedProposal.leadId?._id || updatedProposal.leadId;
  await CRMClient.findByIdAndUpdate(targetClientId, { lifecycleStage: "converted", status: "converted" });

  try {
    const existingProject = await Project.findOne({ proposalId });
    if (existingProject) return null;

    const client = await CRMClient.findById(targetClientId);
    const year = new Date().getFullYear();
    const count = (await Project.countDocuments()) + 1;
    const trackingId = `PRJ-${year}-${String(count).padStart(4, "0")}`;
    const siteAddr = client?.siteAddress || {};
    const fullAddress = siteAddr.fullAddress || (client?.address ? String(client.address) : "") || "TBD";

    const project = await Project.create({
      clientId: targetClientId,
      proposalId,
      trackingId,
      name: updatedProposal.title || `${client?.name || "Client"} — Interior Project`,
      projectType: client?.projectType || "Residential",
      siteAddress: {
        fullAddress,
        buildingName: siteAddr.buildingName || "",
        tower: siteAddr.tower || "",
        unit: siteAddr.unit || "",
        floor: siteAddr.floor || "",
        city: siteAddr.city || client?.city || "",
      },
      area: client?.area || null,
      budget: updatedProposal.finalAmount || client?.budget || null,
      status: "design_phase",
      notes: `Auto-created from Proposal: ${updatedProposal.title}. Final amount: ${inr(updatedProposal.finalAmount)}.`,
    });

    await CRMClient.findByIdAndUpdate(targetClientId, { $addToSet: { linkedProjects: project._id } });
    return { id: String(project._id), trackingId: project.trackingId, name: project.name };
  } catch (e) {
    console.error("[updateProposalStatus tool] auto-create project:", e.message);
    return null;
  }
}

// Replicates the controller body. Returns the updated proposal + delivery
// telemetry + any auto-created project.
async function runStatusChange(proposalId, body, actor) {
  const { status, remarks } = body;
  const proposal = await Proposal.findById(proposalId);
  if (!proposal) return { error: "not_found" };

  const updateObj = { $set: { status } };
  const historyItem = { action: status, performedBy: actor.userId, remarks: remarks || "", timestamp: new Date() };

  if (status === "manager_approved") {
    updateObj.$set.approved_by = actor.userId;
    updateObj.$set.approved_at = new Date();
  } else if (status === "revision_requested") {
    updateObj.$set.revisionReason = remarks || "Revision required";
    updateObj.$set.revisionRequestedBy = actor.userId;
    updateObj.$set.revisionRequestedAt = new Date();
  } else if (status === "rejected") {
    updateObj.$set.rejected_by = actor.userId;
    updateObj.$set.rejection_reason = remarks || "No reason provided";
  } else if (status === "signed") {
    updateObj.$set.esign = { status: "received", signed_at: new Date() };
    if (body.advancePayment) {
      const ap = body.advancePayment;
      updateObj.$set.advancePayment = {
        amount: ap.amount || 0,
        paidBy: ap.paidBy || "",
        // Schema field is `paymentMethod` — writing `method` is silently dropped
        // by strict mode (matches Proposal.controller.js's `paymentMethod`).
        paymentMethod: ap.paymentMethod || ap.method || "bank_transfer",
        remarks: ap.remarks || "",
        paymentDate: ap.paymentDate ? new Date(ap.paymentDate) : new Date(),
      };
    }
  } else if (status === "esign_received") {
    updateObj.$set.esign = { status: "received", signed_at: body.signedAt ? new Date(body.signedAt) : new Date() };
  } else if (status === "payment_received") {
    updateObj.$set.payments = {
      status: "received",
      amount: body.amount || proposal.finalAmount * 0.1,
      received_at: body.paidOn ? new Date(body.paidOn) : new Date(),
      method: body.paymentMethod || "cash",
      transactionRef: body.transactionRef || "N/A",
    };
    updateObj.$set.advancePayment = {
      amount: body.amount || 0,
      paymentMethod: body.paymentMethod || "cash",
      paymentDate: body.paidOn ? new Date(body.paidOn) : new Date(),
      remarks: body.transactionRef || "",
    };
  }

  const updatedProposal = await Proposal.findByIdAndUpdate(
    proposalId,
    { ...updateObj, $push: { approvalHistory: historyItem } },
    { new: true }
  ).populate("leadId", "name email phone trackingId");

  let delivery = null;
  let autoCreatedProject = null;

  if (status === "signed") {
    await Proposal.findByIdAndUpdate(proposalId, { $set: { status: "project_started" } });
    updatedProposal.status = "project_started";
    autoCreatedProject = await autoCreateProjectFromProposal(updatedProposal, proposalId);
  } else {
    if (status === "manager_approved") {
      delivery = await triggerSendToClient(updatedProposal, { userId: actor.userId });
      if (delivery.email.sent || delivery.whatsapp.sent) {
        updatedProposal.status = "sent";
        await updatedProposal.save();
      }
    }
    if (status === "esign_received" || status === "payment_received") {
      const p = await Proposal.findById(proposalId);
      if (p.esign?.status === "received" && p.payments?.status === "received") {
        p.status = "project_ready";
        await p.save();
        updatedProposal.status = "project_ready";
      }
    }
    const targetClientId = updatedProposal.leadId?._id || updatedProposal.leadId;
    if (status === "sent") {
      await CRMClient.findByIdAndUpdate(targetClientId, { lifecycleStage: "proposal_sent" });
    }
    if (status === "project_started") {
      autoCreatedProject = await autoCreateProjectFromProposal(updatedProposal, proposalId);
    }
  }

  // In-app notifications — mirror the controller's meaningful transitions.
  const proposalCreator = updatedProposal.createdBy || null;
  const leadName = updatedProposal.leadId?.name || "client";
  const link = `/proposal/review/${updatedProposal._id}`;
  const actorObj = { _id: actor.userId, name: actor.userName || "AI Assistant" };
  const base = {
    module: "proposal",
    link,
    recipients: proposalCreator ? [proposalCreator] : [],
    actor: actorObj,
    notifyActor: true,
    relatedTo: { module: "proposal", recordId: updatedProposal._id },
  };
  if (status === "manager_approved") {
    notify({ ...base, type: "proposal.manager_approved", priority: "high",
      title: `Proposal approved: ${updatedProposal.title || "(untitled)"}`,
      message: `Approved & sent to ${leadName} (via AI assistant).`,
      metadata: { leadName, viaAI: true } });
  } else if (status === "sent") {
    notify({ ...base, type: "proposal.sent", priority: "normal",
      title: `Proposal sent to ${leadName}`,
      message: updatedProposal.title ? `"${updatedProposal.title}"` : "Proposal delivered to client.",
      metadata: { leadName, viaAI: true } });
  } else if (status === "esign_received" || status === "signed") {
    notify({ ...base, type: "proposal.esign_received", priority: "high",
      title: `eSign received from ${leadName}`,
      message: updatedProposal.title ? `Signed: "${updatedProposal.title}"` : "Client has signed the proposal.",
      metadata: { leadName, viaAI: true } });
  }

  return { proposal: updatedProposal, delivery, autoCreatedProject };
}

// Per-status human warning for the confirm card.
function sideEffectWarning(status, lead, body) {
  const email = lead?.email;
  const phone = lead?.phone;
  switch (status) {
    case "manager_approved":
      return `⚠ Approves AND immediately SENDS the proposal to the client by email${email ? ` (${email})` : ""} and WhatsApp${phone ? ` (${phone})` : ""} with a PDF, then marks it Sent.` +
        (!email && !phone ? " WARNING: the client has no email or phone on file — delivery will fail." : "");
    case "sent":
      return "Marks the proposal Sent and sets the lead's stage to 'proposal_sent'. (Does NOT itself deliver it — use manager_approved or the send tools to actually email/WhatsApp the client.)";
    case "signed":
      return `⚠ Records the client e-signature as received${body.advancePayment ? ` plus an advance payment of ${inr(body.advancePayment.amount)}` : ""}, CONVERTS the client to 'converted', and AUTO-CREATES a PMS project. Hard to undo.`;
    case "project_started":
      return "⚠ CONVERTS the client to 'converted' and AUTO-CREATES a PMS project. Hard to undo.";
    case "esign_received":
      return "Records the client e-signature as received. If the advance payment is already in, the proposal auto-advances to 'project_ready'.";
    case "payment_received":
      return `Records the advance payment as received${typeof body.amount === "number" ? ` (${inr(body.amount)})` : " (defaults to 10% of the final amount if no amount is given)"}. If the e-sign is already in, the proposal auto-advances to 'project_ready'.`;
    case "revision_requested":
      return "Sends the proposal back for revision with your remarks as the reason.";
    case "rejected":
      return "Marks the proposal Rejected with your remarks as the reason.";
    case "pending_approval":
      return "Submits the proposal for manager approval.";
    case "draft":
      return "Reverts the proposal to draft.";
    case "project_ready":
      return "Marks the proposal 'project_ready' (this is normally set automatically once BOTH e-sign and payment are received).";
    default:
      return `Sets the proposal status to '${status}'.`;
  }
}

function buildBody(args) {
  const body = { status: args.status };
  if (typeof args.remarks === "string") body.remarks = args.remarks;

  if (args.status === "payment_received") {
    if (typeof args.amount === "number") body.amount = args.amount;
    if (args.paymentMethod) body.paymentMethod = args.paymentMethod;
    if (args.transactionRef) body.transactionRef = args.transactionRef;
    const d = parseIstDate(args.paidOn);
    if (d) body.paidOn = d.toISOString();
  }
  if (args.status === "esign_received") {
    const d = parseIstDate(args.signedAt);
    if (d) body.signedAt = d.toISOString();
  }
  if (args.status === "signed" && (typeof args.advanceAmount === "number" || args.advancePaidBy || args.advanceMethod)) {
    const d = parseIstDate(args.paidOn);
    body.advancePayment = {
      amount: args.advanceAmount || 0,
      paidBy: args.advancePaidBy || "",
      method: args.advanceMethod || "bank_transfer",
      paymentDate: d ? d.toISOString() : undefined,
    };
  }
  return body;
}

async function loadAndAuthorize(args, ctx) {
  if (!args.proposalId && !args.leadId) {
    return { error: { ok: false, error: "invalid_args", uiHint: "error",
      summaryText: "Provide a proposalId or a leadId to identify the proposal." } };
  }
  const r = await resolveProposal({ proposalId: args.proposalId, leadId: args.leadId });
  if (r.error) {
    return { error: { ok: false, error: r.candidates ? "ambiguous" : "not_found", summaryText: r.error, uiHint: "error" } };
  }
  const proposal = r.doc;
  const lead = r.lead || proposal.leadId;
  const isOwner = lead && String(lead.assignedTo || "") === String(ctx.userId);
  const elevated = (ctx.permissions || []).some((p) => WIDER_PERMS.includes(p));
  if (!isOwner && !elevated) {
    return { error: { ok: false, error: "denied", uiHint: "error",
      summaryText: "Only the assigned salesperson (or admin) can change this proposal's status." } };
  }
  return { proposal, lead };
}

module.exports = {
  name: "updateProposalStatus",
  permission: "crm.update",
  isWrite: true,
  description:
    "Move a proposal through its lifecycle. Statuses: pending_approval (submit for manager review), manager_approved (approve AND auto-send to client by email+WhatsApp with PDF), revision_requested (send back with remarks), rejected (with remarks), esign_received (client signed), payment_received (advance received), signed (records e-sign + optional advance, converts the client, and creates a PMS project), project_started (convert + create project), project_ready, draft. Several transitions have BIG side-effects (sending the client a message, converting the client, creating a project) — the confirmation card will spell them out. To send an already-approved proposal use sendProposal, and to create+send a brand-new one use createAndSendProposal; use THIS tool to approve a draft (manager_approved) or to record signing/payment. Pass proposalId, or leadId (name/trackingId) to resolve the lead's proposal.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      proposalId: { type: "string", description: "Proposal ObjectId (24 hex). Preferred when known.", minLength: 24, maxLength: 24 },
      leadId: { type: "string", description: "Lead/client identifier (ObjectId, trackingId, or name fragment) to resolve the proposal. Used only if proposalId is omitted.", minLength: 2, maxLength: 100 },
      status: { type: "string", enum: STATUSES, description: "Target lifecycle status. See the tool description for what each one does and which have side-effects." },
      remarks: { type: "string", maxLength: 1000, description: "Notes for the history log. REQUIRED in spirit for 'rejected' (the rejection reason) and 'revision_requested' (what to change) — ask the user if not given." },
      // payment_received
      amount: { type: "number", minimum: 0, description: "Advance payment amount in rupees (for status='payment_received'). If omitted, defaults to 10% of the proposal's final amount." },
      paymentMethod: { type: "string", enum: PAYMENT_METHODS, description: "Payment method for payment_received (or the advance on 'signed')." },
      transactionRef: { type: "string", maxLength: 120, description: "Transaction reference / UTR for payment_received." },
      paidOn: { type: "string", description: "Date the payment was received (YYYY-MM-DD, treated as IST). For payment_received / signed advance." },
      // esign_received
      signedAt: { type: "string", description: "Date the client signed (YYYY-MM-DD, treated as IST). For status='esign_received'." },
      // signed (combined e-sign + advance)
      advanceAmount: { type: "number", minimum: 0, description: "Advance amount recorded alongside status='signed'." },
      advancePaidBy: { type: "string", maxLength: 120, description: "Who paid the advance (for status='signed')." },
      advanceMethod: { type: "string", enum: PAYMENT_METHODS, description: "Advance payment method (for status='signed'). Defaults to bank_transfer." },
    },
    required: ["status"],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;

    const p = r.proposal;
    const body = buildBody(args);
    const warning = sideEffectWarning(args.status, r.lead, body);

    const sameStatus = p.status === args.status && !["manager_approved", "sent"].includes(args.status);
    if (sameStatus) {
      return { ok: false, error: "no_changes", uiHint: "error",
        summaryText: `Proposal "${p.title}" is already "${p.status}".` };
    }

    return {
      ok: true,
      proposalDescription:
        `Set proposal "${p.title}" (${inr(p.finalAmount)}${r.lead ? `, ${r.lead.name}` : ""}) from "${p.status}" → "${args.status}". ${warning}`,
      args,
      preview: {
        proposalId: String(p._id),
        title: p.title,
        fromStatus: p.status,
        toStatus: args.status,
        finalAmount: p.finalAmount,
        leadName: r.lead?.name,
        leadTrackingId: r.lead?.trackingId,
        recipientEmail: r.lead?.email || null,
        recipientPhone: r.lead?.phone || null,
        sideEffect: warning,
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;

    const body = buildBody(args);
    const actor = { userId: ctx.userId, userName: ctx.userName };
    const result = await runStatusChange(String(r.proposal._id), body, actor);
    if (result.error === "not_found") {
      return { ok: false, error: "not_found", uiHint: "error", summaryText: "Proposal not found." };
    }

    const p = result.proposal;
    const parts = [`Proposal "${p.title}" is now "${p.status}".`];
    if (result.delivery) {
      const ch = [];
      if (result.delivery.email?.sent) ch.push(`email (${result.delivery.email.recipient})`);
      if (result.delivery.whatsapp?.sent) ch.push(`WhatsApp (${result.delivery.whatsapp.recipient})`);
      parts.push(ch.length ? `Sent to client via ${ch.join(" and ")}.` : "Delivery failed on all channels — retry from the proposal dashboard.");
    }
    if (result.autoCreatedProject) {
      parts.push(`Created project ${result.autoCreatedProject.trackingId} and converted the client.`);
    }

    return {
      ok: true,
      summaryText: parts.join(" "),
      uiHint: "actionDone",
      data: {
        proposalId: String(p._id),
        title: p.title,
        status: p.status,
        finalAmount: p.finalAmount,
        delivery: result.delivery
          ? { emailSent: !!result.delivery.email?.sent, whatsappSent: !!result.delivery.whatsapp?.sent }
          : null,
        autoCreatedProject: result.autoCreatedProject || null,
        url: `/proposal/review/${p._id}`,
      },
    };
  },
};
