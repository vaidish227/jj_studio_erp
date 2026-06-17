const Proposal = require("../models/Proposal.model");
const CRMClient = require("../models/CRMClient.model");
const Project = require("../../pms/models/Project.model");
const BOQ = require("../../proposal/models/Boq.model");
const BOQItem = require("../../proposal/models/Boq_item.model");
const ESign = require("../../proposal/models/ESign.model");
const Payment = require("../../proposal/models/Payment.model");
const Approval = require("../../proposal/models/Approval.model");
const Activity = require("../../proposal/models/Activity.model");
const ProposalVersion = require("../../proposal/models/Proposal_version.model");
const mailService = require("../../mail/service/mail.service");
const whatsappService = require("../../whatsapp/service/whatsapp.service");
const MailTemplate = require("../../mail/models/MailTemplate.model");
const WhatsAppTemplate = require("../../whatsapp/models/WhatsAppTemplate.model");
const { generateProposalPdfBuffer, saveProposalPdf } = require("../utils/proposalPdf");
const { dispatch: notify } = require("../../notifications/services/notificationDispatcher");
const kitEvents = require("../../kit/services/kitEvents");
const { resolveDateRange, DateRangeError } = require("../../../shared/dateRange/resolveDateRange");
require("dotenv").config();

const mongoose = require("mongoose");

// Build a deterministic project tracking ID from the proposal — collision-free
// without needing a counter sequence. `PRJ-2026-AB12CD34` (last 8 hex of _id).
const buildProjectTrackingId = (proposalId) => {
  const year = new Date().getFullYear();
  const tail = String(proposalId).slice(-8).toUpperCase();
  return `PRJ-${year}-${tail}`;
};

// MongoDB standalone instances don't support transactions and throw a specific
// error code (20 / "Transaction numbers are only allowed on a replica set").
// withFallbackTransaction tries transactional first, falls back to non-tx so
// dev environments keep working. (#44)
const isStandaloneError = (err) =>
  err?.code === 20 ||
  err?.codeName === "IllegalOperation" ||
  /replica set/i.test(err?.message || "") ||
  /Transaction numbers/i.test(err?.message || "");

const withFallbackTransaction = async (work) => {
  let session = null;
  try {
    session = await mongoose.startSession();
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (err) {
    if (!isStandaloneError(err)) throw err;
    // Standalone Mongo — run the work without a session.
    return work(null);
  } finally {
    if (session) await session.endSession();
  }
};

// Create the PMS Project for a signed/started proposal, if one doesn't exist.
// Wraps the Project insert + CRMClient.linkedProjects update in a transaction
// when the cluster supports it. Returns { _id, trackingId, name }, or null if
// a project already existed.
const autoCreateProjectFromProposal = async (proposal, client) => {
  const existing = await Project.findOne({ proposalId: proposal._id });
  if (existing) return null;

  const trackingId = buildProjectTrackingId(proposal._id);
  const siteAddr = client?.siteAddress || {};
  const fullAddress =
    siteAddr.fullAddress ||
    (client?.address ? String(client.address) : "") ||
    "TBD";

  return withFallbackTransaction(async (session) => {
    const opts = session ? { session } : {};

    // .create({...}, session ? { session } : undefined) — Mongoose expects
    // an array form when passing options to create(), so we build the doc and save.
    const project = new Project({
      clientId: client?._id,
      proposalId: proposal._id,
      trackingId,
      name: proposal.title || `${client?.name || "Client"} — Interior Project`,
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
      budget: proposal.finalAmount || client?.budget || null,
      status: "design_phase",
      notes: `Auto-created from Proposal: ${proposal.title}. Final amount: ₹${(proposal.finalAmount || 0).toLocaleString("en-IN")}.`,
    });
    await project.save(opts);

    await CRMClient.updateOne(
      { _id: client?._id },
      { $addToSet: { linkedProjects: project._id } },
      opts
    );

    return { _id: project._id, trackingId: project.trackingId, name: project.name };
  });
};

// Normalize a bare 10-digit Indian phone to +91XXXXXXXXXX; pass through if
// already international. Returns null if the input is unusable.
const toE164India = (raw) => {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11) return digits.startsWith("+") ? digits : `+${digits}`;
  return null;
};

