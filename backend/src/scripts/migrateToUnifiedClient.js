/**
 * ═══════════════════════════════════════════════════════════════════════
 *  MIGRATION SCRIPT: Unify leads + clients → crm_clients
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Strategy:
 *   1. Read all documents from `leads` collection
 *   2. For each Lead, find its matching Client (via Lead.clientId or Client.leadId)
 *   3. Create a CRMClient document REUSING the Lead's _id
 *      (so Meeting, FollowUp, Proposal foreign keys don't break)
 *   4. Merge Client extended fields into the CRMClient record
 *   5. Preserve all interactionHistory events
 *   6. Generate trackingId for each record
 *
 *  Usage:
 *    node src/scripts/migrateToUnifiedClient.js               (dry run)
 *    node src/scripts/migrateToUnifiedClient.js --execute      (real run)
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

const mongoose = require("mongoose");
require("dotenv").config();

// ─── Connect to MongoDB ──────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/jjstudio";

// ─── Define raw schemas for reading old collections ──────────────────
const LeadRaw = mongoose.model(
  "LeadRaw",
  new mongoose.Schema({}, { strict: false, collection: "leads" })
);

const ClientRaw = mongoose.model(
  "ClientRaw",
  new mongoose.Schema({}, { strict: false, collection: "clients" })
);

// Import the target model
const CRMClient = require("../modules/crm/models/CRMClient.model");

const isDryRun = !process.argv.includes("--execute");

async function migrate() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");
    console.log(isDryRun ? "🔍 DRY RUN MODE (no writes)" : "🚀 EXECUTE MODE");
    console.log("─".repeat(60));

    // ── Step 1: Read all leads ────────────────────────────────────────
    const leads = await LeadRaw.find({}).lean();
    console.log(`📋 Found ${leads.length} leads in 'leads' collection`);

    // ── Step 2: Read all clients ──────────────────────────────────────
    const clients = await ClientRaw.find({}).lean();
    console.log(`📋 Found ${clients.length} clients in 'clients' collection`);

    // ── Step 3: Check existing CRMClient records ──────────────────────
    const existingCRM = await CRMClient.find({}).lean();
    const existingIds = new Set(existingCRM.map((c) => c._id.toString()));
    console.log(`📋 Found ${existingCRM.length} existing records in 'crmclients'`);
    console.log("─".repeat(60));

    // ── Build Client lookup by leadId ─────────────────────────────────
    const clientByLeadId = {};
    for (const client of clients) {
      if (client.leadId) {
        clientByLeadId[client.leadId.toString()] = client;
      }
    }

    // Also build by _id for Lead.clientId lookup
    const clientById = {};
    for (const client of clients) {
      clientById[client._id.toString()] = client;
    }

    let created = 0;
    let skipped = 0;
    let merged = 0;
    let errors = 0;

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      const leadId = lead._id.toString();

      // Skip if already migrated
      if (existingIds.has(leadId)) {
        console.log(`⏭️  [${i + 1}/${leads.length}] ${lead.name} — already migrated`);
        skipped++;
        continue;
      }

      // Find matching client
      let matchingClient = null;
      if (lead.clientId) {
        matchingClient = clientById[lead.clientId.toString()] || null;
      }
      if (!matchingClient) {
        matchingClient = clientByLeadId[leadId] || null;
      }

      // ── Build unified record ────────────────────────────────────────
      const year = new Date(lead.createdAt || Date.now()).getFullYear();
      const trackingId = `CLI-${year}-${String(created + existingCRM.length + 1).padStart(4, "0")}`;

      const unifiedData = {
        _id: lead._id, // REUSE the Lead's _id
        trackingId,
        source: lead.referredBy ? "referral" : "walk_in",

        // Core fields from Lead
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        projectType: lead.projectType,
        area: lead.area,
        budget: lead.budget,
        city: lead.city,
        referredBy: lead.referredBy,
        referrerPhone: lead.referrerPhone,
        notes: lead.notes,
        priority: lead.priority || "medium",
        assignedTo: lead.assignedTo,

        // Status & Lifecycle
        status: lead.status || "new",
        lifecycleStage: lead.lifecycleStage || "enquiry",

        // Automation
        automation: lead.automation || {},

        // ShowProject
        showProject: lead.showProject || {},

        // Advance Payment
        advancePayment: lead.advancePayment || {},

        // Interaction History (from Lead)
        interactionHistory: [
          ...(lead.interactionHistory || []),
          {
            type: "migration",
            title: "Data migrated to unified system",
            description: `Lead record migrated to unified CRMClient.${matchingClient ? " Client data merged." : ""}`,
            createdAt: new Date(),
          },
        ],

        // Timestamps
        clientInfoCompletedAt: lead.clientInfoCompletedAt,
        lastInteractionAt: lead.updatedAt || new Date(),
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,

        // Spouse from Lead
        spouse: lead.spouse || {},

        // Default siteAddress handling
        siteAddress: {},
        clientInfoCompleted: false,
      };

      // Handle Lead's siteAddress (could be string or object)
      if (typeof lead.siteAddress === "string" && lead.siteAddress) {
        unifiedData.siteAddress = { fullAddress: lead.siteAddress };
      } else if (typeof lead.siteAddress === "object" && lead.siteAddress) {
        unifiedData.siteAddress = lead.siteAddress;
      }

      // ── Merge Client data if exists ─────────────────────────────────
      if (matchingClient) {
        merged++;
        unifiedData.clientInfoCompleted = true;
        unifiedData.clientInfoCompletedAt =
          unifiedData.clientInfoCompletedAt || matchingClient.createdAt;

        // Extended fields from Client
        if (matchingClient.dob) unifiedData.dob = matchingClient.dob;
        if (matchingClient.address) unifiedData.address = matchingClient.address;
        if (matchingClient.companyName) unifiedData.companyName = matchingClient.companyName;
        if (matchingClient.officeAddress) unifiedData.officeAddress = matchingClient.officeAddress;
        if (matchingClient.children?.length) unifiedData.children = matchingClient.children;

        // Merge spouse (Client has richer spouse data)
        if (matchingClient.spouse) {
          unifiedData.spouse = {
            ...(unifiedData.spouse || {}),
            ...matchingClient.spouse,
          };
        }

        // Client's siteAddress object overrides Lead's string
        if (matchingClient.siteAddress && typeof matchingClient.siteAddress === "object") {
          unifiedData.siteAddress = {
            ...(unifiedData.siteAddress || {}),
            ...matchingClient.siteAddress,
          };
        }

        // Use Client's name/phone/email if they're newer (client info form may have updated them)
        if (matchingClient.name) unifiedData.name = matchingClient.name;
        if (matchingClient.phone) unifiedData.phone = matchingClient.phone;
        if (matchingClient.email) unifiedData.email = matchingClient.email;
      }

      // ── Write or log ────────────────────────────────────────────────
      if (isDryRun) {
        console.log(
          `📝 [${i + 1}/${leads.length}] WOULD CREATE: ${unifiedData.name} (${trackingId})` +
          (matchingClient ? " [+ Client merged]" : "")
        );
      } else {
        try {
          await CRMClient.create(unifiedData);
          console.log(
            `✅ [${i + 1}/${leads.length}] CREATED: ${unifiedData.name} (${trackingId})` +
            (matchingClient ? " [+ Client merged]" : "")
          );
        } catch (err) {
          console.error(
            `❌ [${i + 1}/${leads.length}] FAILED: ${unifiedData.name} — ${err.message}`
          );
          errors++;
          continue;
        }
      }

      created++;
    }

    // ── Summary ───────────────────────────────────────────────────────
    console.log("\n" + "═".repeat(60));
    console.log("📊 MIGRATION SUMMARY");
    console.log("═".repeat(60));
    console.log(`  Total leads processed:  ${leads.length}`);
    console.log(`  Records to create:      ${created}`);
    console.log(`  Client data merged:     ${merged}`);
    console.log(`  Already migrated:       ${skipped}`);
    console.log(`  Errors:                 ${errors}`);
    console.log("═".repeat(60));

    if (isDryRun) {
      console.log("\n⚠️  This was a DRY RUN. To execute, run:");
      console.log("   node src/scripts/migrateToUnifiedClient.js --execute\n");
    } else {
      console.log("\n✅ Migration complete!\n");
    }
  } catch (error) {
    console.error("❌ Migration error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

migrate();
