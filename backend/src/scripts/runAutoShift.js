/**
 * Manually run the nightly auto-shift sweep — for testing/verification.
 *
 * Defaults to DRY RUN (no writes). Pass --apply to actually shift tasks.
 * Respects the same opt-in gates as the cron (project/task autoShiftEnabled),
 * but does NOT require the PMS_AUTO_SHIFT_ENABLED env flag (that flag only
 * controls whether the nightly cron is registered).
 *
 * Usage:
 *   node backend/src/scripts/runAutoShift.js          # dry run (preview)
 *   node backend/src/scripts/runAutoShift.js --apply  # actually shift
 */
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const { runAutoShift } = require("../modules/pms/cron/taskAutoShiftScheduler");

const APPLY = process.argv.includes("--apply");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected. ${APPLY ? "APPLYING shifts." : "DRY RUN — no writes."}`);
  const result = await runAutoShift({ dryRun: !APPLY });
  console.log("Result:", JSON.stringify(result));
  await mongoose.disconnect();
}

main().catch((err) => { console.error("runAutoShift failed:", err); process.exit(1); });
