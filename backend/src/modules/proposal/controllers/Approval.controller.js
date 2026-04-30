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

    const approval = await Approval.findById(id);

    if (!approval) {
      return res.status(404).json({ message: "Approval not found" });
    }

    approval.status = status;
    await approval.save();

    //  SAFE UPDATE (NO VALIDATION ERROR)
    if (status === "approved") {
      if (approval.type === "internal") {
        await Proposal.findByIdAndUpdate(
          approval.proposalId,
          { status: "internal_approved" }
        );
      }

      if (approval.type === "manager") {
        await Proposal.findByIdAndUpdate(
          approval.proposalId,
          { status: "manager_approved" }
        );
      }
    }

    if (status === "rejected") {
      await Proposal.findByIdAndUpdate(
        approval.proposalId,
        { status: "rejected" }
      );
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
      .populate("approvedBy")
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