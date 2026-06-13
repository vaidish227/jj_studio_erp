const cron = require("node-cron");
const KitScheduledJob = require("../models/KitScheduledJob.model");
const KitTriggerEvent = require("../models/KitTriggerEvent.model");

/**
 * KIT maintenance — daily retention purge for the high-growth, disposable KIT
 * collections. Conservative by design:
 *
 *   - kit_scheduled_jobs : only TERMINAL jobs (done/cancelled/failed) older than
 *     KIT_JOB_RETENTION_DAYS are removed. Pending/processing jobs are never
 *     touched, so no in-flight journey is affected.
 *   - kit_trigger_events : the append-only audit/debug log is purged past
 *     KIT_TRIGGER_RETENTION_DAYS.
 *
 * Business data is intentionally NOT auto-purged: kit_message_logs (timeline +
 * analytics), kit_enrollments, kit_campaigns, kit_workflows, kit_templates all
 * persist until explicitly deleted.
 */
const JOB_RETENTION_DAYS     = parseInt(process.env.KIT_JOB_RETENTION_DAYS || "30", 10);
const TRIGGER_RETENTION_DAYS = parseInt(process.env.KIT_TRIGGER_RETENTION_DAYS || "180", 10);

const DAY_MS = 24 * 60 * 60 * 1000;

const runMaintenance = async () => {
  try {
    const now = Date.now();
    const jobCutoff     = new Date(now - JOB_RETENTION_DAYS * DAY_MS);
    const triggerCutoff = new Date(now - TRIGGER_RETENTION_DAYS * DAY_MS);

    const [jobs, events] = await Promise.all([
      KitScheduledJob.deleteMany({
        status: { $in: ["done", "cancelled", "failed"] },
        updatedAt: { $lt: jobCutoff },
      }),
      KitTriggerEvent.deleteMany({ firedAt: { $lt: triggerCutoff } }),
    ]);

    console.log(`[KitMaintenance] purged ${jobs.deletedCount || 0} terminal jobs (>${JOB_RETENTION_DAYS}d), ${events.deletedCount || 0} trigger events (>${TRIGGER_RETENTION_DAYS}d)`);
  } catch (err) {
    console.error("[KitMaintenance] error:", err.message);
  }
};

const startKitMaintenance = () => {
  // Daily at 03:45 (server-local) — off-peak, staggered from other crons.
  cron.schedule("45 3 * * *", runMaintenance);
  console.log("[KitMaintenance] Retention purge scheduled — daily at 03:45");
};

module.exports = { startKitMaintenance, runMaintenance };
