const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;
const { ENTITY_TYPES, ENROLLMENT_STATUSES } = require("../constants/enums");

/**
 * KitEnrollment (kit_enrollments) — one entity's run through one campaign.
 *
 * The engine advances `currentStepIndex` and sets `nextFireAt` to the moment the
 * next step is due; a KitScheduledJob is created to fire it.
 *
 * Idempotency: a partial unique index guarantees at most one ACTIVE enrollment
 * per (campaign, entity) — so re-triggering a campaign for an entity that is
 * already enrolled is a no-op rather than a duplicate journey. Completed/stopped
 * enrollments are excluded from the constraint so the entity can be re-enrolled
 * later.
 */
const kitEnrollmentSchema = new mongoose.Schema(
  {
    campaignId: { type: ObjectId, ref: "KitCampaign", required: true },
    entityType: { type: String, enum: ENTITY_TYPES, required: true },
    entityId:   { type: ObjectId, required: true },

    status:           { type: String, enum: ENROLLMENT_STATUSES, default: "active" },
    currentStepIndex: { type: Number, default: 0 },
    nextFireAt:       { type: Date },

    enrolledBy:  { type: ObjectId, ref: "User" },
    startedAt:   { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true, collection: "kit_enrollments" }
);

// Idempotency guard — only one active enrollment per (campaign, entity).
kitEnrollmentSchema.index(
  { campaignId: 1, entityType: 1, entityId: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);

// Scheduler scan: find active enrollments whose next step is due.
kitEnrollmentSchema.index({ status: 1, nextFireAt: 1 });
// Timeline / lookups by target entity.
kitEnrollmentSchema.index({ entityType: 1, entityId: 1 });
// Analytics funnel — enrolment cohort by createdAt (date-range)
kitEnrollmentSchema.index({ createdAt: 1 });

module.exports = mongoose.model("KitEnrollment", kitEnrollmentSchema);
