const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  createSiteLog,
  getProjectLogs,
  getLogById,
  updateLog,
} = require("../controllers/SiteLog.controller");

router.post("/create",             requirePermission("site_logs.create"), createSiteLog);
router.get("/project/:projectId",  requirePermission("site_logs.read"),   getProjectLogs);
router.get("/:id",                 requirePermission("site_logs.read"),   getLogById);
router.put("/update/:id",          requirePermission("site_logs.create"), updateLog);

module.exports = router;
