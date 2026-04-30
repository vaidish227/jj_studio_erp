const mongoose = require("mongoose");
const Lead = require("../../crm/models/Lead.model");
const QuotationTemplate = require("../models/QuotationTemplate.model");
const Proposal = require("../models/Proposal.model");
const ProposalItem = require("../models/ProposalItem.model");
const ProposalApproval = require("../models/Approval.model");
const ProposalESign = require("../models/ESign.model");
const ProposalPayment = require("../models/Payment.model");
const ProposalStatusHistory = require("../models/ProposalStatusHistory.model");
const { isTransitionAllowed, recordStatusChange } = require("../services/proposalLifecycle.service");
const sendEmail = require("../../crm/utils/sendEmail");

const parseActor = (req) => req.headers["x-user-id"] || null;

const generateProposalNumber = () => `PR-${Date.now()}`;

const calculateTotals = (items = [], gstPercent = 18, discount = 0) => {
  const normalizedItems = items.map((item, idx) => {
    const qty = Number(item.qty || 0);
    const rate = Number(item.rate || 0);
    return {
      ...item,
      qty,
      rate,
      sortOrder: idx,
      amount: qty * rate,
    };
  });
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.amount, 0);
  const gstAmount = (subtotal * Number(gstPercent || 0)) / 100;
  const finalAmount = subtotal + gstAmount - Number(discount || 0);
  return { normalizedItems, subtotal, gstAmount, finalAmount };
};

