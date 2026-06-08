const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");

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
  markInterested,
} = require("../controllers/CRMClient.controller");

// ─── All lead routes now proxy to the unified CRMClient controller ──
router.post("/createlead", createClientEnquiry);
// ── Phase 2 Stage 2 — READ enforcement (alias: clients.read / crm.read) ──
router.get("/getlead", requirePermission("crm.lead.read"), getClients);
router.get("/get/:id", requirePermission("crm.lead.read"), getClientById);
router.put("/update/:id", updateClientDetails);
router.patch("/updatestatus/:id", updateClientStatus);
router.post("/automation/thank-you/:id", triggerThankYouAutomation);
router.patch("/show-project/:id", recordShowProject);
router.patch("/advance-payment/:id", recordAdvancePayment);
router.patch("/mark-interested/:id", markInterested);
router.delete("/delete/:id", deleteClient);
router.post("/convert/:id", convertClient);
router.get("/total", requirePermission("crm.lead.read"), getStats);
router.get("/coverted", requirePermission("crm.lead.read"), async (req, res) => {
  try {
    const CRMClient = require("../models/CRMClient.model");
    const convertedLeads = await CRMClient.countDocuments({ status: "converted" });
    res.status(200).json({ convertedLeads });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;