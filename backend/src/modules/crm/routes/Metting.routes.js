const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");

const { createMeeting, getMeetingsByLead, updateMeeting, getAllMeetings, deleteMeeting, getTodayMeetings, getTotalMeetings, recordMOM, getMOM } = require("../controllers/Metting.controller");

// ── Phase 2 Stage 2 — READ enforcement only (alias: clients.read / crm.read) ──
router.post("/create", createMeeting);
router.get("/get/:leadId", requirePermission("crm.lead.read"), getMeetingsByLead);
router.put("/update/:id", updateMeeting);
router.get("/get", requirePermission("crm.lead.read"), getAllMeetings);
router.delete("/delete/:id", deleteMeeting);
router.get("/getmetting", requirePermission("crm.lead.read"), getTodayMeetings);
router.get("/gettotal", requirePermission("crm.lead.read"), getTotalMeetings);
router.put("/mom/:id", recordMOM);
router.get("/mom/:id", requirePermission("crm.lead.read"), getMOM);



module.exports = router;