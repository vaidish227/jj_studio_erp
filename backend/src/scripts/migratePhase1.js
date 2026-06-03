/**
 * Phase 1 — Workflow Engine Migration
 *
 * Safe, idempotent backfill for existing data. Run on a copy of prod first.
 *
 * What it does:
 *   1. Adds Project.phase derived from Project.status.
 *      design_phase     → "design"
 *      execution_phase  → "execution"
 *      handover         → "handover"
 *      completed        → "closed"
 *      on_hold/cancelled → leave existing phase (default "kickoff" if absent)
 *   2. Adds clientApprovals row { type: "furniture_layout", status: "not_applicable" }
 *      to every existing project that doesn't already have one.
 *   3. Adds Task.dependsOn=[] and gateStatus="none" to every existing task missing them.
 *   4. Does NOT auto-seed any existing project (workflowTemplateId stays null).
 *   5. Does NOT mark existing tasks as blocked.
 *   6. Does NOT touch drawings, approvals, or release data.
 *
 * Usage:
 *   node backend/src/scripts/migratePhase1.js          # apply
 *   node backend/src/scripts/migratePhase1.js --dry    # report only, no writes
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Project = require("../modules/pms/models/Project.model");
const Task = require("../modules/pms/models/Task.model");

const DRY_RUN = process.argv.includes("--dry");

// 7-phase canonical model — handover is the terminal phase.
// completed projects map to handover (terminal) rather than introducing an 8th phase.
const STATUS_TO_PHASE = {
  design_phase: "design",
  execution_phase: "execution",
  handover: "handover",
  completed: "handover",
};

async function migrateProjects() {
  const projects = await Project.find({}).select(
    "_id status phase clientApprovals workflowTemplateId"
  );

  let phaseSet = 0;
  let approvalAdded = 0;

  for (const p of projects) {
    let dirty = false;

    if (!p.phase) {
      p.phase = STATUS_TO_PHASE[p.status] || "kickoff";
      phaseSet++;
      dirty = true;
    } else if (p.phase === "closed") {
      // Rescue early-Phase-1 docs that picked up the now-removed "closed" value.
      p.phase = "handover";
      phaseSet++;
      dirty = true;
    }

    const hasFurnitureLayoutApproval = (p.clientApprovals || []).some(
      (a) => a.type === "furniture_layout"
    );
    if (!hasFurnitureLayoutApproval) {
      p.clientApprovals.push({
        type: "furniture_layout",
        status: "not_applicable",
      });
      approvalAdded++;
      dirty = true;
    }

    if (dirty && !DRY_RUN) {
      await p.save();
    }
  }

  return { total: projects.length, phaseSet, approvalAdded };
}

async function migrateTasks() {
  // The schema defaults will populate dependsOn=[] and gateStatus="none" on save,
  // but we use an explicit updateMany to backfill values without triggering full doc rewrites.
  const filter = {
    $or: [
      { dependsOn: { $exists: false } },
      { gateStatus: { $exists: false } },
    ],
  };
  const total = await Task.countDocuments(filter);
  if (DRY_RUN) return { total, updated: 0 };

  const r = await Task.updateMany(filter, {
    $set: { dependsOn: [], gateStatus: "none" },
  });
  return { total, updated: r.modifiedCount };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(
    `Connected. ${DRY_RUN ? "DRY RUN — no changes will be persisted." : "APPLYING migration."}`
  );

  const proj = await migrateProjects();
  console.log(
    `Projects: ${proj.total} scanned · ${proj.phaseSet} phase set · ${proj.approvalAdded} furniture_layout approvals added`
  );

  const tasks = await migrateTasks();
  console.log(
    `Tasks: ${tasks.total} needed backfill · ${tasks.updated} updated`
  );

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
