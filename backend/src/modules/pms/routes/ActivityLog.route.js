const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const { getProjectActivity } = require("../controllers/ActivityLog.controller");

router.get("/project/:projectId", requirePermission("activity.read"), getProjectActivity);

module.exports = router;
