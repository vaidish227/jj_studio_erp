/**
 * READ-ONLY investigation script.
 *
 * Verifies the AI sendProposal bot's claim that "no proposal exists for Maya Patel".
 * Lists every CRMClient matching "maya", every Proposal in the DB, and which
 * Proposal documents (if any) link to a Maya lead.
 *
 * Usage:  node backend/src/scripts/checkMayaProposal.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

const mongoose  = require("mongoose");
const CRMClient = require("../modules/crm/models/CRMClient.model");
const Proposal  = require("../modules/crm/models/Proposal.model");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected.\n");

  // 1) All leads matching "maya" (case-insensitive)
  const mayas = await CRMClient.find({ name: /maya/i })
    .select("_id name trackingId status email phone city assignedTo createdAt")
    .lean();
  console.log(`=== CRMClient documents matching /maya/i — ${mayas.length} ===`);
  mayas.forEach((m, i) => {
    console.log(`  [${i + 1}] _id=${m._id}`);
    console.log(`      name=${m.name}  tracking=${m.trackingId}  status=${m.status}`);
    console.log(`      email=${m.email || "(none)"}  phone=${m.phone || "(none)"}  city=${m.city || "-"}`);
    console.log(`      createdAt=${m.createdAt?.toISOString?.() || m.createdAt}`);
  });
  console.log("");

  // 2) Total proposals in the database
  const totalProposals = await Proposal.countDocuments();
  console.log(`=== Total Proposal documents in DB: ${totalProposals} ===\n`);

  // 3) Proposals linked to any Maya
  if (mayas.length > 0) {
    const mayaIds = mayas.map((m) => m._id);
    const linked = await Proposal.find({ leadId: { $in: mayaIds } })
      .select("_id leadId title status finalAmount sentAt createdAt")
      .lean();
    console.log(`=== Proposals linked to any Maya CRMClient: ${linked.length} ===`);
    linked.forEach((p, i) => {
      console.log(`  [${i + 1}] _id=${p._id}  leadId=${p.leadId}`);
      console.log(`      title="${p.title}"  status=${p.status}  finalAmount=${p.finalAmount}`);
      console.log(`      sentAt=${p.sentAt || "-"}  createdAt=${p.createdAt?.toISOString?.()}`);
    });
    console.log("");
  }

  // 4) Sample of all proposals (regardless of lead) so we can see what data exists
  const sample = await Proposal.find()
    .select("_id leadId title status finalAmount createdAt")
    .populate("leadId", "name trackingId")
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  console.log(`=== Sample of latest Proposals (up to 10): ===`);
  if (sample.length === 0) {
    console.log("  (none — Proposal collection is empty)");
  } else {
    sample.forEach((p, i) => {
      const lead = p.leadId ? `${p.leadId.name} (${p.leadId.trackingId})` : `(missing lead ${p.leadId})`;
      console.log(`  [${i + 1}] "${p.title}"  status=${p.status}  ₹${p.finalAmount}  → lead: ${lead}`);
    });
  }
  console.log("");

  // 5) Schema sanity: any proposals where leadId is a string (legacy) instead of ObjectId?
  const anyStringLeadId = await Proposal.collection.findOne({ leadId: { $type: "string" } });
  if (anyStringLeadId) {
    console.log(`!!! Found at least one Proposal with leadId stored as STRING (legacy):`);
    console.log(`    _id=${anyStringLeadId._id}  leadId=${anyStringLeadId.leadId}  type=${typeof anyStringLeadId.leadId}`);
    console.log(`    This would cause leadId-match queries to miss it.`);
  } else {
    console.log("Schema sanity: all Proposal.leadId values are ObjectId (no legacy string leadIds).");
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
