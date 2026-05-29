const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const { createApproval, updateApprovalStatus, getApprovalsByProposal } = require("../controllers/Approval.controller");

router.get("/get/:proposalId", requirePermission("proposal.read"),    getApprovalsByProposal);
router.post("/create",         requirePermission("proposal.create"),  createApproval);
router.patch("/update/:id",    requirePermission("proposal.approve"), updateApprovalStatus);

module.exports = router;