const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const { getMDOverview } = require("../controllers/MDDashboard.controller");

router.get("/overview", requirePermission("md.dashboard.read"), getMDOverview);

module.exports = router;
