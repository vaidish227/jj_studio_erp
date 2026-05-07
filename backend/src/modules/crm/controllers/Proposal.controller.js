const Proposal = require("../models/Proposal.model");
const CRMClient = require("../models/CRMClient.model")
const sendEmail = require("../utils/sendEmail");
require("dotenv").config();

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

    if (status === "pending_approval") {
      lead.status = "interested"; // Sync with lifecycle
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
    } else if (status === "rejected") {
      updateObj.$set.rejected_by = req.user ? req.user.id : null;
      updateObj.$set.rejection_reason = remarks || "No reason provided";
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

    // AUTO-FLOW LOGIC

    // 1. If Manager Approved -> Automatically Send to Client
    if (status === "manager_approved") {
      try {
        await triggerSendToClient(updatedProposal);
        updatedProposal.status = "sent";
        await updatedProposal.save();
      } catch (emailErr) {
        console.error("Auto-send failed:", emailErr.message);
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

    // 3. Sync Lead Status
    const leadUpdate = {};
    if (status === "sent") leadUpdate.lifecycleStage = "proposal_sent";
    if (status === "project_started") leadUpdate.lifecycleStage = "converted";

    if (Object.keys(leadUpdate).length > 0) {
      const targetId = updatedProposal.leadId?._id || updatedProposal.leadId;
      await CRMClient.findByIdAndUpdate(targetId, leadUpdate);
    }

    res.json(updatedProposal);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Helper for Auto-Send
const triggerSendToClient = async (proposal) => {
  // In unified model, leadId IS the client
  const client = proposal.leadId;
  if (!client?.email) throw new Error("Client email not found");

  const sections = proposal.content?.sections || [];
  let itemsHtml = "";
  sections.forEach(section => {
    itemsHtml += `<tr><td colspan="4" style="background-color: #f3f4f6; font-weight: bold; padding: 10px;">${section.title}</td></tr>`;
    section.structure?.rows?.forEach(row => {
      if (!row.isGroupHeader) {
        const cols = section.structure.columns;
        const name = row.cells[cols.find(c => c.label.toLowerCase().includes('item') || c.label.toLowerCase().includes('work'))?.id] || 'Item';
        const amount = row.cells[cols.find(c => c.label.toLowerCase().includes('amount') || c.label.toLowerCase().includes('total'))?.id] || '0';
        itemsHtml += `<tr><td style="padding: 8px; border-bottom: 1px solid #eee;">${name}</td><td colspan="3" style="text-align: right; padding: 8px;">₹${amount}</td></tr>`;
      }
    });
  });

  await sendEmail({
    to: client.email,
    subject: `Proposal Approved: ${proposal.title} - JJ Studio`,
    html: `<div style="font-family: sans-serif; max-width: 600px;">
      <h2>Hello ${client.name},</h2>
      <p>Your proposal for <b>${proposal.title}</b> has been approved by our manager and is ready for your review.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">${itemsHtml}</table>
      <div style="background: #f9fafb; padding: 20px; border-radius: 12px;">
        <p><b>Final Amount: ₹${proposal.finalAmount.toLocaleString('en-IN')}</b></p>
      </div>
      <p>Please log in to our portal to complete the eSign and process the advance payment to start the project.</p>
    </div>`
  });
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

// SEND PROPOSAL EMAIL (Manual trigger)
const sendProposalEmail = async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id).populate("leadId", "name email phone");
    await triggerSendToClient(proposal);
    proposal.status = "sent";
    await proposal.save();
    res.status(200).json({ message: "Proposal email sent successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createProposal, getProposals, updateProposalStatus, deleteProposal, getProposalById, updateProposal, sendProposalEmail }