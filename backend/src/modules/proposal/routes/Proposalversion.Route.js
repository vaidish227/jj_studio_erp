const express = require("express");
const router = express.Router();

const {
  createProposalVersion,
  getVersionsByProposal,
  getVersionById,
} = require("../controllers/ProposalVersion.controller");


router.post("/create", createProposalVersion);
router.get("/get/:proposalId", getVersionsByProposal);
router.get("/single/:id", getVersionById);

module.exports = router;