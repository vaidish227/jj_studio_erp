const express = require("express");
const router = express.Router();

const { createMeeting, getMeetingsByLead, updateMeeting, getAllMeetings, deleteMeeting, getTodayMeetings, getTotalMeetings, recordMOM, getMOM } = require("../controllers/Metting.controller");

router.post("/create", createMeeting);
router.get("/get/:leadId", getMeetingsByLead);
router.put("/update/:id", updateMeeting);
router.get("/get", getAllMeetings);
router.delete("/delete/:id", deleteMeeting);
router.get("/getmetting", getTodayMeetings);
router.get("/gettotal", getTotalMeetings);
router.put("/mom/:id", recordMOM);
router.get("/mom/:id", getMOM);



module.exports = router;