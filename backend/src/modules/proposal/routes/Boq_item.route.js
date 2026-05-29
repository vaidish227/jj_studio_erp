const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const { addBOQItem } = require("../controllers/Boq_item.controller");

router.post("/create", requirePermission("proposal.update"), addBOQItem);

module.exports = router;