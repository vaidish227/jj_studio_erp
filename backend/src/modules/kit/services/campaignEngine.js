/**
 * campaignEngine — drives entities through campaign journeys.
 *
 *   enroll()      — idempotently start entities on a campaign + schedule step 0
 *   executeJob()  — run one due scheduled step: dispatch, then schedule the next
 *
 * Step timing is ABSOLUTE from enrollment start (the "Day 2 / Day 4 / Day 6"
 * model): step N fires at enrollment.startedAt + step.delay. The scheduler
 * (cron/campaignScheduler.js) claims due KitScheduledJobs and calls executeJob().
 *
 * Note: step-level conditions are evaluated in Phase 4 (conditionEvaluator).
 * Here every scheduled step dispatches unconditionally.
 */
const KitCampaign     = require("../models/KitCampaign.model");
const KitCampaignStep = require("../models/KitCampaignStep.model");
const KitEnrollment   = require("../models/KitEnrollment.model");
const KitScheduledJob = require("../models/KitScheduledJob.model");
const dispatchService = require("./dispatchService");

const UNIT_MS = { minutes: 60 * 1000, hours: 60 * 60 * 1000, days: 24 * 60 * 60 * 1000 };

/** computeFireAt — absolute fire time for a step relative to enrollment start. */
const computeFireAt = (startedAt, delay = {}) => {
  const value = Number(delay.value) || 0;
  const unit  = UNIT_MS[delay.unit] || UNIT_MS.days;
  return new Date(new Date(startedAt).getTime() + value * unit);
};

const loadSteps = (campaignId) =>
  KitCampaignStep.find({ campaignId }).sort({ order: 1 }).lean();

/**
 * enroll — start each entity on the campaign (idempotent).
 * Returns { enrolled: [], skipped: [], completed: [] } (arrays of entityId).
 */
const enroll = async ({ campaignId, entityType, entityIds, enrolledBy }) => {
  const campaign = await KitCampaign.findById(campaignId).lean();
  if (!campaign) throw new Error("Campaign not found");

  const steps = await loadSteps(campaignId);
  const out = { enrolled: [], skipped: [], completed: [] };

  for (const entityId of entityIds) {
    // Idempotency: one active enrollment per (campaign, entity). The partial
    // unique index is the hard backstop; this check avoids the error path.
    const existing = await KitEnrollment.findOne({
      campaignId, entityType, entityId, status: "active",
    }).lean();
    if (existing) { out.skipped.push(String(entityId)); continue; }

    const startedAt = new Date();

    // Empty campaign → nothing to send; record a completed enrollment.
    if (!steps.length) {
      await KitEnrollment.create({
        campaignId, entityType, entityId, enrolledBy,
        status: "completed", currentStepIndex: 0, startedAt, completedAt: startedAt,
      });
      out.completed.push(String(entityId));
      continue;
    }

    const nextFireAt = computeFireAt(startedAt, steps[0].delay);
    let enrollment;
    try {
      enrollment = await KitEnrollment.create({
        campaignId, entityType, entityId, enrolledBy,
        status: "active", currentStepIndex: 0, startedAt, nextFireAt,
      });
    } catch (err) {
      // Duplicate-key race → already enrolled; treat as skipped.
      if (err && err.code === 11000) { out.skipped.push(String(entityId)); continue; }
      throw err;
    }

    await KitScheduledJob.create({
      enrollmentId: enrollment._id,
      runAt: nextFireAt,
      status: "pending",
      action: { type: "campaign_step", stepIndex: 0 },
    });
    out.enrolled.push(String(entityId));
  }

  return out;
};

/**
 * executeJob — run one claimed scheduled-step job. Pure of job bookkeeping:
 * returns an outcome the scheduler applies to the job row.
 *
 *   { status: "done" }                       — step dispatched (or nothing to do)
 *   { status: "deferred", runAt: Date }       — campaign/enrollment paused; retry later
 *   { status: "skip" }                        — enrollment gone/stopped/completed
 */
const executeJob = async (job) => {
  const action = job.action || {};
  if (action.type !== "campaign_step") return { status: "skip" };

  const enrollment = await KitEnrollment.findById(job.enrollmentId);
  if (!enrollment) return { status: "skip" };
  if (enrollment.status === "stopped" || enrollment.status === "completed") return { status: "skip" };
  // Paused enrollment → hold and retry in an hour.
  if (enrollment.status === "paused") return { status: "deferred", runAt: new Date(Date.now() + 60 * 60 * 1000) };

  const campaign = await KitCampaign.findById(enrollment.campaignId).lean();
  if (!campaign) return { status: "skip" };
  // Paused/archived campaign → hold the journey until reactivated.
  if (campaign.status !== "active") return { status: "deferred", runAt: new Date(Date.now() + 60 * 60 * 1000) };

  const steps = await loadSteps(enrollment.campaignId);
  const step  = steps[action.stepIndex];

  // Step removed (campaign edited) → just advance past it.
  if (step) {
    await dispatchService.dispatch({
      entityType:   enrollment.entityType,
      entityId:     enrollment.entityId,
      channel:      step.channel,
      templateId:   step.templateId,
      campaignId:   enrollment.campaignId,
      enrollmentId: enrollment._id,
      createdBy:    enrollment.enrolledBy,
    });
  }

  // Advance to the next step (or complete).
  const nextIndex = action.stepIndex + 1;
  if (nextIndex < steps.length) {
    const nextFireAt = computeFireAt(enrollment.startedAt, steps[nextIndex].delay);
    enrollment.currentStepIndex = nextIndex;
    enrollment.nextFireAt = nextFireAt;
    await enrollment.save();
    await KitScheduledJob.create({
      enrollmentId: enrollment._id,
      runAt: nextFireAt,
      status: "pending",
      action: { type: "campaign_step", stepIndex: nextIndex },
    });
  } else {
    enrollment.currentStepIndex = nextIndex;
    enrollment.status = "completed";
    enrollment.completedAt = new Date();
    enrollment.nextFireAt = undefined;
    await enrollment.save();
  }

  return { status: "done" };
};

module.exports = { enroll, executeJob, computeFireAt };
