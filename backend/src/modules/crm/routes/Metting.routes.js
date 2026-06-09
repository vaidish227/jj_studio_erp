const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");

const { createMeeting, getMeetingsByLead, updateMeeting, getAllMeetings, deleteMeeting, getTodayMeetings, getTotalMeetings, recordMOM, getMOM } = require("../controllers/Metting.controller");

// ── Phase 2 Stage 2 — READ enforcement (alias: clients.read / crm.read) ──
// ── Phase 2 Stage 4 — WRITE enforcement (aliases: crm.create/update/delete) ──
router.post("/create", requirePermission("crm.meeting.create"), createMeeting);
router.get("/get/:leadId", requirePermission("crm.lead.read"), getMeetingsByLead);
router.put("/update/:id", requirePermission("crm.meeting.update"), updateMeeting);
router.get("/get", requirePermission("crm.lead.read"), getAllMeetings);
router.delete("/delete/:id", requirePermission("crm.meeting.delete"), deleteMeeting);
router.get("/getmetting", requirePermission("crm.lead.read"), getTodayMeetings);
router.get("/gettotal", requirePermission("crm.lead.read"), getTotalMeetings);
router.put("/mom/:id", requirePermission("crm.mom.create"), recordMOM);
router.get("/mom/:id", requirePermission("crm.lead.read"), getMOM);



module.exports = router;