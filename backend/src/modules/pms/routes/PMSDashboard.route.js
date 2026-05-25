const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  getGlobalStats,
  getProjectDashboard,
  getUserDashboard,
} = require("../controllers/PMSDashboard.controller");

router.get("/global-stats",          requirePermission("dashboard.read"), getGlobalStats);
router.get("/project/:projectId",    requirePermission("projects.read"),  getProjectDashboard);
router.get("/user",                  requirePermission("projects.read"),  getUserDashboard);

module.exports = router;
