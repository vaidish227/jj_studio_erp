const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const { getMyDay } = require("../controllers/MyDay.controller");

// Phase 3a — personal action-needed feed.
// Anyone with dashboard read access can call this; the controller filters by req.user._id.
router.get("/", requirePermission("dashboard.read"), getMyDay);

module.exports = router;
