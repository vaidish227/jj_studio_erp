/**
 * Backfill Project.planSnapshot for already-initiated projects.
 *
 * Why: projects initiated BEFORE the per-project plan-snapshot feature store
 * only a reference (workflowTemplateId) to the global WorkflowTemplate. The
 * master sheet now reads a frozen `planSnapshot` first, so this script freezes
 * each legacy project's CURRENT template into its own snapshot — protecting it
 * from any future edits to the global template.
 *
 * Safe & idempotent:
 *   - Only touches projects that have a workflowTemplateId but NO planSnapshot.
 *   - Never changes tasks, drawings, gates, or the templates themselves.
 *   - Re-running is a no-op once snapshots exist.
 *
 * Usage:
 *   node backend/src/scripts/backfillPlanSnapshot.js          # apply
 *   node backend/src/scripts/backfillPlanSnapshot.js --dry    # report only
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Project = require("../modules/pms/models/Project.model");
const WorkflowTemplate = require("../modules/pms/models/WorkflowTemplate.model");
const { buildPlanSnapshot } = require("../modules/pms/services/workflowEngine");

const DRY_RUN = process.argv.includes("--dry");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected. ${DRY_RUN ? "DRY RUN — no writes." : "APPLYING backfill."}`);

  // Legacy projects: seeded (has template link) but missing the snapshot.
  const projects = await Project.find({
    workflowTemplateId: { $exists: true, $ne: null },
    $or: [
      { planSnapshot: { $exists: false } },
      { "planSnapshot.baseTemplateId": { $exists: false } },
    ],
  }).select("_id name workflowTemplateId planSnapshot");

  let snapped = 0;
  let skippedNoTemplate = 0;

  for (const p of projects) {
    const template = await WorkflowTemplate.findById(p.workflowTemplateId).lean();
    if (!template) {
      // Template was deleted — can't reconstruct. Leave as-is; the planner
      // still renders the project's real task rows, just without phase backfill.
      skippedNoTemplate++;
      console.warn(`  ! ${p.name} (${p._id}) — linked template missing, skipped`);
      continue;
    }
    // customized: we can't know retroactively whether the plan was customized
    // at initiation, so mark false. The snapshot still matches the live tasks.
    p.planSnapshot = buildPlanSnapshot(template, { customized: false });
    snapped++;
    if (!DRY_RUN) await p.save();
  }

  console.log(
    `Done. Candidates: ${projects.length} · Snapshotted: ${snapped} · Skipped (no template): ${skippedNoTemplate}`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[backfillPlanSnapshot] failed:", err);
  process.exit(1);
});
