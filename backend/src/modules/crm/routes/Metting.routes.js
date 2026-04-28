const express = require("express");
const router = express.Router();

const { createMeeting, getMeetingsByLead, updateMeeting, getAllMeetings, deleteMeeting, getTodayMeetings, getTotalMeetings } = require("../controllers/Metting.controller");

router.post("/create", createMeeting);
router.get("/get/:leadId", getMeetingsByLead);
router.put("/update/:id", updateMeeting);
router.get("/get", getAllMeetings);
router.delete("/delete/:id", deleteMeeting);
router.get("/getmetting", getTodayMeetings);
router.get("/gettotal", getTotalMeetings)



module.exports = router;