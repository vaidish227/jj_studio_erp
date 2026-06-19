/**
 * scheduleEngine — the single home for all PMS day-based date logic.
 * --------------------------------------------------------------------------
 * Derives planned dates from project start + dependencies + duration, and
 * shifts tasks (and their dependents) while preserving duration. Built as an
 * extension of the existing planner:
 *   - planned dates live in `task.planning.plannedStartDate/plannedEndDate`
 *   - the dependency graph is `task.dependsOn[]` (prerequisites of the task)
 *   - subtasks point at their parent via `task.parentTaskId`
 *
 * Conventions (mirrors workflowEngine):
 *   - best-effort: never throws into a request flow EXCEPT for a circular
 *     dependency, which is surfaced as an error with code "DEPENDENCY_CYCLE"
 *     so the controller can return a clean 422.
 *   - all mutations use Task.bulkWrite($set/$inc/$push) which BYPASSES document
 *     middleware, so the existing status→workStatus/progress sync is never
 *     tripped (the engine never writes `status`).
 *   - notifications are optional (require may fail in some envs).
 */
const Task    = require("../models/Task.model");
const Project = require("../models/Project.model");
const { DAY_MS, dayDiff, startOfDay, recomputePlanTotals } = require("./plannerHelpers");

const { logActivity } = require("../../../shared/activityLogger");
let notify = () => {};
try {
  ({ dispatch: notify } = require("../../notifications/services/notificationDispatcher"));
} catch (e) { /* optional */ }

// Statuses whose work is "done" — the engine never moves these.
const SHIFT_PROTECTED_STATUSES = ["approved", "released_to_site", "completed"];

// ---- Day arithmetic ------------------------------------------------------

/**
 * Add `n` days to `date`. In working_days mode, weekends (Sat/Sun) are skipped
 * during the increment. Public holidays are out of scope (follow-up).
 */
function addDays(date, n, mode = "calendar_days") {
  const d = new Date(date);
  const num = Math.trunc(Number(n) || 0);
  if (num === 0) return d;
  if (mode !== "working_days") {
    d.setDate(d.getDate() + num);
    return d;
  }
  let remaining = Math.abs(num);
  const step = num > 0 ? 1 : -1;
  while (remaining > 0) {
    d.setDate(d.getDate() + step);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) remaining--;
  }
  return d;
}

// ---- Schedule status (pure, no DB) --------------------------------------

/**
 * Derived at read time so it never goes stale and never fights the existing
 * status→workStatus/progress hooks. Returns one of:
 *   completed | blocked | overdue | due_today | shifted | on_track
 */
function getScheduleStatus(task, now = new Date()) {
  const status = task?.status;
  if (SHIFT_PROTECTED_STATUSES.includes(status)) return "completed";
  if (status === "blocked" || task?.gateStatus === "open") return "blocked";
  const end = task?.planning?.plannedEndDate;
  if (!end) return "on_track";
  const today = startOfDay(now).getTime();
  const endDay = startOfDay(end).getTime();
  if (endDay < today) return "overdue";
  if (endDay === today) return "due_today";
  if (Number(task?.shiftCount || 0) > 0) return "shifted";
  return "on_track";
}

// ---- Graph utilities -----------------------------------------------------

/** Deterministic ordering tie-break: subtaskOrder → dayOffset → _id. */
function cmpDeterministic(a, b) {
  const ao = Number(a.subtaskOrder || 0), bo = Number(b.subtaskOrder || 0);
  if (ao !== bo) return ao - bo;
  const ad = Number(a.dayOffsetFromProjectStart || 0), bd = Number(b.dayOffsetFromProjectStart || 0);
  if (ad !== bd) return ad - bd;
  return String(a._id).localeCompare(String(b._id));
}

/**
 * DFS cycle detection over the dependsOn graph (task → its prerequisites).
 * Returns { hasCycle, cycle } where cycle is the id path of the first cycle.
 */
