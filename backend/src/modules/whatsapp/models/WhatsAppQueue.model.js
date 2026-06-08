const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const whatsappQueueSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["immediate", "scheduled"],
      default: "immediate",
    },
    status: {
      type: String,
      enum: ["pending", "processing", "sent", "failed", "cancelled"],
      default: "pending",
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    scheduledFor: { type: Date, default: Date.now },

    to:        { type: String, required: true },
    message:   { type: String },
    mediaUrl:  { type: String },
    mediaType: {
      type: String,
      enum: ["none", "image", "document", "video"],
      default: "none",
    },

    templateId:        { type: ObjectId, ref: "WhatsAppTemplate" },
    templateVariables: { type: mongoose.Schema.Types.Mixed },

    retryCount:    { type: Number, default: 0 },
    maxRetries:    { type: Number, default: 3 },
    lastError:     { type: String },
    lastAttemptAt: { type: Date },
    processedAt:   { type: Date },

    relatedTo: {
      module:   { type: String, enum: ["crm", "proposal", "pms", "kit", "manual", "system"] },
      recordId: { type: ObjectId },
    },
    createdBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true }
);

whatsappQueueSchema.index({ status: 1, scheduledFor: 1 });
whatsappQueueSchema.index({ priority: -1, scheduledFor: 1 });
whatsappQueueSchema.index({ to: 1 });

module.exports = mongoose.model("WhatsAppQueue", whatsappQueueSchema);
