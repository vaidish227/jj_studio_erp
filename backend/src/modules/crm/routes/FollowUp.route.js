const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");

const { createFollowup, getAllFollowups, getFollowupsByLead, updateFollowup, updateStatus, deleteFollowup, getPendingFollowups} = require("../controllers/FollowUp.controller");

// ── Phase 2 Stage 2 — READ enforcement (alias: clients.read / crm.read) ──
// ── Phase 2 Stage 4 — WRITE enforcement (aliases: crm.create/update/delete) ──
router.post("/create", requirePermission("crm.followup.create"), createFollowup);
router.get("/get", requirePermission("crm.lead.read"), getAllFollowups);
router.get("/get/:leadId", requirePermission("crm.lead.read"), getFollowupsByLead);
router.put("/update/:id", requirePermission("crm.followup.update"), updateFollowup);
router.patch("/updatestatus/:id", requirePermission("crm.followup.update"), updateStatus);
router.delete("/delete/:id", requirePermission("crm.followup.delete"), deleteFollowup);
router.get("/total", requirePermission("crm.lead.read"), getPendingFollowups)

module.exports = router;