function validateDependencies(tasks) {
  const byId = new Map(tasks.map((t) => [String(t._id), t]));
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  for (const t of tasks) color.set(String(t._id), WHITE);
  const stack = [];
  let cycle = null;

  function dfs(id) {
    color.set(id, GRAY);
    stack.push(id);
    const t = byId.get(id);
    for (const depRaw of (t?.dependsOn || [])) {
      const dep = String(depRaw);
      if (!byId.has(dep)) continue; // dangling reference — ignore
      const c = color.get(dep);
      if (c === GRAY) {
        const idx = stack.indexOf(dep);
        cycle = stack.slice(idx).concat(dep);
        return true;
      }
      if (c === WHITE && dfs(dep)) return true;
    }
    stack.pop();
    color.set(id, BLACK);
    return false;
  }

  for (const t of tasks) {
    const id = String(t._id);
    if (color.get(id) === WHITE && dfs(id)) break;
  }
  return { hasCycle: !!cycle, cycle: cycle || [] };
}

/**
 * Topological order: every task appears AFTER all its dependsOn prerequisites.
 * Deterministic (stable tie-break). Assumes the graph is acyclic — call
 * validateDependencies first.
 */
function topoOrder(tasks) {
  const byId = new Map(tasks.map((t) => [String(t._id), t]));
  const visited = new Set();
  const order = [];
  const roots = [...tasks].sort(cmpDeterministic);

  function visit(id, seen) {
    if (visited.has(id) || seen.has(id)) return;
    seen.add(id);
    const t = byId.get(id);
    const deps = (t?.dependsOn || [])
      .map(String)
      .filter((d) => byId.has(d))
      .sort((a, b) => cmpDeterministic(byId.get(a), byId.get(b)));
    for (const d of deps) visit(d, seen);
    seen.delete(id);
    if (!visited.has(id)) {
      visited.add(id);
      order.push(id);
    }
  }

  for (const t of roots) visit(String(t._id), new Set());
  return order;
}

/** Build predecessor → dependents map (reverse of dependsOn). */
function buildDependentsMap(tasks, { includeChildren = false } = {}) {
  const dependentsOf = new Map();
  const push = (key, val) => {
    if (!dependentsOf.has(key)) dependentsOf.set(key, []);
    if (!dependentsOf.get(key).includes(val)) dependentsOf.get(key).push(val);
  };
  for (const t of tasks) {
    const id = String(t._id);
    for (const dep of (t.dependsOn || []).map(String)) push(dep, id);
    // Subtasks are treated as dependents of their parent so shifting a parent
    // moves its children too.
    if (includeChildren && t.parentTaskId) push(String(t.parentTaskId), id);
  }
  return dependentsOf;
}

