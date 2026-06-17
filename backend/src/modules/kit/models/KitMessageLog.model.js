const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;
const {
  ENTITY_TYPES, CHANNELS, MESSAGE_STATUSES, PROVIDER_LOG_REFS,
} = require("../constants/enums");

/**
 * KitMessageLog (kit_message_logs) — KIT-level record of one message, linking
 * the orchestration context (campaign / workflow / enrollment) to the underlying
 * delivery audit row (MailLog / WhatsAppLog / Notification).
 *
 * This is what the Communication Timeline (Phase 6) reads to show Sent →
 * Delivered → Read → Failed → Replied per entity, without having to join three
 * channel-specific collections at query time.
 */
const kitMessageLogSchema = new mongoose.Schema(
  {
    entityType: { type: String, enum: ENTITY_TYPES, required: true },
    entityId:   { type: ObjectId, required: true },

    channel: { type: String, enum: CHANNELS, required: true },
    to:      { type: String }, // denormalised recipient for quick display

    templateId:   { type: ObjectId, ref: "KitTemplate" },
    campaignId:   { type: ObjectId, ref: "KitCampaign" },
    workflowId:   { type: ObjectId, ref: "KitWorkflow" },
    enrollmentId: { type: ObjectId, ref: "KitEnrollment" },

    status: { type: String, enum: MESSAGE_STATUSES, default: "queued" },

    // Back-reference to the underlying delivery audit row.
    providerLogRef: { type: String, enum: PROVIDER_LOG_REFS },
    providerLogId:  { type: ObjectId },

    error:       { type: String },
    sentAt:      { type: Date },
    deliveredAt: { type: Date },
    readAt:      { type: Date },

    createdBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "kit_message_logs" }
);

// Timeline hot path: latest messages for an entity.
kitMessageLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
kitMessageLogSchema.index({ campaignId: 1 });
kitMessageLogSchema.index({ status: 1 });
// Analytics date-range scans (delivery / per-campaign / per-template flow metrics)
kitMessageLogSchema.index({ createdAt: 1 });
kitMessageLogSchema.index({ campaignId: 1, createdAt: 1 });
kitMessageLogSchema.index({ templateId: 1, createdAt: 1 });

module.exports = mongoose.model("KitMessageLog", kitMessageLogSchema);
