/**
 * pmsReminders — Phase 3b.
 *
 * Daily 06:30 IST: overdue task digest per assignee + idle approval gate nudges.
 *
 * Why 06:30: ahead of typical 9 AM standups so the inbox bell is current.
 *
 * Best-effort: any error in a single user/gate iteration logs and continues.
 *
 * Wire-up:
 *   In backend/src/index.js after connectDb():
 *     const { startPMSReminders } = require("./modules/pms/cron/pmsReminders");
 *     startPMSReminders();
 *
 * Gated by env flag PMS_REMINDERS_ENABLED (default true). Set to "false" to
 * suppress in dev / staging.
 */

const cron = require("node-cron");
const Task = require("../models/Task.model");
const ApprovalGate = require("../models/ApprovalGate.model");
const teamResolver = require("../services/teamResolver");

let notify = () => {};
try {
  ({ dispatch: notify } = require("../../notifications/services/notificationDispatcher"));
} catch (e) { /* optional */ }

const TASK_DONE = ["approved", "released_to_site", "completed"];

const IDLE_GATE_THRESHOLD_DAYS = 3;

/**
 * Group overdue tasks by assignedTo and emit one notification per user.
 */
async function runOverdueDigest() {
  const now = new Date();
  const overdue = await Task.find({
    dueDate: { $lt: now },
    status: { $nin: [...TASK_DONE, "blocked"] },
    assignedTo: { $ne: null },
  })
    .populate("projectId", "name trackingId")
    .select("title taskType status dueDate projectId assignedTo")
    .lean();

  const byUser = new Map();
  for (const t of overdue) {
    const key = String(t.assignedTo);
    if (!byUser.has(key)) byUser.set(key, []);
    byUser.get(key).push(t);
  }

  let dispatched = 0;
  for (const [userId, tasks] of byUser) {
    try {
      const top = tasks
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 5);
      const sample = top
        .map((t) => `• ${t.title} (${t.projectId?.trackingId || ""})`)
        .join("\n");

      notify({
        type: "tasks.overdue_digest",
        module: "pms",
        priority: "high",
        title: `${tasks.length} overdue task${tasks.length === 1 ? "" : "s"}`,
        message: sample + (tasks.length > 5 ? `\n+ ${tasks.length - 5} more` : ""),
        link: `/tasks`,
        recipients: [userId],
        relatedTo: { module: "pms", recordId: null },
        notifyActor: true,
        metadata: { count: tasks.length },
      });
      dispatched++;
    } catch (e) {
      console.warn("[pmsReminders.runOverdueDigest] user fail:", e.message);
    }
  }
  return { usersNotified: dispatched, totalOverdue: overdue.length };
}

/**
 * Notify project teams about gates open longer than IDLE_GATE_THRESHOLD_DAYS.
 * Recipients are project owners (primaryDesigner + supervisor) via projectId.
 */
async function runIdleGateNudge() {
  const cutoff = new Date(Date.now() - IDLE_GATE_THRESHOLD_DAYS * 86400000);
  const idleGates = await ApprovalGate.find({
    status: "open",
    createdAt: { $lt: cutoff },
  })
    .populate({
      path: "projectId",
      select: "name trackingId assignments",
      populate: [
        { path: "assignments.responsibilityId", select: "slug" },
        { path: "assignments.users", select: "_id" },
      ],
    })
    .select("label gateType approverType createdAt projectId")
    .lean();

  let dispatched = 0;
  for (const g of idleGates) {
    try {
      const lead = await teamResolver.resolveFirstBySlug(g.projectId, "lead_designer");
      const supervisor = await teamResolver.resolveFirstBySlug(g.projectId, "supervisor");
      const recipients = [lead?._id, supervisor?._id].filter(Boolean);
      if (recipients.length === 0) continue;

      const age = Math.floor((Date.now() - new Date(g.createdAt).getTime()) / 86400000);
      notify({
        type: "gate.idle_reminder",
        module: "pms",
        priority: "normal",
        title: `Gate open ${age} days: ${g.label}`,
        message: `Project ${g.projectId?.trackingId || ""} is waiting on ${g.approverType.replace("_", " ")} approval.`,
        link: `/projects/${g.projectId?._id}`,
        recipients,
        relatedTo: { module: "pms", recordId: g.projectId?._id },
        metadata: { gateId: g._id, gateType: g.gateType, ageDays: age },
      });
      dispatched++;
    } catch (e) {
      console.warn("[pmsReminders.runIdleGateNudge] gate fail:", e.message);
    }
  }
  return { gatesNudged: dispatched, idleGatesFound: idleGates.length };
}

/**
 * Combined daily job. Exposed so it can be called manually from a smoke test.
 */
async function runDailyReminders() {
  const overdue = await runOverdueDigest();
  const idle = await runIdleGateNudge();
  console.log(
    `[pmsReminders] Daily run — overdue digest: ${overdue.usersNotified} user(s) notified (${overdue.totalOverdue} tasks); idle gates: ${idle.gatesNudged} project(s) nudged (${idle.idleGatesFound} idle).`
  );
  return { overdue, idle };
}

function startPMSReminders() {
  const enabled = String(process.env.PMS_REMINDERS_ENABLED || "true").toLowerCase() !== "false";
  if (!enabled) {
    console.log("[pmsReminders] PMS_REMINDERS_ENABLED=false — skipping cron registration.");
    return;
  }
  // Daily at 06:30 IST. node-cron uses server-local time; if your server is UTC, adjust.
  cron.schedule("30 6 * * *", () => {
    runDailyReminders().catch((err) => console.error("[pmsReminders] daily run failed:", err.message));
  });
  console.log("[pmsReminders] cron registered: daily 06:30 (overdue + idle gates).");
}

module.exports = {
  startPMSReminders,
  runDailyReminders,
  runOverdueDigest,
  runIdleGateNudge,
};
