const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  gateAging,
  drawingReleaseSLA,
  designerUtilisation,
  vendorPerformance,
  projectProfitability,
} = require("../controllers/Analytics.controller");

// All endpoints are read-only aggregations. Permission: reports.read (existing).
router.get("/gate-aging",            requirePermission("reports.read"), gateAging);
router.get("/drawing-release-sla",   requirePermission("reports.read"), drawingReleaseSLA);
router.get("/designer-utilisation",  requirePermission("reports.read"), designerUtilisation);
router.get("/vendor-performance",    requirePermission("reports.read"), vendorPerformance);
router.get("/project-profitability", requirePermission("reports.read"), projectProfitability);

module.exports = router;
