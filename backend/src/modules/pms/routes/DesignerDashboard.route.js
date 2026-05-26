const express = require("express");
const router  = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const { getDesignerDashboard } = require("../controllers/DesignerDashboard.controller");

// GET /api/pms/designer/dashboard — personalised designer summary
router.get("/dashboard", requirePermission("designer.dashboard"), getDesignerDashboard);

module.exports = router;