const createTemplate = async (req, res) => {
  try {
    const template = await QuotationTemplate.create(req.body);
    return res.status(201).json({ success: true, message: "Template created", data: template });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getTemplates = async (_req, res) => {
  try {
    const templates = await QuotationTemplate.find().sort({ createdAt: -1 });
    return res.json({ success: true, data: templates });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateTemplate = async (req, res) => {
  try {
    const template = await QuotationTemplate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!template) return res.status(404).json({ success: false, message: "Template not found" });
    return res.json({ success: true, message: "Template updated", data: template });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createProposal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { leadId, templateId, items = [], gstPercent = 18, discount = 0, remarks = "" } = req.body;
    if (!leadId) return res.status(400).json({ success: false, message: "leadId is required" });

    const lead = await Lead.findById(leadId);
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    let template = null;
    if (templateId) template = await QuotationTemplate.findById(templateId);
    const sourceItems = items.length ? items : template?.items || [];
    if (!sourceItems.length) return res.status(400).json({ success: false, message: "Proposal items are required" });

    const { normalizedItems, subtotal, gstAmount, finalAmount } = calculateTotals(sourceItems, gstPercent, discount);

    const proposal = await Proposal.create(
      [
        {
          leadId: lead._id,
          clientId: lead.clientId || null,
          templateId: template?._id || null,
          proposalNumber: generateProposalNumber(),
          subtotal,
          gstPercent,
          gstAmount,
          discount,
          finalAmount,
          currentStatus: "draft",
          remarks,
        },
      ],
      { session }
    );

    const proposalDoc = proposal[0];
    await ProposalItem.insertMany(
      normalizedItems.map((item) => ({ ...item, proposalId: proposalDoc._id })),
      { session }
    );

    await ProposalApproval.create([{ proposalId: proposalDoc._id, status: "pending", level: "manager" }], { session });
    await ProposalStatusHistory.create(
      [{ proposalId: proposalDoc._id, fromStatus: null, toStatus: "draft", changedAt: new Date() }],
      { session }
    );

    await session.commitTransaction();
    return res.status(201).json({ success: true, message: "Proposal created", data: proposalDoc });
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

const getProposals = async (req, res) => {
  try {
    const { leadId, status, client, dateFrom, dateTo, day, page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = req.query;
    const filter = {};
    if (leadId) filter.leadId = leadId;
    if (status) filter.currentStatus = status;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }
    if (day) {
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(day);
      end.setHours(23, 59, 59, 999);
      filter.createdAt = { ...(filter.createdAt || {}), $gte: start, $lte: end };
    }

    const numericLimit = Math.max(Number(limit) || 20, 1);
    const numericPage = Math.max(Number(page) || 1, 1);
    const skip = (numericPage - 1) * numericLimit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    let query = Proposal.find(filter)
      .populate("leadId", "name phone email")
      .populate("templateId", "name category")
      .sort(sort);

    const proposalsRaw = await query.skip(skip).limit(numericLimit);
    const proposals = client
      ? proposalsRaw.filter((item) =>
        item.leadId?.name?.toLowerCase().includes(String(client).toLowerCase())
      )
      : proposalsRaw;
    const total = await Proposal.countDocuments(filter);

    return res.json({
      success: true,
      data: proposals,
      meta: { page: numericPage, limit: numericLimit, total },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getProposalById = async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
      .populate("leadId", "name phone email lifecycleStage status")
      .populate("templateId", "name category");
    if (!proposal) return res.status(404).json({ success: false, message: "Proposal not found" });

    const [items, approvals, esign, payments, history] = await Promise.all([
      ProposalItem.find({ proposalId: proposal._id }).sort({ sortOrder: 1 }),
      ProposalApproval.find({ proposalId: proposal._id }).sort({ createdAt: -1 }),
      ProposalESign.find({ proposalId: proposal._id }).sort({ createdAt: -1 }),
      ProposalPayment.find({ proposalId: proposal._id }).sort({ createdAt: -1 }),
      ProposalStatusHistory.find({ proposalId: proposal._id }).sort({ changedAt: -1 }),
    ]);

    return res.json({
      success: true,
      data: { proposal, items, approvals, esign, payments, history },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status, reason = "" } = req.body;
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) return res.status(404).json({ success: false, message: "Proposal not found" });
    if (!isTransitionAllowed(proposal.currentStatus, status)) {
      return res.status(409).json({ success: false, message: `Transition not allowed from ${proposal.currentStatus} to ${status}` });
    }

    const fromStatus = proposal.currentStatus;
    proposal.currentStatus = status;
    if (status === "sent") proposal.sentAt = new Date();
    await proposal.save();

    await recordStatusChange({
      proposal,
      fromStatus,
      toStatus: status,
      changedBy: parseActor(req),
      reason,
    });

    return res.json({ success: true, message: "Status updated", data: proposal });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const approveOrReject = async (req, res) => {
  try {
    const { decision, note = "" } = req.body;
    if (!["approved", "rejected", "modify"].includes(decision)) {
      return res.status(400).json({ success: false, message: "decision must be approved, rejected, or modify" });
    }
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) return res.status(404).json({ success: false, message: "Proposal not found" });

    const approval = await ProposalApproval.findOneAndUpdate(
      { proposalId: proposal._id, level: "manager" },
      { status: decision, note, actedBy: parseActor(req), actedAt: new Date() },
      { new: true, upsert: true }
    );

    const targetStatus = decision === "approved" ? "approved" : decision === "modify" ? "draft" : "rejected";
    if (isTransitionAllowed(proposal.currentStatus, targetStatus)) {
      const fromStatus = proposal.currentStatus;
      proposal.currentStatus = targetStatus;
      await proposal.save();
      await recordStatusChange({
        proposal,
        fromStatus,
        toStatus: targetStatus,
        changedBy: parseActor(req),
        reason: note,
      });
    }

    return res.json({ success: true, message: `Proposal ${decision}`, data: approval });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const sendProposal = async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id).populate("leadId", "name email phone");
    if (!proposal) return res.status(404).json({ success: false, message: "Proposal not found" });
    if (!isTransitionAllowed(proposal.currentStatus, "sent")) {
      return res.status(409).json({ success: false, message: "Proposal cannot be sent at current stage" });
    }

    if (proposal.leadId?.email) {
      await sendEmail({
        to: proposal.leadId.email,
        subject: `Quotation ${proposal.proposalNumber} from JJ Studio`,
        html: `
          <h3>Hello ${proposal.leadId?.name || "Client"},</h3>
          <p>Your proposal <b>${proposal.proposalNumber}</b> is ready.</p>
          <p>Total amount: Rs. ${Number(proposal.finalAmount || 0).toLocaleString("en-IN")}</p>
          <p>Regards,<br/>JJ Studio</p>
        `,
      });
    }

    const fromStatus = proposal.currentStatus;
    proposal.currentStatus = "sent";
    proposal.sentAt = new Date();
    await proposal.save();
    await recordStatusChange({
      proposal,
      fromStatus,
      toStatus: "sent",
      changedBy: parseActor(req),
      reason: req.body.reason || "",
      metadata: {
        channels: ["email", "whatsapp"],
        whatsappMessage: `Quotation ${proposal.proposalNumber} sent. Total Rs. ${Number(
          proposal.finalAmount || 0
        ).toLocaleString("en-IN")}`,
      },
    });

    return res.json({
      success: true,
      message: "Proposal sent to client",
      data: {
        proposalId: proposal._id,
        email: proposal.leadId?.email || null,
        whatsapp: proposal.leadId?.phone || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const recordESign = async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) return res.status(404).json({ success: false, message: "Proposal not found" });
    if (!isTransitionAllowed(proposal.currentStatus, "esign_received")) {
      return res.status(409).json({ success: false, message: "Cannot record eSign at current stage" });
    }

    const entry = await ProposalESign.create({
      proposalId: proposal._id,
      leadId: proposal.leadId,
      ...req.body,
      status: req.body.status || "received",
    });

    const fromStatus = proposal.currentStatus;
    proposal.currentStatus = "esign_received";
    await proposal.save();
    await recordStatusChange({
      proposal,
      fromStatus,
      toStatus: "esign_received",
      changedBy: parseActor(req),
      reason: req.body.note || "",
    });

    return res.status(201).json({ success: true, message: "eSign recorded", data: entry });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const recordPayment = async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) return res.status(404).json({ success: false, message: "Proposal not found" });
    if (!isTransitionAllowed(proposal.currentStatus, "advance_received")) {
      return res.status(409).json({ success: false, message: "Cannot record advance at current stage" });
    }

    const payment = await ProposalPayment.create({
      proposalId: proposal._id,
      leadId: proposal.leadId,
      ...req.body,
      type: "advance",
      status: "received",
      recordedBy: parseActor(req),
    });

    const fromStatus = proposal.currentStatus;
    proposal.currentStatus = "advance_received";
    await proposal.save();
    await recordStatusChange({
      proposal,
      fromStatus,
      toStatus: "advance_received",
      changedBy: parseActor(req),
      reason: req.body.note || "",
    });

    return res.status(201).json({ success: true, message: "Advance payment recorded", data: payment });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getDashboardSummary = async (_req, res) => {
  try {
    const grouped = await Proposal.aggregate([
      { $group: { _id: "$currentStatus", count: { $sum: 1 } } },
    ]);
    const counts = grouped.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {});
    return res.json({ success: true, data: counts });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteProposal = async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) return res.status(404).json({ success: false, message: "Proposal not found" });

    await Promise.all([
      ProposalItem.deleteMany({ proposalId: proposal._id }),
      ProposalApproval.deleteMany({ proposalId: proposal._id }),
      ProposalESign.deleteMany({ proposalId: proposal._id }),
      ProposalPayment.deleteMany({ proposalId: proposal._id }),
      ProposalStatusHistory.deleteMany({ proposalId: proposal._id }),
    ]);
    await Proposal.findByIdAndDelete(proposal._id);

    return res.json({ success: true, message: "Proposal deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createTemplate,
  getTemplates,
  updateTemplate,
  createProposal,
  getProposals,
  getProposalById,
  updateStatus,
  approveOrReject,
  sendProposal,
  recordESign,
  recordPayment,
  getDashboardSummary,
  deleteProposal,
};
