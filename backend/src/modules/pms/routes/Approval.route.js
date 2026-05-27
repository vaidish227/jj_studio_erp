const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  requestApproval,
  getProjectApprovals,
  respondToApproval,
  getPendingApprovals,
} = require("../controllers/Approval.controller");

router.post("/request",              requirePermission("approvals.create"),  requestApproval);
router.get("/project/:projectId",    requirePermission("approvals.read"),    getProjectApprovals);
router.get("/pending/:userId",       requirePermission("approvals.read"),    getPendingApprovals);
router.patch("/respond/:id",         requirePermission("approvals.respond"), respondToApproval);

module.exports = router;
