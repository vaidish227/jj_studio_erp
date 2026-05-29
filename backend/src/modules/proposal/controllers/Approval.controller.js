const Approval = require("../models/Approval.model");
const Proposal = require("../../crm/models/Proposal.model");
const mongoose = require("mongoose");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const createApproval = async (req, res) => {
  try {
    const { proposalId, type, note } = req.body;

    // validation
    if (!proposalId || !type) {
      return res.status(400).json({
        message: "proposalId and type are required",
      });
    }

    if (!isValidId(proposalId)) {
      return res.status(400).json({ message: "Invalid proposalId" });
    }

    if (!["internal", "manager"].includes(type)) {
      return res.status(400).json({ message: "Invalid approval type" });
    }

    // check proposal exists
    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ message: "Proposal not found" });
    }

    const approval = await Approval.create({
      proposalId,
      type,
      note,
    });

    res.status(201).json({
      success: true,
      data: approval,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateApprovalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid approval id" });
    }

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const approval = await Approval.findById(id);
    if (!approval) {
      return res.status(404).json({ message: "Approval not found" });
    }

    approval.status = status;
    if (status === "approved" && req.user?.id) {
      approval.approvedBy = req.user.id;
    }
    await approval.save();

    // Only the "manager" approval flow drives the proposal lifecycle.
    // An "internal" approval is recorded but does not change proposal status —
    // there is no matching enum value on the Proposal schema.
    if (status === "approved" && approval.type === "manager") {
      await Proposal.findByIdAndUpdate(approval.proposalId, { status: "manager_approved" });
    }

    if (status === "rejected") {
      await Proposal.findByIdAndUpdate(approval.proposalId, { status: "rejected" });
    }

    res.json({
      success: true,
      message: "Approval updated successfully",
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getApprovalsByProposal = async (req, res) => {
  try {
    const { proposalId } = req.params;

    if (!isValidId(proposalId)) {
      return res.status(400).json({ message: "Invalid proposalId" });
    }

    const approvals = await Approval.find({ proposalId })
      .populate("approvedBy", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: approvals,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createApproval, updateApprovalStatus,getApprovalsByProposal}