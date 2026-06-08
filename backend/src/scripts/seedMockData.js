/**
 * Seeds the database with:
 *   1. Admin user (Vaidish / vk5744615@gmail.com / password123)
 *   2. CRM clients from clients_mock_data.json (clientInfoCompleted=true)
 *   3. CRM leads from leads_mock_data.json (clientInfoCompleted=false)
 *
 * Both mock files are loaded into the unified `crmclients` collection
 * (CRMClient model), per the architecture note in Client.model.js /
 * Lead.model.js that the old collections are deprecated.
 *
 * Idempotent: skips inserts when a CRMClient with the same phone already
 * exists, and skips the user create when the email already exists.
 *
 * Run: node backend/src/scripts/seedMockData.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("../modules/auth/models/user.model");
const CRMClient = require("../modules/crm/models/CRMClient.model");

const ADMIN = {
  name: "Vaidish",
  email: "vk5744615@gmail.com",
  password: "password123",
  role: "admin",
};

const CLIENTS_FILE = path.join(__dirname, "../../clients_mock_data.json");
const LEADS_FILE = path.join(__dirname, "../../leads_mock_data.json");

// ─── Helpers ──────────────────────────────────────────────────────────────
function readJson(file) {
  const raw = fs.readFileSync(file, "utf8");
  return JSON.parse(raw);
}

// Mongo Extended-JSON dates (`{ "$date": "..." }`) come through as plain
// objects after JSON.parse; convert them to real Date objects recursively.
function unwrapDates(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(unwrapDates);
  if (typeof value === "object") {
    if (Object.keys(value).length === 1 && typeof value.$date === "string") {
      return new Date(value.$date);
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = unwrapDates(v);
    return out;
  }
  return value;
}

// Lead mock data has siteAddress as a string; CRMClient expects an object.
function normalizeLead(lead) {
  if (typeof lead.siteAddress === "string") {
    lead.siteAddress = {
      fullAddress: lead.siteAddress,
      city: lead.city,
    };
  }
  return lead;
}

async function seedAdmin() {
  const existing = await User.findOne({ email: ADMIN.email });
  if (existing) {
    console.log(`  • Admin user already exists: ${ADMIN.email}`);
    return;
  }
  const hashedPassword = await bcrypt.hash(ADMIN.password, 10);
  await User.create({
    name: ADMIN.name,
    email: ADMIN.email,
    password: hashedPassword,
    role: ADMIN.role,
    isActive: true,
  });
  console.log(`  ✓ Created admin user: ${ADMIN.name} <${ADMIN.email}>`);
}

async function seedCRMRecords(records, label, clientInfoCompleted) {
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const raw of records) {
    const data = unwrapDates(raw);
    if (label === "leads") normalizeLead(data);

    try {
      const exists = await CRMClient.findOne({ phone: data.phone }).lean();
      if (exists) {
        skipped++;
        continue;
      }

      // `new + save` runs the pre-validate hook that auto-generates trackingId.
      const doc = new CRMClient({
        ...data,
        clientInfoCompleted,
      });
      await doc.save();
      inserted++;
    } catch (err) {
      failed++;
      console.error(`    ✗ Failed (${data.name}): ${err.message}`);
    }
  }

  console.log(
    `  ${label}: ${inserted} inserted, ${skipped} skipped (already exists), ${failed} failed`
  );
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing from environment");
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    family: 4,
  });
  console.log("Connected.\n");

  console.log("1) Admin user");
  await seedAdmin();

  console.log("\n2) CRM Clients");
  const clients = readJson(CLIENTS_FILE);
  await seedCRMRecords(clients, "clients", true);

  console.log("\n3) CRM Leads");
  const leads = readJson(LEADS_FILE);
  await seedCRMRecords(leads, "leads", false);

  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    process.exit(process.exitCode || 0);
  });
