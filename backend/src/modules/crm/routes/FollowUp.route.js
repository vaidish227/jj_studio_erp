const express = require("express");
const router = express.Router();

const { createFollowup, getAllFollowups, getFollowupsByLead, updateFollowup, updateStatus, deleteFollowup, getPendingFollowups} = require("../controllers/FollowUp.controller");


router.post("/create", createFollowup);
router.get("/get", getAllFollowups);
router.get("/get/:leadId", getFollowupsByLead);
router.put("/update/:id", updateFollowup);
router.patch("/updatestatus/:id", updateStatus);
router.delete("/delete/:id", deleteFollowup);
router.get("/total", getPendingFollowups)

module.exports = router;