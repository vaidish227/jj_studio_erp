const ESign = require("../models/ESign.model");
const Proposal = require("../../crm/models/Proposal.model");
const mongoose = require("mongoose");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const createESign = async (req, res) => {
  try {
    const { proposalId, signedBy } = req.body;

    if (!proposalId || !signedBy) {
      return res.status(400).json({
        message: "proposalId and signedBy are required",
      });
    }

    if (!isValidId(proposalId)) {
      return res.status(400).json({ message: "Invalid proposalId" });
    }

    const esign = await ESign.create({
      proposalId,
      signedBy,
    });

    res.status(201).json({
      success: true,
      data: esign,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const signProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { signatureUrl } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid eSign id" });
    }

    const esign = await ESign.findById(id);

    if (!esign) {
      return res.status(404).json({ message: "ESign not found" });
    }

    // update sign
    esign.status = "signed";
    esign.signatureUrl = signatureUrl;

    await esign.save();

    // update proposal status
    await Proposal.findByIdAndUpdate(esign.proposalId, {
      status: "client_approved",
    });

    res.status(200).json({
      success: true,
      message: "Proposal signed successfully",
      data: esign,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getESignByProposal = async (req, res) => {
  try {
    const { proposalId } = req.params;

    if (!isValidId(proposalId)) {
      return res.status(400).json({ message: "Invalid proposalId" });
    }

    const esign = await ESign.findOne({ proposalId });

    res.status(200).json({
      success: true,
      data: esign,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createESign, signProposal, getESignByProposal}