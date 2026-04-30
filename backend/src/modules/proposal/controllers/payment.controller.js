const Payment = require("../models/Payment.model");
const Proposal = require("../../crm/models/Proposal.model");
const mongoose = require("mongoose");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const createPayment = async (req, res) => {
  try {
    const { proposalId, leadId, amount, method } = req.body;

    // validation
    if (!proposalId || !leadId || !amount) {
      return res.status(400).json({
        message: "proposalId, leadId, and amount are required",
      });
    }

    if (!isValidId(proposalId) || !isValidId(leadId)) {
      return res.status(400).json({ message: "Invalid IDs" });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ message: "Proposal not found" });
    }

    const payment = await Payment.create({
      proposalId,
      leadId,
      amount,
      method,
      status: "pending",
    });

    res.status(201).json({
      success: true,
      data: payment,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid payment id" });
    }

    if (!["pending", "received"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const payment = await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    payment.status = status;

    if (status === "received") {
      payment.receivedAt = new Date();

      //  OPTIONAL: update proposal status (if needed)
      await Proposal.findByIdAndUpdate(payment.proposalId, {
        status: "client_approved",
      });
    }

    await payment.save();

    res.status(200).json({
      success: true,
      message: "Payment status updated",
      data: payment,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getPaymentByProposal = async (req, res) => {
  try {
    const { proposalId } = req.params;

    if (!isValidId(proposalId)) {
      return res.status(400).json({ message: "Invalid proposalId" });
    }

    const payments = await Payment.find({ proposalId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: payments,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {createPayment, updatePaymentStatus, getPaymentByProposal}