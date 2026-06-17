/**
 * One-time backfill — stamp a `taskSnapshot` onto drawing versions that predate
 * the snapshot feature, so the Master Sheet version history can render the
 * task-level columns (priority, work status, planned dates, hours, progress,
 * delay, checklist, assignee) for older versions too.
 *
 * IMPORTANT: past task state was never recorded, so for existing versions this
 * stamps the parent task's CURRENT values (an approximation). New uploads going
 * forward capture the real state at upload time (see snapshotTaskOntoDrawing in
 * Drawing.controller.js). Only drawings without a snapshot are touched.
 *
 * Idempotent, safe to re-run. Use --dry to preview without writing:
 *   node backend/src/scripts/backfillDrawingTaskSnapshot.js
 *   node backend/src/scripts/backfillDrawingTaskSnapshot.js --dry
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Drawing = require("../modules/pms/models/Drawing.model");
const Task = require("../modules/pms/models/Task.model");
// Register the User model so Task.assignedTo can be populated.
require("../modules/auth/models/user.model");

const DAY_MS = 24 * 60 * 60 * 1000;
const DRY = process.argv.includes("--dry");

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB" + (DRY ? " (dry run — no writes)" : ""));

    const drawings = await Drawing.find({
      taskId: { $ne: null },
      $or: [
        { taskSnapshot: { $exists: false } },
        { "taskSnapshot.capturedAt": { $exists: false } },
      ],
    }).select("_id taskId").lean();

    console.log(`Found ${drawings.length} drawing(s) without a task snapshot.`);

    const taskCache = new Map();
    let updated = 0;
    let skipped = 0;

    for (const d of drawings) {
      const tid = String(d.taskId);
      if (!taskCache.has(tid)) {
        const task = await Task.findById(d.taskId)
          .select("priority workStatus status planning startDate completedAt checklist assignedTo")
          .populate("assignedTo", "name")
          .lean();
        taskCache.set(tid, task || null);
      }
      const task = taskCache.get(tid);
      if (!task) { skipped++; continue; }

      const p = task.planning || {};
      const plannedDays = (p.plannedStartDate && p.plannedEndDate)
        ? Math.max(0, Math.round((new Date(p.plannedEndDate).getTime() - new Date(p.plannedStartDate).getTime()) / DAY_MS))
        : null;

      let delayDays = 0;
      if (p.plannedEndDate && !["completed", "on_hold"].includes(task.status)) {
        const diff = Math.round((Date.now() - new Date(p.plannedEndDate).getTime()) / DAY_MS);
        delayDays = diff > 0 ? diff : 0;
      }

      const ck = Array.isArray(task.checklist) ? task.checklist : [];
      const snapshot = {
        priority:         task.priority || "",
        workStatus:       task.workStatus || "",
        plannedStartDate: p.plannedStartDate || null,
        plannedEndDate:   p.plannedEndDate || null,
        plannedDays,
        plannedHours:     p.plannedHours || 0,
        actualHours:      p.actualHours || 0,
        progressPercent:  p.progressPercent || 0,
        delayDays,
        assignedToName:   task.assignedTo?.name || "",
        checklistDone:    ck.filter((c) => c.isCompleted).length,
        checklistTotal:   ck.length,
        capturedAt:       new Date(),
      };

      if (!DRY) {
        await Drawing.updateOne({ _id: d._id }, { $set: { taskSnapshot: snapshot } });
      }
      updated++;
    }

    console.log(`${DRY ? "Would update" : "Updated"} ${updated} drawing(s). Skipped ${skipped} (no task).`);
  } catch (err) {
    console.error("Backfill failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();
