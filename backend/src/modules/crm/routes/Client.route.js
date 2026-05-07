const express = require("express");
const router = express.Router();

const {
  createClientEnquiry,
  getClients,
  getClientById,
  updateClientDetails,
  updateClientStatus,
  deleteClient,
  appendTimelineEvent,
  getStats,
} = require("../controllers/CRMClient.controller");

// ─── Client Lifecycle Routes ─────────────────────────────────────────
router.post("/create", createClientEnquiry);              // Enquiry form → create
router.post("/createclient", createClientEnquiry);        // Backward compat alias
router.get("/get", getClients);                           // List all
router.get("/get/:id", getClientById);                    // Get by ID
router.put("/update/:id", updateClientDetails);           // Client info form → enrich
router.patch("/status/:id", updateClientStatus);          // Status + lifecycle update
router.delete("/delete/:id", deleteClient);               // Delete
router.post("/timeline/:id", appendTimelineEvent);        // Append timeline event
router.get("/totalclient", getStats);                     // Stats endpoint

module.exports = router;