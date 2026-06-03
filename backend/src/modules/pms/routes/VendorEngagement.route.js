const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  createEngagement,
  getEngagementsByProject,
  getEngagementById,
  recordQuote,
  recordClientApproval,
  emitPO,
  markDelivered,
  markSiteReceived,
  cancelEngagement,
} = require("../controllers/VendorEngagement.controller");

router.post("/create", requirePermission("vendor.update"), createEngagement);
router.get("/project/:projectId", requirePermission("vendor.read"), getEngagementsByProject);
router.get("/:id", requirePermission("vendor.read"), getEngagementById);

router.patch("/:id/quote", requirePermission("vendor.update"), recordQuote);
router.patch("/:id/client-approval", requirePermission("vendor.update"), recordClientApproval);
router.post("/:id/emit-po", requirePermission("purchase_orders.create"), emitPO);
router.patch("/:id/delivered", requirePermission("vendor.update"), markDelivered);
router.patch("/:id/site-received", requirePermission("vendor.update"), markSiteReceived);
router.patch("/:id/cancel", requirePermission("vendor.update"), cancelEngagement);

module.exports = router;
