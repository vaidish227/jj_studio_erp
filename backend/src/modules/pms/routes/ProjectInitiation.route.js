const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  initiateFromProposal,
  getProposalPreview,
} = require("../controllers/ProjectInitiation.controller");

// Preview: fetch proposal data for the initiation form (read-only)
router.get(
  "/proposal-preview/:proposalId",
  requirePermission("projects.read"),
  getProposalPreview
);

// Initiate: create PMS project from approved proposal
router.post(
  "/from-proposal",
  requirePermission("projects.create"),
  initiateFromProposal
);

module.exports = router;
