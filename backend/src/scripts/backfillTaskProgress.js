/**
 * One-time backfill — align Task.planning.progressPercent with workflow status.
 *
 * The Master Sheet "Progress" column is auto-derived from `status` via the
 * Task model hooks (see PROGRESS_FROM_STATUS in Task.model.js). Tasks created
 * before that hook existed still carry their manual/default percent — this
 * script recomputes every task once so the column reflects reality.
 *
 * Mapping (mirror of the model hook):
 *   not_started / blocked                  →   0
 *   in_progress / revision_requested      →  50
 *   pending_review                        →  80
 *   pending_client_approval               →  90
 *   approved / released_to_site / completed → 100
 *   on_hold                               → untouched (keeps last value)
 *
 * Idempotent, safe to re-run:
 *   node backend/src/scripts/backfillTaskProgress.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Task = require("../modules/pms/models/Task.model");

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    let total = 0;
    for (const [status, pct] of Object.entries(Task.PROGRESS_FROM_STATUS)) {
      const res = await Task.updateMany(
        { status, "planning.progressPercent": { $ne: pct } },
        { $set: { "planning.progressPercent": pct } }
      );
      if (res.modifiedCount > 0) {
        console.log(`  ${status.padEnd(24)} → ${String(pct).padStart(3)}%  (${res.modifiedCount} task(s))`);
      }
      total += res.modifiedCount;
    }

    console.log(`Backfill complete. Tasks updated: ${total}`);
  } catch (err) {
    console.error("Backfill failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();
