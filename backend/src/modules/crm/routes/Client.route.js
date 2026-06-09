const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");

const {
  createClientEnquiry,
  getClients,
  getClientById,
  updateClientDetails,
  updateClientStatus,
  deleteClient,
  appendTimelineEvent,
  getStats,
  bulkImportClients,
} = require("../controllers/CRMClient.controller");

const { getCRMDashboard } = require("../controllers/CRMDashboard.controller");

// ─── Client Lifecycle Routes ─────────────────────────────────────────
// ── Phase 2 Stage 2 — READ enforcement (alias: clients.read / crm.read) ──
// ── Phase 2 Stage 4 — WRITE enforcement (aliases: crm.create/update/delete) ──
router.post("/create", requirePermission("crm.lead.create"), createClientEnquiry);        // Enquiry form → create
router.post("/createclient", requirePermission("crm.lead.create"), createClientEnquiry);  // Backward compat alias
router.post("/bulk-import", requirePermission("crm.lead.import"), bulkImportClients);      // Bulk CSV/Excel import
router.get("/get", requirePermission("crm.lead.read"), getClients);            // List all
router.get("/get/:id", requirePermission("crm.lead.read"), getClientById);     // Get by ID
router.put("/update/:id", requirePermission("crm.lead.update"), updateClientDetails);   // Client info form → enrich
router.patch("/status/:id", requirePermission("crm.lead.update"), updateClientStatus);  // Status + lifecycle update
router.delete("/delete/:id", requirePermission("crm.lead.delete"), deleteClient);       // Delete
router.post("/timeline/:id", requirePermission("crm.lead.update"), appendTimelineEvent); // Append timeline event
router.get("/totalclient", requirePermission("crm.lead.read"), getStats);      // Stats endpoint
router.get("/dashboard", requirePermission("crm.lead.read"), getCRMDashboard); // CRM analytics dashboard

module.exports = router;