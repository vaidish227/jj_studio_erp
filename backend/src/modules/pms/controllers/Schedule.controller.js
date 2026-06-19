/**
 * Schedule controller — parent/subtask CRUD + day-based scheduling actions.
 * --------------------------------------------------------------------------
 * All date math is delegated to services/scheduleEngine.js. Status transitions
 * are NOT handled here — they go through the existing Task controller so the
 * workflow engine + gate enforcement still run. This controller only touches
 * planned dates, duration, locking, ordering, and the parent/subtask link.
 */
const mongoose = require("mongoose");

const Task    = require("../models/Task.model");
const Project = require("../models/Project.model");
const User    = require("../../auth/models/user.model");

const scheduleEngine = require("../services/scheduleEngine");
const { dayDiff, startOfDay, recomputePlanTotals } = require("../services/plannerHelpers");
const { syncPhaseMilestones } = require("../services/milestoneSync");
const { logActivity } = require("../../../shared/activityLogger");

const {
  createSubtaskSchema,
  updateSubtaskSchema,
  manualShiftSchema,
  recalcSchema,
  bulkSchedulePatchSchema,
} = require("../validator/Schedule.validator");

const isOid = (v) => mongoose.Types.ObjectId.isValid(String(v));

/** Build the prospective dependency graph and reject if it would be circular. */
async function wouldCreateCycle(projectId, taskId, newDependsOn) {
  const tasks = await Task.find({ projectId }).select("_id dependsOn").lean();
  const tid = String(taskId);
  const patched = tasks.map((t) =>
    String(t._id) === tid ? { ...t, dependsOn: newDependsOn } : t
  );
  return scheduleEngine.validateDependencies(patched);
}

// ---- Subtasks ------------------------------------------------------------

/** POST /:projectId/rows/:taskId/subtasks — create a subtask under a parent. */
exports.createSubtask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    if (!isOid(projectId) || !isOid(taskId)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const { value, error } = createSubtaskSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const parent = await Task.findById(taskId)
      .select("projectId taskType phase calendarMode")
      .lean();
    if (!parent) return res.status(404).json({ message: "Parent task not found" });
    if (String(parent.projectId) !== String(projectId)) {
      return res.status(400).json({ message: "Parent task is not in this project" });
    }

    const planning = {};
    if (value.plannedStartDate) {
      planning.plannedStartDate = value.plannedStartDate;
      planning.baselinePlannedStartDate = value.plannedStartDate;
    }
    if (value.plannedEndDate) {
      planning.plannedEndDate = value.plannedEndDate;
      planning.baselinePlannedEndDate = value.plannedEndDate;
    }

    const subtask = await Task.create({
      projectId,
      parentTaskId: taskId,
      isSubtask: true,
      title: value.title,
      taskType: value.taskType || parent.taskType,
      assignedTo: value.assignedTo || undefined,
      priority: value.priority,
      notes: value.notes || "",
      phase: parent.phase || undefined,
      durationDays: value.durationDays != null ? value.durationDays : null,
      subtaskOrder: value.subtaskOrder != null ? value.subtaskOrder : 0,
      dependsOn: value.dependsOn || [],
      calendarMode: parent.calendarMode || null,
      planning,
    });

    // Keep the parent's planned range in sync with its children.
    await scheduleEngine.rollupParents(projectId);
    await recomputePlanTotals(projectId);

    await logActivity({
      projectId, actorId: req.user?._id,
      entityType: "task", entityId: subtask._id,
      action: "planner.subtask.created",
      description: `Subtask created under parent: ${value.title}`,
      metadata: { parentTaskId: taskId },
    }).catch(() => {});

    res.status(201).json({ taskId: subtask._id });
  } catch (err) {
    console.error("[Schedule.createSubtask]", err);
    res.status(500).json({ message: "Failed to create subtask" });
  }
};

