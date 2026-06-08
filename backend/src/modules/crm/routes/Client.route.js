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
router.post("/create", createClientEnquiry);              // Enquiry form → create
router.post("/createclient", createClientEnquiry);        // Backward compat alias
router.post("/bulk-import", bulkImportClients);           // Bulk CSV/Excel import
// ── Phase 2 Stage 2 — READ enforcement (alias: clients.read / crm.read) ──
router.get("/get", requirePermission("crm.lead.read"), getClients);            // List all
router.get("/get/:id", requirePermission("crm.lead.read"), getClientById);     // Get by ID
router.put("/update/:id", updateClientDetails);           // Client info form → enrich
router.patch("/status/:id", updateClientStatus);          // Status + lifecycle update
router.delete("/delete/:id", deleteClient);               // Delete
router.post("/timeline/:id", appendTimelineEvent);        // Append timeline event
router.get("/totalclient", requirePermission("crm.lead.read"), getStats);      // Stats endpoint
router.get("/dashboard", requirePermission("crm.lead.read"), getCRMDashboard); // CRM analytics dashboard

module.exports = router;