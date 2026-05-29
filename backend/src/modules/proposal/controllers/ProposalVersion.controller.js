const ProposalVersion = require("../models/Proposal_version.model");
const Proposal = require("../../crm/models/Proposal.model");
const mongoose = require("mongoose");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Cap snapshot history per proposal to keep storage bounded. Override via env
// when you need longer audit retention. 50 versions covers any realistic
// edit-cycle while keeping a 200KB proposal at ~10MB worst-case. (#39)
const VERSION_RETENTION = Math.max(5, parseInt(process.env.PROPOSAL_VERSION_RETENTION, 10) || 50);

const pruneOldVersions = async (proposalId) => {
  // Find the cutoff version number, then delete everything below it. Doing this
  // by version (not by createdAt) means we never prune the latest record even
  // if clock skew somehow rewrites timestamps.
  const survivors = await ProposalVersion
    .find({ proposalId })
    .sort({ version: -1 })
    .limit(VERSION_RETENTION)
    .select("version")
    .lean();
  if (survivors.length < VERSION_RETENTION) return;
  const cutoff = survivors[survivors.length - 1].version;
  await ProposalVersion.deleteMany({ proposalId, version: { $lt: cutoff } });
};

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

    // Retry on duplicate-key (E11000) — another request grabbed the same
    // version number first. The schema now enforces uniqueness on (proposalId, version).
    const snapshot = proposal.toObject();
    let version = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const lastVersion = await ProposalVersion.findOne({ proposalId }).sort({ version: -1 });
      const newVersionNumber = lastVersion ? lastVersion.version + 1 : 1;
      try {
        version = await ProposalVersion.create({
          proposalId,
          version: newVersionNumber,
          snapshot,
        });
        break;
      } catch (err) {
        if (err?.code !== 11000) throw err;
        // duplicate-key → loop and pick the next number
      }
    }

    if (!version) {
      return res.status(409).json({ message: "Could not allocate a version number after retries" });
    }

    // Best-effort prune — never fails the request if pruning trips.
    pruneOldVersions(proposalId).catch((err) =>
      console.error("[ProposalVersion] prune failed:", err.message)
    );

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