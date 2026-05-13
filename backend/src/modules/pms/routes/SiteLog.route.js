const express = require("express");
const router = express.Router();
const {
  createSiteLog,
  getProjectLogs,
  getLogById,
  updateLog,
} = require("../controllers/SiteLog.controller");

// Create Daily Log
router.post("/create", createSiteLog);

// Get Logs for Project
router.get("/project/:projectId", getProjectLogs);

// Get Single Log
router.get("/:id", getLogById);

// Update Log (Review/Status)
router.put("/update/:id", updateLog);

module.exports = router;