/** BFS transitive closure of dependents from a root id (inclusive). */
function closureFrom(rootId, dependentsOf) {
  const out = new Set([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const cur = queue.shift();
    for (const dep of (dependentsOf.get(cur) || [])) {
      if (!out.has(dep)) { out.add(dep); queue.push(dep); }
    }
  }
  return out;
}

// ---- Parent rollup -------------------------------------------------------

/**
 * Recompute every unlocked parent's planned range from its children's CURRENT
 * stored dates (parent start = min child start, end = max child end). Locked
 * parents are left as-is (lock > rollup). Only writes parents that change.
 */
async function rollupParents(projectId) {
  const tasks = await Task.find({ projectId })
    .select("parentTaskId scheduleLocked planning.plannedStartDate planning.plannedEndDate")
    .lean();
  const byId = new Map(tasks.map((t) => [String(t._id), t]));
  const childrenByParent = new Map();
  for (const t of tasks) {
    if (!t.parentTaskId) continue;
    const pid = String(t.parentTaskId);
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
    childrenByParent.get(pid).push(t);
  }

  const ops = [];
  for (const [pid, kids] of childrenByParent) {
    const parent = byId.get(pid);
    if (!parent || parent.scheduleLocked) continue;
    const starts = kids.map((k) => k.planning?.plannedStartDate).filter(Boolean).map((d) => new Date(d).getTime());
    const ends   = kids.map((k) => k.planning?.plannedEndDate).filter(Boolean).map((d) => new Date(d).getTime());
    if (!starts.length && !ends.length) continue;

    const newStart = starts.length ? Math.min(...starts) : null;
    const newEnd   = ends.length ? Math.max(...ends) : null;
    const curStart = parent.planning?.plannedStartDate ? new Date(parent.planning.plannedStartDate).getTime() : null;
    const curEnd   = parent.planning?.plannedEndDate ? new Date(parent.planning.plannedEndDate).getTime() : null;
    if (newStart === curStart && newEnd === curEnd) continue;

    const set = {};
    if (newStart != null) set["planning.plannedStartDate"] = new Date(newStart);
    if (newEnd != null)   set["planning.plannedEndDate"]   = new Date(newEnd);
    if (newStart != null && newEnd != null) {
      set.durationDays = Math.max(0, Math.round((newEnd - newStart) / DAY_MS));
    }
    ops.push({ updateOne: { filter: { _id: parent._id }, update: { $set: set } } });
  }
  if (ops.length) await Task.bulkWrite(ops);
  return ops.length;
}

// ---- Core: derive a clean schedule --------------------------------------

function durationOf(t, defaultDurationDays) {
  if (t.durationDays != null) return Math.max(0, Number(t.durationDays));
  const d = dayDiff(t.planning?.plannedEndDate, t.planning?.plannedStartDate);
  if (d != null && d >= 0) return d;
  return defaultDurationDays;
}

/**
 * calculateTaskDates(projectId, options)
 *   options: { overwriteExisting=false, defaultDurationDays=3, persist=true, actor=null }
 * Derives plannedStart/End for every task from project start + dependency ends
 * + duration, applies parent rollup, and (when persist) writes them.
 * Returns { computed, scheduled, skipped, total } or { skipped:"no_start_date" }
 * / { error:"DEPENDENCY_CYCLE", cycle }.
 */
async function calculateTaskDates(projectId, options = {}) {
  const {
    overwriteExisting = false,
    defaultDurationDays = 3,
    persist = true,
    actor = null,
  } = options;

  const project = await Project.findById(projectId).select("startDate settings planSnapshot").lean();
  if (!project) return { error: "PROJECT_NOT_FOUND" };
  if (!project.startDate) return { skipped: "no_start_date" };

  const tasks = await Task.find({ projectId })
    .select("dependsOn parentTaskId subtaskOrder dayOffsetFromProjectStart phase durationDays calendarMode scheduleLocked planning.plannedStartDate planning.plannedEndDate planning.baselinePlannedStartDate planning.baselinePlannedEndDate")
    .lean();
  if (!tasks.length) return { scheduled: 0, skipped: 0, total: 0, computed: {} };

  const { hasCycle, cycle } = validateDependencies(tasks);
  if (hasCycle) return { error: "DEPENDENCY_CYCLE", cycle };

  const projectMode = project.settings?.calendarMode || "calendar_days";
  const baseStart = startOfDay(project.startDate);
  // Phase day budgets: a phase's startDayOffset becomes the base for tasks in
  // that phase that have no explicit dayOffsetFromProjectStart of their own.
  const phaseOffset = new Map();
  for (const p of (project.planSnapshot?.phases || [])) {
    if (p.name) phaseOffset.set(String(p.name).toLowerCase(), Number(p.startDayOffset || 0));
  }
  const byId = new Map(tasks.map((t) => [String(t._id), t]));
  const order = topoOrder(tasks);
  const computed = new Map();

  for (const id of order) {
    const t = byId.get(id);
    const mode = t.calendarMode || projectMode;
    const dur = durationOf(t, defaultDurationDays);
    const depEnds = (t.dependsOn || [])
      .map(String)
      .filter((d) => computed.has(d))
      .map((d) => computed.get(d).end);
    let start;
    if (depEnds.length) {
      const maxEnd = depEnds.reduce((a, b) => (a > b ? a : b));
      start = addDays(maxEnd, 1, mode);
    } else {
      // A task's own offset wins; otherwise fall back to its phase budget offset.
      const ownOffset = Number(t.dayOffsetFromProjectStart || 0);
      const baseOffset = ownOffset > 0 ? ownOffset : (phaseOffset.get(String(t.phase || "").toLowerCase()) || 0);
      start = addDays(baseStart, baseOffset, mode);
    }
    const end = addDays(start, dur, mode);
    computed.set(id, { start, end, dur });
  }

  // Parent rollup (in-memory) so persisted parent dates already reflect children.
  const childrenByParent = new Map();
  for (const t of tasks) {
    if (!t.parentTaskId) continue;
    const pid = String(t.parentTaskId);
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
    childrenByParent.get(pid).push(String(t._id));
  }
  for (const [pid, childIds] of childrenByParent) {
    const kids = childIds.map((c) => computed.get(c)).filter(Boolean);
    if (!kids.length) continue;
    const start = kids.map((c) => c.start).reduce((a, b) => (a < b ? a : b));
    const end   = kids.map((c) => c.end).reduce((a, b) => (a > b ? a : b));
    const dur = dayDiff(end, start) ?? 0;
    computed.set(pid, { start, end, dur });
  }

  let scheduled = 0, skipped = 0;
  if (persist) {
    const ops = [];
    for (const t of tasks) {
      const c = computed.get(String(t._id));
      if (!c) continue;
      if (t.scheduleLocked) { skipped++; continue; }
      if (!overwriteExisting && t.planning?.plannedStartDate) { skipped++; continue; }
      const set = {
        "planning.plannedStartDate": c.start,
        "planning.plannedEndDate": c.end,
      };
      if (t.durationDays == null) set.durationDays = c.dur;
      if (!t.planning?.baselinePlannedStartDate) set["planning.baselinePlannedStartDate"] = c.start;
      if (!t.planning?.baselinePlannedEndDate)   set["planning.baselinePlannedEndDate"]   = c.end;
      ops.push({ updateOne: { filter: { _id: t._id }, update: { $set: set } } });
      scheduled++;
    }
    if (ops.length) await Task.bulkWrite(ops);
    await recomputePlanTotals(projectId);
    await logActivity({
      projectId, actorId: actor,
      entityType: "project", entityId: projectId,
      action: "planner.schedule.recalculated",
      description: `Schedule recalculated — ${scheduled} task(s) dated, ${skipped} skipped`,
      metadata: { scheduled, skipped, total: tasks.length, overwriteExisting },
    }).catch(() => {});
  }

  const computedObj = {};
  for (const [k, v] of computed) computedObj[k] = { start: v.start, end: v.end, dur: v.dur };
  return { computed: computedObj, scheduled, skipped, total: tasks.length };
}

// ---- Core: cascade shift -------------------------------------------------

/**
 * shiftTaskAndDependents(taskId, shiftDays, { reason, actor, source })
 * Moves the task and every (transitive) dependent + descendant subtask by the
 * SAME signed delta — preserving each one's duration and inter-task slack.
 * Skips locked / done tasks. Writes shiftHistory + activity + notification.
 * Throws { code:"DEPENDENCY_CYCLE" } if the graph is circular (no writes).
 */
async function shiftTaskAndDependents(taskId, shiftDays, opts = {}) {
  const {
    reason = "", actor = null, source = "manual",
    // skipIfShiftedToday: don't move any task whose lastShiftedAt is already
    //   today — makes the nightly cron idempotent (cascades + re-runs never
    //   double-shift a task within the same day).
    skipIfShiftedToday = false,
    // notify: fire the per-assignee in-app notification (suppressed by the cron,
    //   which sends its own digest instead).
    notify: shouldNotify = true,
  } = opts;
  const delta = Math.trunc(Number(shiftDays) || 0);

  const root = await Task.findById(taskId).select("projectId title").lean();
  if (!root) return { error: "TASK_NOT_FOUND" };
  if (delta === 0) return { shifted: 0, skipped: 0, rootTaskId: taskId, shiftDays: 0, shiftedIds: [], affectedAssignees: [] };

  const projectId = root.projectId;
  const project = await Project.findById(projectId).select("settings").lean();
  const projectMode = project?.settings?.calendarMode || "calendar_days";
  const todayMs = startOfDay(new Date()).getTime();

  const tasks = await Task.find({ projectId })
    .select("dependsOn parentTaskId status scheduleLocked calendarMode assignedTo title lastShiftedAt planning.plannedStartDate planning.plannedEndDate")
    .lean();

  const { hasCycle, cycle } = validateDependencies(tasks);
  if (hasCycle) {
    const e = new Error("Circular dependency detected — schedule not shifted.");
    e.code = "DEPENDENCY_CYCLE";
    e.cycle = cycle;
    throw e;
  }

  const byId = new Map(tasks.map((t) => [String(t._id), t]));
  const dependentsOf = buildDependentsMap(tasks, { includeChildren: true });
  const rootId = String(taskId);
  const affected = closureFrom(rootId, dependentsOf);

  const now = new Date();
  const ops = [];
  const notifyUserIds = new Set();
  const shiftedIds = [];
  let shifted = 0, skipped = 0;

  for (const id of affected) {
    const t = byId.get(id);
    if (!t) continue;
    if (t.scheduleLocked || SHIFT_PROTECTED_STATUSES.includes(t.status)) { skipped++; continue; }
    // Same-day idempotency (cron): never move a task already shifted today.
    if (skipIfShiftedToday && t.lastShiftedAt && startOfDay(t.lastShiftedAt).getTime() === todayMs) { skipped++; continue; }
    const fromStart = t.planning?.plannedStartDate || null;
    const fromEnd   = t.planning?.plannedEndDate || null;
    if (!fromStart && !fromEnd) { skipped++; continue; }

    const mode = t.calendarMode || projectMode;
    const toStart = fromStart ? addDays(fromStart, delta, mode) : null;
    const toEnd   = fromEnd ? addDays(fromEnd, delta, mode) : null;

    const set = { lastShiftedAt: now, lastShiftedBy: actor || null };
    if (toStart) set["planning.plannedStartDate"] = toStart;
    if (toEnd)   set["planning.plannedEndDate"]   = toEnd;

    const isRoot = id === rootId;
    const entry = {
      shiftedAt: now,
      shiftedBy: actor || null,
      shiftDays: delta,
      source: isRoot ? source : "cascade",
      reason: isRoot ? reason : `Cascaded from "${root.title || rootId}"`,
      fromStart, toStart, fromEnd, toEnd,
      triggeredByTaskId: isRoot ? null : taskId,
    };

    ops.push({
      updateOne: {
        filter: { _id: t._id },
        update: {
          $set: set,
          $inc: { shiftCount: 1 },
          $push: { shiftHistory: { $each: [entry], $slice: -50 } },
        },
      },
    });
    if (t.assignedTo) notifyUserIds.add(String(t.assignedTo));
    shiftedIds.push(String(t._id));
    shifted++;
  }

  if (ops.length) await Task.bulkWrite(ops);
  // Keep unlocked parents' ranges consistent with any moved children.
  await rollupParents(projectId);
  await recomputePlanTotals(projectId);

  await logActivity({
    projectId, actorId: actor,
    entityType: "task", entityId: taskId,
    action: "planner.schedule.shifted",
    description: `Schedule shifted by ${delta >= 0 ? "+" : ""}${delta} day(s) — ${shifted} task(s) moved${skipped ? `, ${skipped} skipped` : ""} (${source})`,
    metadata: { rootTaskId: taskId, shiftDays: delta, shifted, skipped, source, reason },
  }).catch(() => {});

  if (shouldNotify && notifyUserIds.size) {
    try {
      notify({
        type: "task.schedule_shifted",
        module: "pms",
        priority: "normal",
        title: `Schedule updated: ${root.title || "task"}`,
        message: `Planned dates moved by ${delta >= 0 ? "+" : ""}${delta} day(s).`,
        link: `/tasks/${taskId}`,
        recipients: [...notifyUserIds],
        actor: actor ? { _id: actor } : undefined,
        relatedTo: { module: "pms", recordId: projectId },
        metadata: { rootTaskId: taskId, shiftDays: delta, source },
      });
    } catch (e) { /* best-effort */ }
  }

  return { shifted, skipped, rootTaskId: taskId, shiftDays: delta, shiftedIds, affectedAssignees: [...notifyUserIds] };
}

// ---- Core: re-derive dependents after a single-row date change ----------

/**
 * recalculateDependents(taskId)
 * Re-derives the earliest start of every TRANSITIVE dependent from its
 * predecessor ends, preserving each dependent's own duration. Skips
 * locked/done tasks. Idempotent — only rows whose dates actually change are
 * written. Does NOT record shiftHistory (this is a derive, not a shift).
 */
async function recalculateDependents(taskId) {
  const root = await Task.findById(taskId).select("projectId").lean();
  if (!root) return { error: "TASK_NOT_FOUND" };
  const projectId = root.projectId;

  const project = await Project.findById(projectId).select("settings").lean();
  const projectMode = project?.settings?.calendarMode || "calendar_days";

  const tasks = await Task.find({ projectId })
    .select("dependsOn parentTaskId status scheduleLocked calendarMode durationDays planning.plannedStartDate planning.plannedEndDate")
    .lean();

  const { hasCycle, cycle } = validateDependencies(tasks);
  if (hasCycle) {
    const e = new Error("Circular dependency detected.");
    e.code = "DEPENDENCY_CYCLE";
    e.cycle = cycle;
    throw e;
  }

  const byId = new Map(tasks.map((t) => [String(t._id), t]));
  const dependentsOf = buildDependentsMap(tasks);
  const affected = closureFrom(String(taskId), dependentsOf);
  affected.delete(String(taskId)); // root itself is the anchor, not recomputed
  if (!affected.size) return { recalculated: 0 };

  const order = topoOrder(tasks).filter((id) => affected.has(id));
  const newDates = new Map();
  const ops = [];
  let recalculated = 0;

  for (const id of order) {
    const t = byId.get(id);
    if (t.scheduleLocked || SHIFT_PROTECTED_STATUSES.includes(t.status)) continue;
    const mode = t.calendarMode || projectMode;
    const dur = t.durationDays != null
      ? Math.max(0, Number(t.durationDays))
      : (dayDiff(t.planning?.plannedEndDate, t.planning?.plannedStartDate) ?? 0);

    const depEnds = (t.dependsOn || [])
      .map(String)
      .map((d) => {
        if (newDates.has(d)) return newDates.get(d).end;
        const dt = byId.get(d);
        return dt?.planning?.plannedEndDate ? new Date(dt.planning.plannedEndDate) : null;
      })
      .filter(Boolean);
    if (!depEnds.length) continue; // no predecessor to anchor against

    const maxEnd = depEnds.reduce((a, b) => (a > b ? a : b));
    const start = addDays(maxEnd, 1, mode);
    const end = addDays(start, dur, mode);
    newDates.set(id, { start, end });

    const curStart = t.planning?.plannedStartDate ? new Date(t.planning.plannedStartDate).getTime() : null;
    const curEnd   = t.planning?.plannedEndDate ? new Date(t.planning.plannedEndDate).getTime() : null;
    if (curStart === start.getTime() && curEnd === end.getTime()) continue;

    ops.push({
      updateOne: {
        filter: { _id: t._id },
        update: { $set: { "planning.plannedStartDate": start, "planning.plannedEndDate": end } },
      },
    });
    recalculated++;
  }

  if (ops.length) await Task.bulkWrite(ops);
  await rollupParents(projectId);
  await recomputePlanTotals(projectId);
  return { recalculated };
}

// ---- Overdue detection (used by the Phase 2 cron) -----------------------

/**
 * detectOverdueTasks(projectIdOrAll = "all")
 * Pure read of tasks past their planned end and still in flight. Excludes
 * locked, on_hold, blocked, and done tasks.
 */
async function detectOverdueTasks(projectIdOrAll = "all") {
  const today = startOfDay(new Date());
  const filter = {
    "planning.plannedEndDate": { $lt: today },
    status: { $nin: [...SHIFT_PROTECTED_STATUSES, "on_hold", "blocked"] },
    scheduleLocked: { $ne: true },
  };
  if (projectIdOrAll && projectIdOrAll !== "all") filter.projectId = projectIdOrAll;
  return Task.find(filter)
    .select("projectId title status autoShiftEnabled lastShiftedAt calendarMode planning.plannedStartDate planning.plannedEndDate")
    .lean();
}

module.exports = {
  SHIFT_PROTECTED_STATUSES,
  addDays,
  getScheduleStatus,
  validateDependencies,
  topoOrder,
  rollupParents,
  calculateTaskDates,
  shiftTaskAndDependents,
  recalculateDependents,
  detectOverdueTasks,
};
