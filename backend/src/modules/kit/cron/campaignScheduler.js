const cron = require("node-cron");
const KitScheduledJob = require("../models/KitScheduledJob.model");
const campaignEngine  = require("../services/campaignEngine");
const triggerService  = require("../services/triggerService");

// Route a claimed job to its handler. campaign_step advances a campaign journey;
// workflow_action runs a delayed THEN action from the trigger engine.
const runJob = async (job) => {
  const action = job.action || {};
  if (action.type === "workflow_action") {
    await triggerService.runAction(action.actionData || {}, {
      entityType: action.entityType,
      entityId:   action.entityId,
      actor:      action.actor,
      workflowId: job.workflowId,
    });
    return { status: "done" };
  }
  // default: campaign step
  return campaignEngine.executeJob(job);
};

// Exponential backoff for transient failures: 1 min, 3 min, 9 min.
const retryDelayMs = (attempts) => Math.pow(3, attempts) * 60 * 1000;

const BATCH_SIZE = 25;

/**
 * processKitJobs — claim due scheduled jobs and run them.
 *
 * Uses the same atomic claim pattern as mailQueueProcessor: each job is flipped
 * pending → processing in one findOneAndUpdate so concurrent ticks (or future
 * multiple instances) never double-fire a step.
 */
const processKitJobs = async () => {
  try {
    const now = new Date();

    for (let i = 0; i < BATCH_SIZE; i++) {
      const job = await KitScheduledJob.findOneAndUpdate(
        {
          status: "pending",
          runAt:  { $lte: now },
          $expr:  { $lt: ["$attempts", "$maxAttempts"] },
        },
        { $set: { status: "processing", lastAttemptAt: now } },
        { new: true, sort: { runAt: 1 } }
      );

      if (!job) break;

      try {
        const result = await runJob(job);

        if (result.status === "deferred") {
          // Campaign/enrollment paused — re-pend for a later tick.
          await KitScheduledJob.findByIdAndUpdate(job._id, {
            status: "pending",
            runAt:  result.runAt || new Date(Date.now() + 60 * 60 * 1000),
          });
        } else {
          // "done" or "skip" — both are terminal for this job.
          await KitScheduledJob.findByIdAndUpdate(job._id, {
            status: "done",
            processedAt: new Date(),
          });
        }
      } catch (err) {
        const nextAttempts = job.attempts + 1;
        const isFinal = nextAttempts >= job.maxAttempts;
        await KitScheduledJob.findByIdAndUpdate(job._id, {
          status:   isFinal ? "failed" : "pending",
          attempts: nextAttempts,
          lastError: err.message,
          ...(isFinal ? {} : { runAt: new Date(Date.now() + retryDelayMs(nextAttempts)) }),
        });
        console.error(`[KitScheduler] Job ${job._id} failed (attempt ${nextAttempts}/${job.maxAttempts}):`, err.message);
      }
    }
  } catch (err) {
    console.error("[KitScheduler] Processor error:", err.message);
  }
};

const startCampaignScheduler = () => {
  cron.schedule("* * * * *", processKitJobs);
  console.log("[KitScheduler] Campaign scheduler started — runs every minute");
};

module.exports = { startCampaignScheduler, processKitJobs };
