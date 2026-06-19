/**
 * One-time backfill — initialize the scheduling-engine fields on existing tasks.
 *
 * The parent/subtask + day-based scheduling feature added several fields to the
 * Task model. They all default at the schema level, but existing documents
 * predate the schema, so this script stamps safe defaults once and derives
 * `durationDays` from whatever date information a task already has.
 *
 * Per task (only when the field is currently missing/null — idempotent):
 *   isSubtask        = !!parentTaskId        (false for legacy standalone tasks)
 *   scheduleLocked   = false
 *   autoShiftEnabled = null   (inherit project setting)
 *   calendarMode     = null   (inherit project setting)
 *   shiftCount       = 0
 *   shiftHistory     = []
 *   durationDays     = (plannedEnd − plannedStart) in days,
 *                      else (dueDate − startDate) in days,
 *                      else left null
 *
 * Usage:
 *   node backend/src/scripts/backfillTaskScheduleFields.js --dry   # report only
 *   node backend/src/scripts/backfillTaskScheduleFields.js         # apply
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Task = require("../modules/pms/models/Task.model");

const DRY_RUN = process.argv.includes("--dry");
const DAY_MS = 24 * 60 * 60 * 1000;

function deriveDuration(t) {
  const ps = t.planning?.plannedStartDate;
  const pe = t.planning?.plannedEndDate;
  if (ps && pe) {
    const d = Math.round((new Date(pe).getTime() - new Date(ps).getTime()) / DAY_MS);
    if (d >= 0) return d;
  }
  if (t.startDate && t.dueDate) {
    const d = Math.round((new Date(t.dueDate).getTime() - new Date(t.startDate).getTime()) / DAY_MS);
    if (d >= 0) return d;
  }
  return null;
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Connected to MongoDB. ${DRY_RUN ? "DRY RUN — no writes." : "APPLYING changes."}`);

    const tasks = await Task.find({})
      .select("parentTaskId isSubtask scheduleLocked autoShiftEnabled calendarMode shiftCount shiftHistory durationDays startDate dueDate planning.plannedStartDate planning.plannedEndDate")
      .lean();

    let scanned = 0, updated = 0, withDuration = 0;
    const ops = [];

    for (const t of tasks) {
      scanned++;
      const set = {};

      const wantSubtask = !!t.parentTaskId;
      if (t.isSubtask !== wantSubtask) set.isSubtask = wantSubtask;
      if (t.scheduleLocked == null) set.scheduleLocked = false;
      if (t.autoShiftEnabled === undefined) set.autoShiftEnabled = null;
      if (t.calendarMode === undefined) set.calendarMode = null;
      if (t.shiftCount == null) set.shiftCount = 0;
      if (!Array.isArray(t.shiftHistory)) set.shiftHistory = [];

      if (t.durationDays == null) {
        const dur = deriveDuration(t);
        if (dur != null) { set.durationDays = dur; withDuration++; }
      }

      if (Object.keys(set).length) {
        updated++;
        ops.push({ updateOne: { filter: { _id: t._id }, update: { $set: set } } });
      }
    }

    if (!DRY_RUN && ops.length) {
      // chunk to keep bulkWrite payloads sane on very large collections
      const CHUNK = 1000;
      for (let i = 0; i < ops.length; i += CHUNK) {
        await Task.bulkWrite(ops.slice(i, i + CHUNK), { ordered: false });
      }
    }

    console.log(`Done. scanned=${scanned} updated=${updated} withDuration=${withDuration}${DRY_RUN ? " (dry run — nothing written)" : ""}`);
  } catch (err) {
    console.error("Backfill failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();
