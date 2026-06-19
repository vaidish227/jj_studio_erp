/**
 * milestoneSync — mirror master-sheet phase ranges/progress into ProjectMilestone.
 * --------------------------------------------------------------------------
 * For each phase in the project's plan snapshot, upsert a milestone keyed by
 * `sourcePhase = phase.name`. The milestone's start/due dates and progress are
 * rolled up from that phase's tasks + subtasks. Manually-created milestones
 * (sourcePhase = null) are NEVER touched.
 *
 * Best-effort: callers wrap this so a sync failure never blocks the request.
 */
const ProjectMilestone = require("../models/ProjectMilestone.model");
const Task    = require("../models/Task.model");
const Project = require("../models/Project.model");
const { dayDiff, startOfDay } = require("./plannerHelpers");
const { logActivity } = require("../../../shared/activityLogger");

function deriveStatus(progress, computedEnd, now) {
  if (progress >= 100) return "completed";
  if (computedEnd && startOfDay(computedEnd).getTime() < startOfDay(now).getTime()) return "delayed";
  if (progress > 0) return "in_progress";
  return "pending";
}

/** Roll up planned start/end + mean progress per phase name (lowercased key). */
function rollupByPhase(tasks) {
  const byPhase = new Map();
  for (const t of tasks) {
    const name = (t.phase || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!byPhase.has(key)) byPhase.set(key, { start: null, end: null, progSum: 0, count: 0 });
    const agg = byPhase.get(key);
    const s = t.planning?.plannedStartDate;
    const e = t.planning?.plannedEndDate;
    if (s && (!agg.start || s < agg.start)) agg.start = s;
    if (e && (!agg.end || e > agg.end)) agg.end = e;
    agg.progSum += Number(t.planning?.progressPercent || 0);
    agg.count += 1;
  }
  return byPhase;
}

/**
 * syncPhaseMilestones(projectId, { actor })
 * Returns { synced, skipped }. Skipped phases are those with no dated tasks
 * (a milestone requires a dueDate).
 */
async function syncPhaseMilestones(projectId, { actor = null } = {}) {
  const project = await Project.findById(projectId).select("planSnapshot").lean();
  const phases = project?.planSnapshot?.phases || [];
  if (!phases.length) return { synced: 0, skipped: 0 };

  const tasks = await Task.find({ projectId })
    .select("phase planning.plannedStartDate planning.plannedEndDate planning.progressPercent")
    .lean();
  const byPhase = rollupByPhase(tasks);

  const now = new Date();
  let synced = 0, skipped = 0;

  for (const p of phases) {
    if (!p.name) { skipped++; continue; }
    const agg = byPhase.get(String(p.name).toLowerCase());
    if (!agg || !agg.end) { skipped++; continue; } // no dated tasks → can't form a dueDate

    const progress = agg.count ? Math.round(agg.progSum / agg.count) : 0;
    const status = deriveStatus(progress, agg.end, now);

    const existing = await ProjectMilestone.findOne({ projectId, sourcePhase: p.name })
      .select("_id dueDate completedDate").lean();

    const set = {
      title: p.name,
      description: "Auto-synced from master-sheet phase",
      startDate: agg.start || null,
      dueDate: agg.end,
      status,
      progressPercent: progress,
      order: Number(p.order || 0),
      sourcePhase: p.name,
    };
    if (status === "completed" && !existing?.completedDate) set.completedDate = now;
    if (status !== "completed") set.completedDate = null;

    const moved = existing?.dueDate && new Date(existing.dueDate).getTime() !== new Date(agg.end).getTime();

    await ProjectMilestone.updateOne(
      { projectId, sourcePhase: p.name },
      { $set: set },
      { upsert: true }
    );

    if (moved) {
      const shiftDays = dayDiff(agg.end, existing.dueDate);
      await logActivity({
        projectId, actorId: actor,
        entityType: "milestone", entityId: existing._id,
        action: "updated",
        description: `Milestone "${p.name}" deadline moved by ${shiftDays >= 0 ? "+" : ""}${shiftDays} day(s) (phase tasks shifted).`,
        metadata: { phase: p.name, from: existing.dueDate, to: agg.end, shiftDays },
      }).catch(() => {});
    }
    synced++;
  }

  return { synced, skipped };
}

module.exports = { syncPhaseMilestones };