/** PATCH /subtasks/:taskId — update a subtask's safe fields / planning. */
exports.updateSubtask = async (req, res) => {
  try {
    const { taskId } = req.params;
    if (!isOid(taskId)) return res.status(400).json({ message: "Invalid taskId" });

    const { value, error } = updateSubtaskSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Subtask not found" });

    // Cycle guard if dependencies change.
    if (value.dependsOn !== undefined) {
      const { hasCycle, cycle } = await wouldCreateCycle(task.projectId, taskId, value.dependsOn);
      if (hasCycle) {
        return res.status(422).json({ code: "DEPENDENCY_CYCLE", message: "This dependency would create a circular reference.", cycle });
      }
      task.dependsOn = value.dependsOn;
    }

    for (const f of ["title", "assignedTo", "priority", "notes", "subtaskOrder", "scheduleLocked"]) {
      if (value[f] !== undefined) task[f] = value[f] === "" ? "" : value[f];
    }
    if (value.durationDays !== undefined) task.durationDays = value.durationDays;

    let datesChanged = false;
    if (value.plannedStartDate !== undefined) {
      task.planning.plannedStartDate = value.plannedStartDate;
      if (!task.planning.baselinePlannedStartDate && value.plannedStartDate) {
        task.planning.baselinePlannedStartDate = value.plannedStartDate;
      }
      datesChanged = true;
    }
    if (value.plannedEndDate !== undefined) {
      task.planning.plannedEndDate = value.plannedEndDate;
      if (!task.planning.baselinePlannedEndDate && value.plannedEndDate) {
        task.planning.baselinePlannedEndDate = value.plannedEndDate;
      }
      datesChanged = true;
    }

    await task.save();

    if (datesChanged) {
      try { await scheduleEngine.recalculateDependents(taskId); }
      catch (e) { if (e.code !== "DEPENDENCY_CYCLE") throw e; }
    }
    await scheduleEngine.rollupParents(task.projectId);
    await recomputePlanTotals(task.projectId);

    await logActivity({
      projectId: task.projectId, actorId: req.user?._id,
      entityType: "task", entityId: task._id,
      action: "planner.subtask.updated",
      description: `Subtask updated: ${task.title}`,
      metadata: { fields: Object.keys(value) },
    }).catch(() => {});

    res.json({ taskId: task._id, updatedAt: task.updatedAt });
  } catch (err) {
    console.error("[Schedule.updateSubtask]", err);
    res.status(500).json({ message: "Failed to update subtask" });
  }
};

// ---- Manual shift --------------------------------------------------------

/** POST /rows/:taskId/shift — manual shift / date / duration change with reason. */
exports.manualShift = async (req, res) => {
  try {
    const { taskId } = req.params;
    if (!isOid(taskId)) return res.status(400).json({ message: "Invalid taskId" });

    const { value, error } = manualShiftSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const task = await Task.findById(taskId)
      .select("projectId calendarMode planning.plannedStartDate planning.plannedEndDate durationDays shiftCount")
      .lean();
    if (!task) return res.status(404).json({ message: "Task not found" });

    const project = await Project.findById(task.projectId).select("settings").lean();
    const mode = task.calendarMode || project?.settings?.calendarMode || "calendar_days";

    const curStart = task.planning?.plannedStartDate || null;
    const curEnd   = task.planning?.plannedEndDate || null;

    // Resolve the operation: a uniform shift (start move / explicit days) vs a
    // duration/end change (end moves, start stays).
    let delta = null;
    if (value.shiftDays != null) {
      delta = value.shiftDays;
    } else if (value.plannedStartDate != null) {
      if (!curStart) return res.status(422).json({ message: "Task has no current start date to shift from." });
      delta = dayDiff(startOfDay(value.plannedStartDate), startOfDay(curStart));
    }

    // --- Branch A: uniform cascade shift ---
    if (delta != null) {
      if (delta === 0) return res.json({ shifted: 0, skipped: 0, shiftDays: 0 });
      try {
        const result = await scheduleEngine.shiftTaskAndDependents(taskId, delta, {
          reason: value.reason,
          actor: req.user?._id || null,
          source: "manual",
        });
        try { await syncPhaseMilestones(task.projectId, { actor: req.user?._id || null }); }
        catch (se) { console.error("[Schedule.manualShift:syncMilestones]", se.message); }
        return res.json(result);
      } catch (e) {
        if (e.code === "DEPENDENCY_CYCLE") {
          return res.status(422).json({ code: "DEPENDENCY_CYCLE", message: "Circular dependency — schedule not shifted.", cycle: e.cycle });
        }
        throw e;
      }
    }

    // --- Branch B: duration / end change (extends or trims, start fixed) ---
    if (!curStart) return res.status(422).json({ message: "Set a planned start date before changing duration/end." });
    const newDuration = value.durationDays != null
      ? value.durationDays
      : dayDiff(startOfDay(value.plannedEndDate), startOfDay(curStart));
    if (newDuration == null || newDuration < 0) {
      return res.status(422).json({ message: "Planned end cannot be before planned start." });
    }
    const newEnd = scheduleEngine.addDays(startOfDay(curStart), newDuration, mode);
    const now = new Date();
    const entry = {
      shiftedAt: now,
      shiftedBy: req.user?._id || null,
      shiftDays: dayDiff(newEnd, curEnd) || 0,
      source: "manual",
      reason: value.reason,
      fromStart: curStart, toStart: curStart,
      fromEnd: curEnd, toEnd: newEnd,
      triggeredByTaskId: null,
    };
    await Task.updateOne(
      { _id: taskId },
      {
        $set: { "planning.plannedEndDate": newEnd, durationDays: newDuration, lastShiftedAt: now, lastShiftedBy: req.user?._id || null },
        $inc: { shiftCount: 1 },
        $push: { shiftHistory: { $each: [entry], $slice: -50 } },
      }
    );

    if (value.cascade !== false) {
      try { await scheduleEngine.recalculateDependents(taskId); }
      catch (e) {
        if (e.code === "DEPENDENCY_CYCLE") {
          return res.status(422).json({ code: "DEPENDENCY_CYCLE", message: "Circular dependency — dependents not recalculated.", cycle: e.cycle });
        }
        throw e;
      }
    }
    await scheduleEngine.rollupParents(task.projectId);
    await recomputePlanTotals(task.projectId);
    try { await syncPhaseMilestones(task.projectId, { actor: req.user?._id || null }); }
    catch (se) { console.error("[Schedule.manualShift:syncMilestones]", se.message); }

    await logActivity({
      projectId: task.projectId, actorId: req.user?._id,
      entityType: "task", entityId: taskId,
      action: "planner.schedule.shifted",
      description: `Duration changed to ${newDuration} day(s) — ${value.reason}`,
      metadata: { durationDays: newDuration, source: "manual" },
    }).catch(() => {});

    res.json({ ok: true, durationDays: newDuration, plannedEndDate: newEnd });
  } catch (err) {
    console.error("[Schedule.manualShift]", err);
    res.status(500).json({ message: "Failed to shift schedule" });
  }
};

