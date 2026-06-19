/**
 * taskAutoShiftScheduler — Phase 2 nightly auto-shift.
 *
 * Each night, finds overdue tasks and shifts them (and their dependents) forward
 * by however many days they are late, preserving duration. STRICTLY opt-in:
 *   1. env gate PMS_AUTO_SHIFT_ENABLED must be "true" (default false → cron not
 *      even registered);
 *   2. AND per task, the effective flag must be true:
 *      task.autoShiftEnabled ?? project.settings.autoShiftEnabled (default false).
 *
 * Safety / idempotency:
 *   - detectOverdueTasks already excludes locked / completed / approved /
 *     released / on_hold / blocked tasks.
 *   - the engine is called with skipIfShiftedToday:true, so a task already moved
 *     today (by a cascade or a previous run) is never moved again — running the
 *     job twice in one day is a no-op for already-shifted tasks.
 *   - per-task notifications are suppressed (notify:false); a single per-assignee
 *     digest is sent instead.
 *
 * Dry-run: runAutoShift({ dryRun:true }) reports what WOULD shift without writing.
 * Manual: node backend/src/scripts/runAutoShift.js [--apply]
 *
 * Wire-up (backend/src/index.js, after connectDb()):
 *   const { startTaskAutoShift } = require("./modules/pms/cron/taskAutoShiftScheduler");
 *   startTaskAutoShift();
 */
const cron = require("node-cron");
const Project = require("../models/Project.model");
const scheduleEngine = require("../services/scheduleEngine");
const { syncPhaseMilestones } = require("../services/milestoneSync");
const { dayDiff, startOfDay } = require("../services/plannerHelpers");

let notify = () => {};
try {
  ({ dispatch: notify } = require("../../notifications/services/notificationDispatcher"));
} catch (e) { /* optional */ }

function sameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/**
 * Run the auto-shift sweep across all active projects.
 * @param {{ dryRun?: boolean }} opts
 */
async function runAutoShift({ dryRun = false } = {}) {
  const now = new Date();
  const today = startOfDay(now);

  // Overdue + in-flight + unlocked (engine helper already filters these).
  const overdue = await scheduleEngine.detectOverdueTasks("all");
  if (!overdue.length) {
    console.log("[taskAutoShift] No overdue tasks.");
    return { considered: 0, eligible: 0, rootsShifted: 0, tasksMoved: 0, projectsTouched: 0, dryRun };
  }

  // Resolve each project's settings once.
  const projectIds = [...new Set(overdue.map((t) => String(t.projectId)))];
  const projects = await Project.find({ _id: { $in: projectIds } })
    .select("settings name trackingId")
    .lean();
  const projById = new Map(projects.map((p) => [String(p._id), p]));

  // Earliest-overdue first so predecessors usually process before dependents;
  // the engine's same-day guard handles any remaining cascade overlap.
  overdue.sort((a, b) => new Date(a.planning.plannedEndDate) - new Date(b.planning.plannedEndDate));

  const perAssignee = new Map();   // assigneeId -> count of tasks auto-shifted
  const touchedProjects = new Set();
  let eligible = 0, rootsShifted = 0, tasksMoved = 0;

  for (const t of overdue) {
    const proj = projById.get(String(t.projectId));
    const projAuto = !!proj?.settings?.autoShiftEnabled;
    const effective = t.autoShiftEnabled != null ? t.autoShiftEnabled : projAuto;
    if (!effective) continue;

    // Cheap same-day pre-check (the engine re-checks authoritatively).
    if (t.lastShiftedAt && sameDay(t.lastShiftedAt, now)) continue;

    const delta = dayDiff(today, startOfDay(t.planning.plannedEndDate));
    if (!delta || delta <= 0) continue;
    eligible++;

    if (dryRun) {
      rootsShifted++;
      touchedProjects.add(String(t.projectId));
      continue;
    }

    try {
      const res = await scheduleEngine.shiftTaskAndDependents(t._id, delta, {
        reason: "Auto-shift: task overdue",
        actor: null,
        source: "cron",
        skipIfShiftedToday: true,
        notify: false,
      });
      if (res?.shifted > 0) {
        rootsShifted++;
        tasksMoved += res.shifted;
        touchedProjects.add(String(t.projectId));
        for (const a of (res.affectedAssignees || [])) {
          perAssignee.set(a, (perAssignee.get(a) || 0) + 1);
        }
      }
    } catch (e) {
      console.warn("[taskAutoShift] shift fail:", String(t._id), e.message);
    }
  }

  if (!dryRun) {
    // Mirror the new phase ranges into milestones for any touched project.
    for (const pid of touchedProjects) {
      try { await syncPhaseMilestones(pid, { actor: null }); }
      catch (e) { console.warn("[taskAutoShift] milestone sync fail:", pid, e.message); }
    }
    // One digest per assignee (avoids per-task notification spam).
    for (const [userId, count] of perAssignee) {
      try {
        notify({
          type: "tasks.auto_shifted_digest",
          module: "pms",
          priority: "normal",
          title: `${count} task${count === 1 ? "" : "s"} auto-shifted`,
          message: `${count} of your overdue task${count === 1 ? " was" : "s were"} moved forward automatically because ${count === 1 ? "it was" : "they were"} past the deadline.`,
          link: `/tasks`,
          recipients: [userId],
          notifyActor: true,
          metadata: { count },
        });
      } catch (e) { /* best-effort */ }
    }
  }

  console.log(
    `[taskAutoShift] ${dryRun ? "DRY RUN — " : ""}considered=${overdue.length} eligible=${eligible} rootsShifted=${rootsShifted} tasksMoved=${tasksMoved} projects=${touchedProjects.size}`
  );
  return { considered: overdue.length, eligible, rootsShifted, tasksMoved, projectsTouched: touchedProjects.size, dryRun };
}

function startTaskAutoShift() {
  // Panic-OFF switch (default ON): the cron registers by default so the feature
  // is controlled entirely from each project's planner Settings (the per-project
  // autoShiftEnabled toggle, default false, is the real safety gate). Set the env
  // var to "false" only to hard-kill the nightly job globally (e.g. dev/staging).
  const enabled = String(process.env.PMS_AUTO_SHIFT_ENABLED ?? "true").toLowerCase() !== "false";
  if (!enabled) {
    console.log("[taskAutoShift] PMS_AUTO_SHIFT_ENABLED=false — nightly auto-shift disabled.");
    return;
  }
  // Daily 07:00 server-local (after the 06:30 reminders).
  cron.schedule("0 7 * * *", () => {
    runAutoShift({ dryRun: false }).catch((err) => console.error("[taskAutoShift] run failed:", err.message));
  });
  console.log("[taskAutoShift] cron registered: daily 07:00 (auto-shift overdue tasks).");
}

module.exports = { startTaskAutoShift, runAutoShift };
