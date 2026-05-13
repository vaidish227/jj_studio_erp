const express = require("express");
const router = express.Router();
const {
  getGlobalStats,
  getProjectDashboard,
  getUserDashboard,
} = require("../controllers/PMSDashboard.controller");

// Global Stats (Admin/Management View)
router.get("/global-stats", getGlobalStats);

// Single Project Stats (Project Manager View)
router.get("/project/:projectId", getProjectDashboard);

// User specific tasks (Designer/Supervisor View)
router.get("/user", getUserDashboard);

module.exports = router;