//  CREATE PROPOSAL
const createProposal = async (req, res) => {
  try {
    const { leadId, templateId, title, description, content, subtotal, gst, finalAmount, status } = req.body;

    if (!leadId) return res.status(400).json({ message: "Client ID is required" });

    const lead = await CRMClient.findById(leadId);
    if (!lead) return res.status(404).json({ message: "Client not found" });

    const proposal = await Proposal.create({
      leadId: lead._id,
      templateId,
      title: title || "New Proposal",
      description,
      content,
      subtotal: subtotal || 0,
      totalAmount: subtotal || 0,
      gst: gst || 0,
      finalAmount: finalAmount || 0,
      status: status || "draft",
      createdBy: req.user ? req.user.id : null,
    });

    // Always link proposal to the CRMClient record
    await CRMClient.findByIdAndUpdate(lead._id, {
      $addToSet: { linkedProposals: proposal._id },
    });

    if (status === "pending_approval") {
      lead.status = "interested";
      lead.lifecycleStage = "interested";
      await lead.save();
    }

    res.status(201).json({ message: "Proposal created successfully", proposal });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Mirrors the Proposal model enum — kept in sync with Proposal.model.js:36-47.
const VALID_STATUSES = new Set([
  "draft", "pending_approval", "revision_requested", "manager_approved",
  "sent", "esign_received", "payment_received", "project_ready",
  "rejected", "project_started",
]);

//  GET PROPOSALS
const getProposals = async (req, res) => {
  try {
    const { leadId, clientId, status, preset, from, to } = req.query;
    const filter = {};
    if (leadId) filter.leadId = leadId;
    if (clientId) filter.clientId = clientId;
    // Date-range scoping for the Proposal Dashboard (cohort by createdAt). Only
    // applied when a range is supplied — existing callers (list pages: status
    // only) are unaffected. 'all_time' resolves to epoch→now ⇒ effectively all.
    if (preset || from || to) {
      const { start, end } = resolveDateRange({
        preset: preset != null ? String(preset).toLowerCase() : undefined,
        from,
        to,
      });
      filter.createdAt = { $gte: start, $lte: end };
    }
    if (status) {
      // Validate against the enum so a typo (e.g. ?status=draf) returns 400
      // instead of silently returning [] — easier to debug. (#42)
      const requested = status.split(',').map((s) => s.trim()).filter(Boolean);
      const invalid = requested.filter((s) => !VALID_STATUSES.has(s));
      if (invalid.length) {
        return res.status(400).json({
          message: `Invalid status value(s): ${invalid.join(', ')}`,
          validStatuses: [...VALID_STATUSES],
        });
      }
      filter.status = requested.length > 1 ? { $in: requested } : requested[0];
    }

    const proposals = await Proposal.find(filter)
      .populate("leadId", "name email phone trackingId")
      .populate("templateId", "name")
      .sort({ createdAt: -1 });

    res.json({ message: "Proposals fetched", proposals });
  } catch (err) {
    if (err instanceof DateRangeError) {
      return res.status(400).json({ error: err.code, message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
};

// Status transitions a regular user cannot perform — only admin / md / manager.
// (verifyToken + requirePermission('proposal.update') gate the endpoint itself;
// this is an extra guard for the high-impact lifecycle decisions.)
const APPROVAL_STATUSES = new Set(["manager_approved", "rejected", "revision_requested"]);
const APPROVER_ROLES = new Set(["admin", "md", "manager"]);

// UPDATE PROPOSAL STATUS (Lifecycle Core)
const updateProposalStatus = async (req, res) => {
  try {
    const { status, remarks, amount } = req.body;
    const proposalId = req.params.id;

    if (APPROVAL_STATUSES.has(status) && !APPROVER_ROLES.has(req.user?.role)) {
      return res.status(403).json({
        message: `Only admin / md / manager can set status to "${status}".`,
      });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });

    const updateObj = { $set: { status } };
    const historyItem = {
      action: status,
      performedBy: req.user ? req.user.id : null,
      remarks: remarks || "",
      timestamp: new Date()
    };

    // Specific logic per lifecycle stage
    if (status === "manager_approved") {
      updateObj.$set.approved_by = req.user ? req.user.id : null;
      updateObj.$set.approved_at = new Date();
    } else if (status === "revision_requested") {
      updateObj.$set.revisionReason = remarks || "Revision required";
      updateObj.$set.revisionRequestedBy = req.user ? req.user.id : null;
      updateObj.$set.revisionRequestedAt = new Date();
    } else if (status === "rejected") {
      updateObj.$set.rejected_by = req.user ? req.user.id : null;
      updateObj.$set.rejection_reason = remarks || "No reason provided";
    } else if (status === "signed") {
      updateObj.$set.esign = {
        status: "received",
        signed_at: new Date()
      };
      if (req.body.advancePayment) {
        const ap = req.body.advancePayment;
        updateObj.$set.advancePayment = {
          amount: ap.amount || 0,
          paidBy: ap.paidBy || "",
          paymentMethod: ap.paymentMethod || ap.method || "bank_transfer",
          remarks: ap.remarks || "",
          paymentDate: ap.paymentDate ? new Date(ap.paymentDate) : new Date()
        };
      }
    } else if (status === "esign_received") {
      updateObj.$set.esign = {
        status: "received",
        signed_at: req.body.signedAt ? new Date(req.body.signedAt) : new Date()
      };
    } else if (status === "payment_received") {
      updateObj.$set.payments = {
        status: "received",
        amount: req.body.amount || proposal.finalAmount * 0.1,
        received_at: req.body.paidOn ? new Date(req.body.paidOn) : new Date(),
        method: req.body.paymentMethod || "cash",
        transactionRef: req.body.transactionRef || "N/A"
      };
      updateObj.$set.advancePayment = {
        amount: req.body.amount || 0,
        paymentMethod: req.body.paymentMethod || "cash",
        paymentDate: req.body.paidOn ? new Date(req.body.paidOn) : new Date(),
        remarks: req.body.transactionRef || ""
      };
    } else if (status === "sent") {
      // Stamp the first send time so dashboards can count "proposals sent this period".
      // Preserve an existing timestamp so a manual re-send never resets it.
      updateObj.$set.sentAt = proposal.sentAt || new Date();
    }

    const updatedProposal = await Proposal.findByIdAndUpdate(
      proposalId,
      { ...updateObj, $push: { approvalHistory: historyItem } },
      { new: true }
    ).populate("leadId", "name email phone trackingId");

    // AUTO-FLOW LOGIC — these flags ride back to the frontend so the UI can show
    // exactly what happened per channel (email + WhatsApp).
    let deliveryResult = null; // { email: {...}, whatsapp: {...} } when auto-send fired

    // 0. eSign + Advance received → convert client, create project, move to project_started.
    //    No early return here — fall through so notifications + delivery payload still build.
    let autoCreatedProject = null;
    if (status === "signed") {
      await Proposal.findByIdAndUpdate(proposalId, { $set: { status: "project_started" } });
      updatedProposal.status = "project_started";

      const targetClientId = updatedProposal.leadId?._id || updatedProposal.leadId;
      await CRMClient.findByIdAndUpdate(targetClientId, {
        lifecycleStage: "converted",
        status: "converted",
      });

      try {
        const client = await CRMClient.findById(targetClientId);
        autoCreatedProject = await autoCreateProjectFromProposal(updatedProposal, client);
      } catch (projErr) {
        console.error("[auto-create project]", projErr.message);
      }
    }

    // 1. If Manager Approved -> Automatically Send to Client (Email + WhatsApp)
    if (status === "manager_approved") {
      deliveryResult = await triggerSendToClient(updatedProposal, {
        userId: req.user?.id,
      });

      // Advance status to "sent" if at least one channel succeeded; otherwise
      // leave at manager_approved so the manager can retry manually.
      const anyChannelSent = deliveryResult.email.sent || deliveryResult.whatsapp.sent;
      if (anyChannelSent) {
        updatedProposal.status = "sent";
        if (!updatedProposal.sentAt) updatedProposal.sentAt = new Date();
        await updatedProposal.save();
      } else {
        console.error("Auto-send failed on all channels:", {
          email: deliveryResult.email.error,
          whatsapp: deliveryResult.whatsapp.error,
        });
      }
    }

    // 2. If eSign Received or Payment Received -> Check for "Project Ready"
    if (status === "esign_received" || status === "payment_received") {
      const p = await Proposal.findById(proposalId);
      if (p.esign?.status === "received" && p.payments?.status === "received") {
        p.status = "project_ready";
        await p.save();
      }
    }

    // 3. Sync Lead Status + auto-create PMS project on project_started
    const targetClientId = updatedProposal.leadId?._id || updatedProposal.leadId;

    if (status === "sent") {
      await CRMClient.findByIdAndUpdate(targetClientId, { lifecycleStage: "proposal_sent" });
    }

    // Advance receipt recorded → convert the CRM client so it surfaces on the
    // Converted page (mirrors the recordAdvancePayment endpoint). No PMS project
    // is auto-created here — that happens later on "Initiate Project".
    if (status === "payment_received") {
      await CRMClient.findByIdAndUpdate(targetClientId, {
        status: "converted",
        lifecycleStage: "advance_received",
        advancePayment: {
          received: true,
          amount: req.body.amount || updatedProposal.advancePayment?.amount || 0,
          receivedAt: req.body.paidOn ? new Date(req.body.paidOn) : new Date(),
          movedToProjectManagement: false,
        },
      });
    }

    if (status === "project_started") {
      await CRMClient.findByIdAndUpdate(targetClientId, {
        lifecycleStage: "converted",
        status: "converted",
      });

      try {
        const client = await CRMClient.findById(targetClientId);
        autoCreatedProject = await autoCreateProjectFromProposal(updatedProposal, client);
      } catch (projErr) {
        console.error("[auto-create project]", projErr.message);
      }
    }

    // Attach delivery telemetry so the UI can show a precise per-channel notification.
    // Proposal fields are spread at the root for backward compatibility with
    // existing callers (which read `res.status`, `res._id`, etc. directly).
    const proposalObj = updatedProposal.toObject ? updatedProposal.toObject() : { ...updatedProposal };

    const delivery = {
      finalStatus: updatedProposal.status, // may have auto-advanced (manager_approved → sent)
    };
    if (deliveryResult) {
      delivery.email = deliveryResult.email;       // { sent, error, recipient, pdfAttached }
      delivery.whatsapp = deliveryResult.whatsapp; // { sent, error, recipient, pdfAttached }
      delivery.pdf = deliveryResult.pdf;           // { generated, error, url }
      // Flat aliases kept for the toasts we wired earlier (backward compat)
      delivery.emailSent = deliveryResult.email.sent;
      delivery.emailError = deliveryResult.email.error;
      delivery.recipientEmail = deliveryResult.email.recipient;
    }

    // ─── In-app notifications for the meaningful status transitions ────
    // Recipients = proposal creator (createdBy) + admins (via fallback)
    const proposalCreator = updatedProposal.createdBy || null;
    const leadName = updatedProposal.leadId?.name || "client";
    const linkToProposal = `/proposal/review/${updatedProposal._id}`;

    if (status === "manager_approved") {
      notify({
        type: "proposal.manager_approved",
        module: "proposal",
        priority: "high",
        title: `Proposal approved: ${updatedProposal.title || "(untitled)"}`,
        message: `Approved & sent to ${leadName}.`,
        link: linkToProposal,
        recipients: proposalCreator ? [proposalCreator] : [],
        actor: req.user ? { _id: req.user.id, name: req.user.name } : undefined,
        relatedTo: { module: "proposal", recordId: updatedProposal._id },
        metadata: { leadName, proposalTitle: updatedProposal.title },
      });
    } else if (status === "sent") {
      notify({
        type: "proposal.sent",
        module: "proposal",
        priority: "normal",
        title: `Proposal sent to ${leadName}`,
        message: updatedProposal.title ? `"${updatedProposal.title}"` : "Proposal delivered to client.",
        link: linkToProposal,
        recipients: proposalCreator ? [proposalCreator] : [],
        actor: req.user ? { _id: req.user.id, name: req.user.name } : undefined,
        relatedTo: { module: "proposal", recordId: updatedProposal._id },
        metadata: { leadName },
      });
      // KIT automation trigger (fire-and-forget).
      kitEvents.emit("proposal.sent", {
        sourceModule: "proposal",
        entityType: "proposal",
        entityId: updatedProposal._id,
        payload: { status: "sent", leadName },
        actor: req.user,
      });
    } else if (status === "esign_received" || status === "signed") {
      notify({
        type: "proposal.esign_received",
        module: "proposal",
        priority: "high",
        title: `eSign received from ${leadName}`,
        message: updatedProposal.title ? `Signed: "${updatedProposal.title}"` : "Client has signed the proposal.",
        link: linkToProposal,
        recipients: proposalCreator ? [proposalCreator] : [],
        actor: req.user ? { _id: req.user.id, name: req.user.name } : undefined,
        relatedTo: { module: "proposal", recordId: updatedProposal._id },
        metadata: { leadName },
      });
    }

    if (autoCreatedProject) {
      proposalObj._autoCreatedProject = autoCreatedProject;
    }

    res.json({ ...proposalObj, delivery });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// =====================================================================
//  AUTO-SEND HELPER — routes through mail.service + whatsapp.service.
//  Fires both channels in parallel. Returns per-channel delivery results
//  so the controller can build a precise `delivery` payload for the UI.
//
//  Template-driven: if a MailTemplate/WhatsAppTemplate named
//  "proposal_approved" exists, it's used (admin can edit copy from UI).
//  Otherwise falls back to inline HTML / inline message.
// =====================================================================
const triggerSendToClient = async (proposal, opts = {}) => {
  // opts.channels lets callers send on a single channel (e.g. the review
  // page's "Email PDF" button passes ["email"]). Defaults to both.
  const { userId, channels = ["email", "whatsapp"] } = opts;
  const wantEmail = channels.includes("email");
  const wantWhatsApp = channels.includes("whatsapp");
  const client = proposal.leadId; // unified model: leadId IS the client

  // ── Build shared template variables ──
  const finalAmountStr = (proposal.finalAmount || 0).toLocaleString("en-IN");
  const variables = {
    clientName: client?.name || "Client",
    proposalTitle: proposal.title || "your proposal",
    finalAmount: finalAmountStr,
    trackingId: client?.trackingId || "",
  };

  // ── Generate the PDF once, share across both channels ──
  // Email gets the raw Buffer (Nodemailer accepts it directly).
  // WhatsApp providers need a fetchable URL, so we also persist the buffer
  // under /public/proposals/ and pass the URL as mediaUrl.
  let pdfBuffer = null;
  let pdfPublicUrl = null;
  let pdfError = null;
  try {
    pdfBuffer = await generateProposalPdfBuffer(proposal, client);
    const saved = await saveProposalPdf(pdfBuffer, proposal._id);
    pdfPublicUrl = saved.publicUrl;
  } catch (err) {
    pdfError = err.message || "PDF generation failed";
    console.error("[triggerSendToClient] PDF generation failed:", pdfError);
    // Continue without attachment — the body still has the summary HTML.
  }

  // ── Defensive: if PUBLIC_BASE_URL is unreachable from the public internet
  //    (localhost / private IP / unset), null out the WhatsApp media URL so
  //    we send TEXT-ONLY instead of failing the whole WhatsApp send. The PDF
  //    still goes by email.
  const isUnreachable = (url) =>
    !url ||
    /^https?:\/\/(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.)/i.test(url);
  let whatsappMediaUrl = pdfPublicUrl;
  if (isUnreachable(whatsappMediaUrl)) {
    if (whatsappMediaUrl) {
      console.warn(
        `[triggerSendToClient] PUBLIC_BASE_URL appears unreachable (${whatsappMediaUrl}); sending WhatsApp without PDF attachment.`
      );
    }
    whatsappMediaUrl = null;
  }

  const pdfFilename = `Proposal-${client?.trackingId || proposal._id}.pdf`;

  // ── Build the line-items HTML (used by inline email fallback) ──
  const sections = proposal.content?.sections || [];
  let itemsHtml = "";
  sections.forEach((section) => {
    itemsHtml += `<tr><td colspan="4" style="background-color: #f3f4f6; font-weight: bold; padding: 10px;">${section.title}</td></tr>`;
    section.structure?.rows?.forEach((row) => {
      if (!row.isGroupHeader) {
        const cols = section.structure.columns;
        const nameCol = cols.find((c) =>
          c.label.toLowerCase().includes("item") || c.label.toLowerCase().includes("work")
        );
        const amtCol = cols.find((c) =>
          c.label.toLowerCase().includes("amount") || c.label.toLowerCase().includes("total")
        );
        const name = row.cells[nameCol?.id] || "Item";
        const amount = row.cells[amtCol?.id] || "0";
        itemsHtml += `<tr><td style="padding: 8px; border-bottom: 1px solid #eee;">${name}</td><td colspan="3" style="text-align: right; padding: 8px;">₹${amount}</td></tr>`;
      }
    });
  });

  // ── Channel: EMAIL via mail.service ──
  const emailPromise = (async () => {
    if (!wantEmail) {
      return { sent: false, skipped: true, error: null, recipient: null };
    }
    if (!client?.email) {
      return { sent: false, error: "Client has no email on file", recipient: null };
    }

    // Try to find an editable template; fall back to inline content if not.
    const mailTpl = await MailTemplate.findOne({
      name: "proposal_approved",
      isActive: true,
    }).lean().catch(() => null);

    const inlineHtml = `<div style="font-family: sans-serif; max-width: 600px;">
      <h2>Hello ${variables.clientName},</h2>
      <p>Your proposal for <b>${variables.proposalTitle}</b> has been approved by our manager and is ready for your review.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">${itemsHtml}</table>
      <div style="background: #f9fafb; padding: 20px; border-radius: 12px;">
        <p><b>Final Amount: ₹${variables.finalAmount}</b></p>
      </div>
      <p>Please log in to our portal to complete the eSign and process the advance payment to start the project.</p>
    </div>`;

    try {
      await mailService.sendImmediate({
        to: client.email,
        templateId: mailTpl?._id,
        templateVariables: variables,
        subject: mailTpl ? undefined : `Proposal Approved: ${variables.proposalTitle} - JJ Studio`,
        html: mailTpl ? undefined : inlineHtml,
        attachments: pdfBuffer
          ? [{ filename: pdfFilename, content: pdfBuffer, contentType: "application/pdf" }]
          : undefined,
        relatedTo: { module: "proposal", recordId: proposal._id },
        createdBy: userId,
      });
      return {
        sent: true,
        error: null,
        recipient: client.email,
        pdfAttached: !!pdfBuffer,
      };
    } catch (err) {
      return { sent: false, error: err.message || "Email delivery failed", recipient: client.email };
    }
  })();

  // ── Channel: WHATSAPP via whatsapp.service ──
  const whatsappPromise = (async () => {
    if (!wantWhatsApp) {
      return { sent: false, skipped: true, error: null, recipient: null };
    }
    const e164 = toE164India(client?.phone);
    if (!e164) {
      return { sent: false, error: "Client has no valid phone on file", recipient: null };
    }

    const waTpl = await WhatsAppTemplate.findOne({
      name: "proposal_approved",
      isActive: true,
    }).lean().catch(() => null);

    const inlineMessage =
      `Hi ${variables.clientName}, your proposal *${variables.proposalTitle}* has been approved by JJ Studio.\n\n` +
      `Final Amount: ₹${variables.finalAmount}\n\n` +
      `Please check your email (${client.email || "on file"}) for the full quotation, eSign link, and advance payment instructions.\n\n` +
      `— JJ Studio`;

    try {
      await whatsappService.sendImmediate({
        to: e164,
        templateId: waTpl?._id,
        templateVariables: variables,
        message: waTpl ? undefined : inlineMessage,
        // Attach the PDF only if PUBLIC_BASE_URL is actually reachable from
        // the public internet (whatsappMediaUrl was nulled out above otherwise).
        mediaUrl: whatsappMediaUrl || undefined,
        mediaType: whatsappMediaUrl ? "document" : "none",
        relatedTo: { module: "proposal", recordId: proposal._id },
        createdBy: userId,
      });
      return {
        sent: true,
        error: null,
        recipient: e164,
        pdfAttached: !!whatsappMediaUrl,
      };
    } catch (err) {
      return { sent: false, error: err.message || "WhatsApp delivery failed", recipient: e164 };
    }
  })();

  const [emailResult, whatsappResult] = await Promise.all([emailPromise, whatsappPromise]);
  return {
    email: emailResult,
    whatsapp: whatsappResult,
    pdf: { generated: !!pdfBuffer, error: pdfError, url: pdfPublicUrl },
  };
};

// GET BY ID
const getProposalById = async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
      .populate("leadId", "name email phone trackingId city projectType siteAddress")
      .populate("templateId", "name");
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });
    res.status(200).json({ proposal });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// UPDATE PROPOSAL (FULL)
const updateProposal = async (req, res) => {
  try {
    const { title, description, content, subtotal, gst, finalAmount, status, notes } = req.body;

    const historyItem = {
      action: "updated",
      performedBy: req.user ? req.user.id : null,
      remarks: "Proposal content modified",
      timestamp: new Date()
    };

    // Only include fields the caller actually sent — avoids wiping notes/status on partial edits.
    const set = {};
    if (title !== undefined) set.title = title;
    if (description !== undefined) set.description = description;
    if (content !== undefined) set.content = content;
    if (notes !== undefined) set.notes = notes;
    if (status !== undefined) set.status = status;
    if (subtotal !== undefined) {
      set.subtotal = subtotal;
      set.totalAmount = subtotal; // keep totalAmount in sync with subtotal (createProposal does the same)
    }
    if (gst !== undefined) set.gst = gst;
    if (finalAmount !== undefined) set.finalAmount = finalAmount;

    const proposal = await Proposal.findByIdAndUpdate(
      req.params.id,
      { $set: set, $push: { approvalHistory: historyItem } },
      { new: true }
    );
    res.status(200).json({ message: "Proposal updated successfully", proposal });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE PROPOSAL — cascade to dependent records so we don't leave orphans (#18).
// Note: deletion is blocked once a Project has been auto-created from this proposal,
// since that crosses into PMS data the user almost certainly doesn't want wiped.
const deleteProposal = async (req, res) => {
  try {
    const proposalId = req.params.id;

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });

    const linkedProject = await Project.findOne({ proposalId });
    if (linkedProject) {
      return res.status(409).json({
        message: `Proposal has been converted to project ${linkedProject.trackingId}. Delete the project first if you really need this gone.`,
        projectId: linkedProject._id,
      });
    }

    // Collect BOQ ids before deleting them so we can cascade to BOQItems.
    const boqs = await BOQ.find({ proposalId }).select("_id");
    const boqIds = boqs.map((b) => b._id);

    await Promise.all([
      BOQ.deleteMany({ proposalId }),
      boqIds.length ? BOQItem.deleteMany({ boqId: { $in: boqIds } }) : Promise.resolve(),
      ESign.deleteMany({ proposalId }),
      Payment.deleteMany({ proposalId }),
      Approval.deleteMany({ proposalId }),
      Activity.deleteMany({ proposalId }),
      ProposalVersion.deleteMany({ proposalId }),
      CRMClient.updateOne(
        { _id: proposal.leadId },
        { $pull: { linkedProposals: proposal._id } }
      ),
    ]);

    await Proposal.findByIdAndDelete(proposalId);

    res.json({ message: "Proposal and all related records deleted." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Statuses at/after "sent" — a manual re-send must never regress these back
// to "sent" (e.g. emailing the PDF again after payment_received).
const POST_SEND_STATUSES = [
  "sent", "esign_received", "payment_received", "signed",
  "project_ready", "project_started",
];

// SEND PROPOSAL EMAIL (Manual send/retry — same email + WhatsApp flow)
const sendProposalEmail = async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
      .populate("leadId", "name email phone trackingId");
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });

    // Optional channel filter: { channels: ["email"] } sends email only.
    // Defaults to both channels (legacy behaviour for existing callers).
    const requested = Array.isArray(req.body?.channels)
      ? req.body.channels.filter((c) => ["email", "whatsapp"].includes(c))
      : [];

    const deliveryResult = await triggerSendToClient(proposal, {
      userId: req.user?.id,
      channels: requested.length ? requested : undefined,
    });

    const anyChannelSent = deliveryResult.email.sent || deliveryResult.whatsapp.sent;
    if (anyChannelSent && !POST_SEND_STATUSES.includes(proposal.status)) {
      proposal.status = "sent";
      if (!proposal.sentAt) proposal.sentAt = new Date();
      await proposal.save();
    }

    res.status(200).json({
      message: anyChannelSent
        ? "Proposal sent to client"
        : "Send failed on all channels — see delivery for details",
      delivery: {
        email: deliveryResult.email,
        whatsapp: deliveryResult.whatsapp,
        finalStatus: proposal.status,
        emailSent: deliveryResult.email.sent,
        emailError: deliveryResult.email.error,
        recipientEmail: deliveryResult.email.recipient,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DOWNLOAD PDF — streams the same letter-format PDF the review screen shows
// (and that email/Documents use), so all four surfaces stay identical.
const downloadProposalPdf = async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
      .populate("leadId", "name email phone trackingId address siteAddress")
      .lean();
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });

    const client = proposal.leadId;
    const buffer = await generateProposalPdfBuffer(proposal, client);
    const filename = `Proposal-${client?.trackingId || String(proposal._id).slice(-8).toUpperCase()}.pdf`;

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length,
    });
    // Puppeteer ≥22 returns a Uint8Array — normalise so Express streams bytes.
    res.send(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// SAVE TO DOCUMENT REPOSITORY — files the same PDF into the linked project's
// repository. Reuses the idempotent ingest that runs at project initiation,
// so manually-saved and auto-filed entries can never duplicate each other.
const FILEABLE_STATUSES = ["manager_approved", ...POST_SEND_STATUSES];

const saveProposalToDocuments = async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
      .populate("leadId", "name email phone trackingId address siteAddress")
      .lean();
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });

    if (!FILEABLE_STATUSES.includes(proposal.status)) {
      return res.status(400).json({
        message: "Only manager-approved proposals can be filed in the document repository.",
      });
    }

    const project = await Project.findOne({ proposalId: proposal._id })
      .select("_id trackingId name")
      .lean();
    if (!project) {
      return res.status(409).json({
        message: "No project is linked to this proposal yet — the document repository is organised per project. Initiate the project first.",
      });
    }

    // Lazy-require keeps the PMS ingest (which boots Puppeteer) out of cold start.
    const { ingestProposalPdf } = require("../../pms/services/documentIngest");
    const document = await ingestProposalPdf({
      project,
      proposal,
      client: proposal.leadId,
      actorId: req.user?.id,
    });

    if (!document) {
      return res.json({
        alreadyFiled: true,
        message: `This proposal is already filed in ${project.trackingId}'s documents.`,
      });
    }
    res.status(201).json({
      message: `Saved to ${project.trackingId}'s document repository.`,
      document,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createProposal, getProposals, updateProposalStatus, deleteProposal, getProposalById, updateProposal, sendProposalEmail, triggerSendToClient, downloadProposalPdf, saveProposalToDocuments }