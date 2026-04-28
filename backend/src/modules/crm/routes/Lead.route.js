const express = require("express");
const router = express.Router();

const { createLead, getLeads, getLeadById, updateLead, updateLeadStatus, deleteLead ,convertLeadToClient,getTotalLeads, getConvertedLeads} = require("../controllers/Lead.controller");

router.post("/createlead", createLead);
router.get("/getlead", getLeads);
router.get("/get/:id", getLeadById);
router.put("/update/:id", updateLead);
router.patch("/updatestatus/:id", updateLeadStatus);
router.delete("/delete/:id", deleteLead);
router.post("/convert/:id", convertLeadToClient);
router.get("/total", getTotalLeads);
router.get("/coverted", getConvertedLeads)


module.exports = router;