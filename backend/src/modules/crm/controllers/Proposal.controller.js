const Proposal = require("../models/Proposal.model");
const CRMClient = require("../models/CRMClient.model");
const Project = require("../../pms/models/Project.model");
const mailService = require("../../mail/service/mail.service");
const whatsappService = require("../../whatsapp/service/whatsapp.service");
const MailTemplate = require("../../mail/models/MailTemplate.model");
const WhatsAppTemplate = require("../../whatsapp/models/WhatsAppTemplate.model");
const { generateProposalPdfBuffer, saveProposalPdf } = require("../utils/proposalPdf");
const { dispatch: notify } = require("../../notifications/services/notificationDispatcher");
require("dotenv").config();

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

//  GET PROPOSALS
const getProposals = async (req, res) => {
  try {
    const { leadId, clientId, status } = req.query;
    const filter = {};
    if (leadId) filter.leadId = leadId;
    if (clientId) filter.clientId = clientId;
    if (status) {
      filter.status = status.includes(',') ? { $in: status.split(',') } : status;
    }

    const proposals = await Proposal.find(filter)
      .populate("leadId", "name email phone trackingId")
      .populate("templateId", "name")
      .sort({ createdAt: -1 });

    res.json({ message: "Proposals fetched", proposals });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// UPDATE PROPOSAL STATUS (Lifecycle Core)
const updateProposalStatus = async (req, res) => {
  try {
    const { status, remarks, amount } = req.body;
    const proposalId = req.params.id;

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
          method: ap.method || "bank_transfer",
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
    }

    const updatedProposal = await Proposal.findByIdAndUpdate(
      proposalId,
      { ...updateObj, $push: { approvalHistory: historyItem } },
      { new: true }
    ).populate("leadId", "name email phone trackingId");

    // AUTO-FLOW LOGIC — these flags ride back to the frontend so the UI can show
    // exactly what happened per channel (email + WhatsApp).
    let deliveryResult = null; // { email: {...}, whatsapp: {...} } when auto-send fired

    // 0. eSign + Advance received → convert client, create project, move to project_started
    if (status === "signed") {
      // Transition proposal to project_started
      await Proposal.findByIdAndUpdate(proposalId, { $set: { status: "project_started" } });
      updatedProposal.status = "project_started";

      const targetClientId = updatedProposal.leadId?._id || updatedProposal.leadId;

      // Mark CRMClient as converted
      await CRMClient.findByIdAndUpdate(targetClientId, {
        lifecycleStage: "converted",
        status: "converted",
      });

      // Auto-create PMS Project
      try {
        const existingProject = await Project.findOne({ proposalId: proposalId });
        if (!existingProject) {
          const client = await CRMClient.findById(targetClientId);
          const year = new Date().getFullYear();
          const count = (await Project.countDocuments()) + 1;
          const trackingId = `PRJ-${year}-${String(count).padStart(4, "0")}`;

          const siteAddr = client?.siteAddress || {};
          const fullAddress =
            siteAddr.fullAddress ||
            (client?.address ? String(client.address) : "") ||
            "TBD";

          const project = await Project.create({
            clientId: targetClientId,
            proposalId: proposalId,
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
            notes: `Auto-created from Proposal: ${updatedProposal.title}. Final amount: ₹${(updatedProposal.finalAmount || 0).toLocaleString("en-IN")}.`,
          });

          // Link project — do NOT overwrite lifecycleStage, client is already "converted"
          await CRMClient.findByIdAndUpdate(targetClientId, {
            $addToSet: { linkedProjects: project._id },
          });

          updatedProposal._autoCreatedProject = {
            _id: project._id,
            trackingId: project.trackingId,
            name: project.name,
          };
        }
      } catch (projErr) {
        console.error("[auto-create project]", projErr.message);
      }

      return res.json(updatedProposal);
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

    if (status === "project_started") {
      // Mark CRMClient as converted
      await CRMClient.findByIdAndUpdate(targetClientId, {
        lifecycleStage: "converted",
        status: "converted",
      });

      // Auto-create a PMS Project if one doesn't already exist for this proposal
      try {
        const existingProject = await Project.findOne({ proposalId: proposalId });
        if (!existingProject) {
          const client = await CRMClient.findById(targetClientId);
          const year = new Date().getFullYear();
          const count = (await Project.countDocuments()) + 1;
          const trackingId = `PRJ-${year}-${String(count).padStart(4, "0")}`;

          // Build a clean site address — prefer enriched siteAddress, fall back to city/address
          const siteAddr = client?.siteAddress || {};
          const fullAddress =
            siteAddr.fullAddress ||
            (client?.address ? String(client.address) : "") ||
            "TBD";

          const project = await Project.create({
            clientId: targetClientId,
            proposalId: proposalId,
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
            notes: `Auto-created from Proposal: ${updatedProposal.title}. Final amount: ₹${(updatedProposal.finalAmount || 0).toLocaleString("en-IN")}.`,
          });

          // Link project back to CRMClient — keep lifecycleStage as "converted"
          await CRMClient.findByIdAndUpdate(targetClientId, {
            $addToSet: { linkedProjects: project._id },
          });

          // Attach project ref to response so frontend can redirect
          updatedProposal._autoCreatedProject = {
            _id: project._id,
            trackingId: project.trackingId,
            name: project.name,
          };
        }
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
  const { userId } = opts;
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
    const { title, description, content, subtotal, gst, finalAmount, status } = req.body;

    const historyItem = {
      action: "updated",
      performedBy: req.user ? req.user.id : null,
      remarks: "Proposal content modified",
      timestamp: new Date()
    };

    const proposal = await Proposal.findByIdAndUpdate(req.params.id, {
      title, description, content, subtotal, gst, finalAmount, status,
      $push: { approvalHistory: historyItem }
    }, { new: true });
    res.status(200).json({ message: "Proposal updated successfully", proposal });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE PROPOSAL
const deleteProposal = async (req, res) => {
  try {
    await Proposal.findByIdAndDelete(req.params.id);
    res.json({ message: "Proposal deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// SEND PROPOSAL EMAIL (Manual retry — same email + WhatsApp flow)
const sendProposalEmail = async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
      .populate("leadId", "name email phone trackingId");
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });

    const deliveryResult = await triggerSendToClient(proposal, {
      userId: req.user?.id,
    });

    const anyChannelSent = deliveryResult.email.sent || deliveryResult.whatsapp.sent;
    if (anyChannelSent) {
      proposal.status = "sent";
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

module.exports = { createProposal, getProposals, updateProposalStatus, deleteProposal, getProposalById, updateProposal, sendProposalEmail, triggerSendToClient }