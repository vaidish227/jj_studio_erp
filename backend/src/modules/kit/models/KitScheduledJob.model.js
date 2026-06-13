const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;
const { JOB_STATUSES } = require("../constants/enums");

/**
 * KitScheduledJob (kit_scheduled_jobs) — the campaign-tick queue.
 *
 * Analogous to MailQueue/WhatsAppQueue but at the orchestration layer: each job
 * represents "do this KIT action at runAt" (e.g. fire campaign step N for an
 * enrollment, or run a workflow action). The Phase-3 campaignScheduler cron
 * claims due jobs atomically via findOneAndUpdate({status:"pending", runAt:$lte})
 * — the same safe-claim pattern the mail processor uses — then dispatches.
 *
 * The actual send is delegated to the existing mail/whatsapp queue services, so
 * this queue schedules *orchestration*, not raw delivery.
 */
const kitScheduledJobSchema = new mongoose.Schema(
  {
    enrollmentId: { type: ObjectId, ref: "KitEnrollment" },
    workflowId:   { type: ObjectId, ref: "KitWorkflow" },

    runAt:  { type: Date, required: true },
    status: { type: String, enum: JOB_STATUSES, default: "pending" },

    // What to do when the job fires — e.g. { type: "campaign_step", stepIndex: 2 }
    action: { type: mongoose.Schema.Types.Mixed, default: {} },

    attempts:    { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    lastError:   { type: String },
    processedAt: { type: Date },
  },
  { timestamps: true, collection: "kit_scheduled_jobs" }
);

// Claim hot path — mirrors the mail/whatsapp queue processor query.
kitScheduledJobSchema.index({ status: 1, runAt: 1 });
kitScheduledJobSchema.index({ enrollmentId: 1 });

module.exports = mongoose.model("KitScheduledJob", kitScheduledJobSchema);
