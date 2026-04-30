const ProposalVersion = require("../models/Proposal_version.model");
const Proposal = require("../../crm/models/Proposal.model");
const mongoose = require("mongoose");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const createProposalVersion = async (req, res) => {
  try {
    const { proposalId } = req.body;

    if (!proposalId) {
      return res.status(400).json({
        message: "proposalId is required",
      });
    }

    if (!isValidId(proposalId)) {
      return res.status(400).json({ message: "Invalid proposalId" });
    }

    const proposal = await Proposal.findById(proposalId);

    if (!proposal) {
      return res.status(404).json({ message: "Proposal not found" });
    }

    //  find last version
    const lastVersion = await ProposalVersion.findOne({ proposalId })
      .sort({ version: -1 });

    const newVersionNumber = lastVersion ? lastVersion.version + 1 : 1;

    const version = await ProposalVersion.create({
      proposalId,
      version: newVersionNumber,
      snapshot: proposal.toObject(),
    });

    res.status(201).json({
      success: true,
      data: version,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getVersionsByProposal = async (req, res) => {
  try {
    const { proposalId } = req.params;

    if (!isValidId(proposalId)) {
      return res.status(400).json({ message: "Invalid proposalId" });
    }

    const versions = await ProposalVersion.find({ proposalId })
      .sort({ version: -1 });

    res.status(200).json({
      success: true,
      data: versions,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getVersionById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const version = await ProposalVersion.findById(id);

    if (!version) {
      return res.status(404).json({ message: "Version not found" });
    }

    res.status(200).json({
      success: true,
      data: version,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {createProposalVersion, getVersionsByProposal, getVersionById}