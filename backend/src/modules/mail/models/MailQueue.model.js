const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const mailQueueSchema = new mongoose.Schema(
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

    to:  [{ type: String, required: true }],
    cc:  [{ type: String }],
    bcc: [{ type: String }],
    subject:  { type: String, required: true },
    htmlBody: { type: String },
    textBody: { type: String },

    templateId:        { type: ObjectId, ref: "MailTemplate" },
    templateVariables: { type: mongoose.Schema.Types.Mixed },

    retryCount:    { type: Number, default: 0 },
    maxRetries:    { type: Number, default: 3 },
    lastError:     { type: String },
    lastAttemptAt: { type: Date },
    processedAt:   { type: Date },

    relatedTo: {
      module:   { type: String, enum: ["crm", "proposal", "pms", "manual", "system"] },
      recordId: { type: ObjectId },
    },
    createdBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Compound index for queue processor query
mailQueueSchema.index({ status: 1, scheduledFor: 1 });
mailQueueSchema.index({ priority: -1, scheduledFor: 1 });
mailQueueSchema.index({ "relatedTo.recordId": 1 });

module.exports = mongoose.model("MailQueue", mailQueueSchema);
