const express = require("express");
const router = express.Router();

// ─── Unified CRMClient controller (primary) ─────────────────────────
const {
  createClientEnquiry,
  getClients,
  getClientById,
  updateClientDetails,
  updateClientStatus,
  deleteClient,
  convertClient,
  getStats,
  triggerThankYouAutomation,
  recordShowProject,
  recordAdvancePayment,
} = require("../controllers/CRMClient.controller");

// ─── All lead routes now proxy to the unified CRMClient controller ──
router.post("/createlead", createClientEnquiry);
router.get("/getlead", getClients);
router.get("/get/:id", getClientById);
router.put("/update/:id", updateClientDetails);
router.patch("/updatestatus/:id", updateClientStatus);
router.post("/automation/thank-you/:id", triggerThankYouAutomation);
router.patch("/show-project/:id", recordShowProject);
router.patch("/advance-payment/:id", recordAdvancePayment);
router.delete("/delete/:id", deleteClient);
router.post("/convert/:id", convertClient);
router.get("/total", getStats);
router.get("/coverted", async (req, res) => {
  try {
    const CRMClient = require("../models/CRMClient.model");
    const convertedLeads = await CRMClient.countDocuments({ status: "converted" });
    res.status(200).json({ convertedLeads });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;