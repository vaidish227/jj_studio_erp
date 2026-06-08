const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");

const { createFollowup, getAllFollowups, getFollowupsByLead, updateFollowup, updateStatus, deleteFollowup, getPendingFollowups} = require("../controllers/FollowUp.controller");

// ── Phase 2 Stage 2 — READ enforcement only (alias: clients.read / crm.read) ──
router.post("/create", createFollowup);
router.get("/get", requirePermission("crm.lead.read"), getAllFollowups);
router.get("/get/:leadId", requirePermission("crm.lead.read"), getFollowupsByLead);
router.put("/update/:id", updateFollowup);
router.patch("/updatestatus/:id", updateStatus);
router.delete("/delete/:id", deleteFollowup);
router.get("/total", requirePermission("crm.lead.read"), getPendingFollowups)

module.exports = router;