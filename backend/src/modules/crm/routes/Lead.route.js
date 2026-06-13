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
// ── Phase 2 Stage 2 — READ enforcement (alias: clients.read / crm.read) ──
// ── Phase 2 Stage 4 — WRITE enforcement (aliases: crm.create/update/delete) ──
router.post("/createlead", requirePermission("crm.lead.create"), createClientEnquiry);
router.get("/getlead", requirePermission("crm.lead.read"), getClients);
router.get("/get/:id", requirePermission("crm.lead.read"), getClientById);
router.put("/update/:id", requirePermission("crm.lead.update"), updateClientDetails);
router.patch("/updatestatus/:id", requirePermission("crm.lead.update"), updateClientStatus);
router.post("/automation/thank-you/:id", requirePermission("crm.lead.update"), triggerThankYouAutomation);
router.patch("/show-project/:id", requirePermission("crm.lead.update"), recordShowProject);
router.patch("/advance-payment/:id", requirePermission("crm.lead.update"), recordAdvancePayment);
router.patch("/mark-interested/:id", requirePermission("crm.lead.qualify"), markInterested);
router.delete("/delete/:id", requirePermission("crm.lead.delete"), deleteClient);
router.post("/convert/:id", requirePermission("crm.lead.convert"), convertClient);
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