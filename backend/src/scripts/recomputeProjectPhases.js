/**
 * One-time backfill — recompute Project.phase for every project.
 *
 * With WORKFLOW_GATES_ENABLED=false the old recomputeProjectPhase was
 * gate-driven and never fired, so projects stayed stuck on their initial
 * phase (usually "kickoff") no matter how many tasks completed. The engine
 * is now task-driven in gates-off mode; this script applies the new logic
 * once to existing projects. Future changes flow automatically from task
 * approval / status updates / Excel import.
 *
 * Idempotent, safe to re-run:
 *   node backend/src/scripts/recomputeProjectPhases.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Project = require("../modules/pms/models/Project.model");
const workflowEngine = require("../modules/pms/services/workflowEngine");

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const projects = await Project.find({ status: { $nin: ["cancelled"] } })
      .select("_id name phase")
      .lean();

    let changed = 0;
    for (const p of projects) {
      const newPhase = await workflowEngine.recomputeProjectPhase(p._id);
      if (newPhase && newPhase !== p.phase) {
        console.log(`  ${p.name}: ${p.phase} → ${newPhase}`);
        changed++;
      }
    }

    console.log(`Recompute complete. Projects checked: ${projects.length}, phases changed: ${changed}`);
  } catch (err) {
    console.error("Recompute failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();
