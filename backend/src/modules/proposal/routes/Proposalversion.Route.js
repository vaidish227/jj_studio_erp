const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");

const {
  createProposalVersion,
  getVersionsByProposal,
  getVersionById,
} = require("../controllers/ProposalVersion.controller");


router.get("/get/:proposalId", requirePermission("proposal.read"),   getVersionsByProposal);
router.get("/single/:id",      requirePermission("proposal.read"),   getVersionById);
router.post("/create",         requirePermission("proposal.update"), createProposalVersion);

module.exports = router;