// ---- Recalculate ---------------------------------------------------------

/** POST /:projectId/recalculate — re-derive the whole project schedule. */
exports.recalculateProjectSchedule = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!isOid(projectId)) return res.status(400).json({ message: "Invalid projectId" });

    const { value, error } = recalcSchema.validate(req.body || {}, { stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const result = await scheduleEngine.calculateTaskDates(projectId, {
      overwriteExisting: value.overwriteExisting,
      defaultDurationDays: value.defaultDurationDays,
      persist: true,
      actor: req.user?._id || null,
    });

    if (result.error === "PROJECT_NOT_FOUND") return res.status(404).json({ message: "Project not found" });
    if (result.skipped === "no_start_date") {
      return res.status(422).json({ message: "Project has no start date — set one before recalculating." });
    }
    if (result.error === "DEPENDENCY_CYCLE") {
      return res.status(422).json({ code: "DEPENDENCY_CYCLE", message: "Circular dependency — schedule not recalculated.", cycle: result.cycle });
    }

    // Mirror the freshly computed phase ranges into ProjectMilestone (best-effort).
    let milestones = null;
    try { milestones = await syncPhaseMilestones(projectId, { actor: req.user?._id || null }); }
    catch (e) { console.error("[Schedule.recalc:syncMilestones]", e.message); }

    res.json({ ok: true, scheduled: result.scheduled, skipped: result.skipped, total: result.total, milestones });
  } catch (err) {
    console.error("[Schedule.recalculateProjectSchedule]", err);
    res.status(500).json({ message: "Failed to recalculate schedule" });
  }
};

// ---- Shift history -------------------------------------------------------

/** GET /rows/:taskId/shift-history — newest-first shift audit trail. */
exports.getShiftHistory = async (req, res) => {
  try {
    const { taskId } = req.params;
    if (!isOid(taskId)) return res.status(400).json({ message: "Invalid taskId" });

    const task = await Task.findById(taskId)
      .select("title shiftHistory shiftCount")
      .populate("shiftHistory.shiftedBy", "name email")
      .lean();
    if (!task) return res.status(404).json({ message: "Task not found" });

    const history = (task.shiftHistory || [])
      .slice()
      .sort((a, b) => new Date(b.shiftedAt) - new Date(a.shiftedAt));

    res.json({ taskId, title: task.title, shiftCount: task.shiftCount || 0, history });
  } catch (err) {
    console.error("[Schedule.getShiftHistory]", err);
    res.status(500).json({ message: "Failed to load shift history" });
  }
};

// ---- Bulk schedule patch (lock/unlock, auto-shift toggle) ----------------

/** POST /rows/bulk/patch — apply a small schedule patch to many rows. */
exports.bulkSchedulePatch = async (req, res) => {
  try {
    const { value, error } = bulkSchedulePatchSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const result = await Task.updateMany(
      { _id: { $in: value.taskIds } },
      { $set: value.patch }
    );

    res.json({ matched: result.matchedCount, modified: result.modifiedCount });
  } catch (err) {
    console.error("[Schedule.bulkSchedulePatch]", err);
    res.status(500).json({ message: "Failed to bulk update schedule" });
  }
};
