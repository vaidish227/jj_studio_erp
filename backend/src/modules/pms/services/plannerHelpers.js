/**
 * plannerHelpers — small date + plan-total utilities shared by the Planner
 * controller and the scheduling engine so there is ONE copy of each.
 *
 * Kept dependency-light (only the Task + ProjectPlan models) and side-effect
 * free except `recomputePlanTotals`, which writes the rolled-up plan totals.
 */
const Task        = require("../models/Task.model");
const ProjectPlan = require("../models/ProjectPlan.model");

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole-day difference a − b (rounded). null when either side is missing. */
function dayDiff(a, b) {
  if (!a || !b) return null;
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / DAY_MS);
}

/** Midnight (local) of the given date — used for overdue / due-today checks. */
function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Recompute and persist a project's plan totals (planned/actual hours + the
 * planned span in days). Mirrors the logic that previously lived inline in
 * Planner.controller so the engine can call it after a shift.
 */
async function recomputePlanTotals(projectId) {
  const tasks = await Task.find({ projectId })
    .select("planning.plannedHours planning.actualHours planning.plannedStartDate planning.plannedEndDate")
    .lean();
  let plannedHours = 0;
  let actualHours  = 0;
  let earliest = null;
  let latest   = null;
  for (const t of tasks) {
    const p = t.planning || {};
    plannedHours += Number(p.plannedHours || 0);
    actualHours  += Number(p.actualHours || 0);
    if (p.plannedStartDate && (!earliest || p.plannedStartDate < earliest)) earliest = p.plannedStartDate;
    if (p.plannedEndDate   && (!latest   || p.plannedEndDate   > latest))   latest   = p.plannedEndDate;
  }
  const totalPlannedDays = earliest && latest ? Math.max(0, dayDiff(latest, earliest)) : 0;
  await ProjectPlan.updateOne(
    { projectId },
    { $set: { totalPlannedHours: plannedHours, totalActualHours: actualHours, totalPlannedDays } },
    { upsert: true }
  );
}

module.exports = { DAY_MS, dayDiff, startOfDay, recomputePlanTotals };
