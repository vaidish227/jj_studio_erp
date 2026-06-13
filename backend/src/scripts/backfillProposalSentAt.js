/**
 * Backfill `Proposal.sentAt` for proposals that were sent before the field was
 * being written by the manual / UI send flows.
 *
 * WHY: The MD Dashboard "Proposals Sent" KPI counts proposals where
 * `sentAt >= startOfPeriod`. Historically only the AI tools set `sentAt`, so
 * proposals sent through the normal UI have no `sentAt` and never get counted.
 * (The controller has since been fixed to stamp `sentAt` on every send.)
 *
 * WHAT IT DOES: For every proposal that has clearly been sent (status is at/after
 * "sent", OR its approvalHistory contains a "sent" action) but has no `sentAt`,
 * it derives the best-available historical timestamp and fills `sentAt`.
 *
 * Timestamp preference (most → least accurate):
 *   1. approvalHistory entry with action "sent"            (exact send time)
 *   2. approvalHistory entry with action "manager_approved" (auto-send fires here)
 *   3. approved_at                                          (manager approval)
 *   4. updatedAt                                            (last write)
 *   5. createdAt                                            (last resort)
 *
 * SAFE BY DEFAULT — dry-run unless you pass --apply:
 *   node backend/src/scripts/backfillProposalSentAt.js            # preview only
 *   node backend/src/scripts/backfillProposalSentAt.js --apply    # write changes
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

const mongoose = require("mongoose");
const Proposal = require("../modules/crm/models/Proposal.model");

const APPLY = process.argv.includes("--apply");

// Statuses that mean the proposal has definitely passed through "sent".
const POST_SEND_STATUSES = [
  "sent", "esign_received", "payment_received", "signed",
  "project_ready", "project_started",
];

const fmt = (d) => (d ? new Date(d).toISOString() : "-");

// Pick the best historical send timestamp from what the document already has.
function deriveSentAt(p) {
  const history = Array.isArray(p.approvalHistory) ? p.approvalHistory : [];
  const byAction = (action) =>
    history
      .filter((h) => h.action === action && h.timestamp)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0]?.timestamp;

  return {
    value:
      byAction("sent") ||
      byAction("manager_approved") ||
      p.approved_at ||
      p.updatedAt ||
      p.createdAt ||
      null,
    source:
      byAction("sent") ? "history:sent" :
      byAction("manager_approved") ? "history:manager_approved" :
      p.approved_at ? "approved_at" :
      p.updatedAt ? "updatedAt" :
      p.createdAt ? "createdAt" : "none",
  };
}

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set — check backend/.env");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected.  Mode: ${APPLY ? "APPLY (writing changes)" : "DRY-RUN (no writes)"}\n`);

  // Candidates: no sentAt yet, but evidently sent.
  const candidates = await Proposal.find({
    $and: [
      { $or: [{ sentAt: { $exists: false } }, { sentAt: null }] },
      {
        $or: [
          { status: { $in: POST_SEND_STATUSES } },
          { "approvalHistory.action": "sent" },
        ],
      },
    ],
  })
    .select("title status sentAt approved_at updatedAt createdAt approvalHistory")
    .lean();

  console.log(`Found ${candidates.length} sent proposal(s) missing sentAt.\n`);

  // Month boundary — so we can predict the effect on the current "This Month" KPI.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let updated = 0;
  let inThisMonth = 0;
  const bySource = {};

  for (const p of candidates) {
    const { value, source } = deriveSentAt(p);
    if (!value) {
      console.log(`  SKIP  "${p.title}" (${p.status}) — no usable timestamp`);
      continue;
    }
    bySource[source] = (bySource[source] || 0) + 1;
    if (new Date(value) >= monthStart) inThisMonth += 1;

    console.log(`  ${APPLY ? "SET " : "WOULD SET"}  "${p.title}"  status=${p.status}  sentAt=${fmt(value)}  [${source}]`);

    if (APPLY) {
      await Proposal.updateOne({ _id: p._id }, { $set: { sentAt: value } });
      updated += 1;
    }
  }

  console.log("\n── Summary ───────────────────────────────");
  console.log(`  Candidates           : ${candidates.length}`);
  console.log(`  ${APPLY ? "Updated" : "Would update"}        : ${APPLY ? updated : candidates.length}`);
  console.log(`  Falling in this month: ${inThisMonth}  (these will show up in the "This Month" KPI)`);
  console.log(`  Timestamp sources    : ${JSON.stringify(bySource)}`);
  if (!APPLY) console.log(`\n  Dry-run only — re-run with --apply to write these changes.`);

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
