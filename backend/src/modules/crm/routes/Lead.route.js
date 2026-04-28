const express = require("express");
const router = express.Router();

const {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  updateLeadStatus,
  deleteLead,
  convertLeadToClient,
  getTotalLeads,
  getConvertedLeads,
  triggerThankYouAutomation,
  recordShowProject,
  recordAdvancePayment,
} = require("../controllers/Lead.controller");

router.post("/createlead", createLead);
router.get("/getlead", getLeads);
router.get("/get/:id", getLeadById);
router.put("/update/:id", updateLead);
router.patch("/updatestatus/:id", updateLeadStatus);
router.post("/automation/thank-you/:id", triggerThankYouAutomation);
router.patch("/show-project/:id", recordShowProject);
router.patch("/advance-payment/:id", recordAdvancePayment);
router.delete("/delete/:id", deleteLead);
router.post("/convert/:id", convertLeadToClient);
router.get("/total", getTotalLeads);
router.get("/coverted", getConvertedLeads)


module.exports = router;