const express = require("express");
const router = express.Router();
const {
  requestApproval,
  getProjectApprovals,
  respondToApproval,
  getPendingApprovals,
} = require("../controllers/Approval.controller");

// Request Approval
router.post("/request", requestApproval);

// Get Approvals for a Project
router.get("/project/:projectId", getProjectApprovals);

// Get Pending Approvals for a specific user
router.get("/pending/:userId", getPendingApprovals);

// Respond to Approval (Approve/Reject)
router.patch("/respond/:id", respondToApproval);

module.exports = router;
