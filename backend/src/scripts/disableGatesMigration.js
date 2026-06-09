/**
 * Soft-transition migration — disable PMS gate enforcement on existing data.
 *
 * What this does (idempotent, safe to re-run):
 *   1. Flips every Task currently in status "blocked" back to "not_started",
 *      and resets task.gateStatus to "none".
 *   2. Marks every currently OPEN ApprovalGate as "overridden" with the
 *      reason "soft-transition disable" so historical projects don't carry
 *      stale "open gate" data anywhere.
 *
 * What this DOES NOT do:
 *   - Delete ApprovalGate / TaskDependency documents (kept for audit + easy
 *     re-enable later).
 *   - Touch tasks already in any other status (in_progress, completed, etc.).
 *   - Touch closed/overridden gates.
 *   - Change workflow template definitions.
 *
 * Run once after setting WORKFLOW_GATES_ENABLED=false:
 *   node backend/src/scripts/disableGatesMigration.js
 *
 * To reverse: set WORKFLOW_GATES_ENABLED=true, restart, and re-run
 * `seedWorkflowTemplates.js` / re-initiate projects (gates will be created
 * for NEW projects only; existing ones remain in their migrated state).
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Task = require("../modules/pms/models/Task.model");
const ApprovalGate = require("../modules/pms/models/ApprovalGate.model");

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const taskRes = await Task.updateMany(
      { status: "blocked" },
      { $set: { status: "not_started", gateStatus: "none" } }
    );

    const now = new Date();
    const gateRes = await ApprovalGate.updateMany(
      { status: "open" },
      {
        $set: {
          status: "overridden",
          overrideReason: "soft-transition disable",
          overrideAt: now,
        },
      }
    );

    console.log(
      `Migration complete. tasksUnblocked: ${taskRes.modifiedCount}, gatesClosed: ${gateRes.modifiedCount}`
    );
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
