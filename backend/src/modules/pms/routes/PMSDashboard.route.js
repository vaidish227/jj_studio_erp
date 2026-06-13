const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  getGlobalStats,
  getProjectDashboard,
  getUserDashboard,
} = require("../controllers/PMSDashboard.controller");
const {
  getOverview, getDesignerKRA, getDesignerDetail, downloadDesignerReportPdf, getAnalytics,
  getProjectPendingApproval, getAlerts,
  getDesignerKpiReport, getProjectSummaryReport,
} = require("../controllers/DashboardOverview.controller");

router.get("/overview",              requirePermission("projects.read"),  getOverview);
router.get("/designer-kra",          requirePermission("projects.read"),  getDesignerKRA);
router.get("/designer/:userId",      requirePermission("projects.read"),  getDesignerDetail);
router.get("/designer/:userId/report.pdf", requirePermission("projects.read"), downloadDesignerReportPdf);
router.get("/analytics",             requirePermission("projects.read"),  getAnalytics);
router.get("/reports/designer-kpi",      requirePermission("projects.read"), getDesignerKpiReport);
router.get("/reports/project-summary",   requirePermission("projects.read"), getProjectSummaryReport);
router.get("/alerts",                requirePermission("projects.read"),  getAlerts);
router.get("/project/:projectId/pending-md-approval", requirePermission("projects.read"), getProjectPendingApproval);
router.get("/global-stats",          requirePermission("dashboard.read"), getGlobalStats);
router.get("/project/:projectId",    requirePermission("projects.read"),  getProjectDashboard);
router.get("/user",                  requirePermission("projects.read"),  getUserDashboard);

module.exports = router;
