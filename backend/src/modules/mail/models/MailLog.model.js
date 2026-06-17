const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const mailLogSchema = new mongoose.Schema(
  {
    templateId: { type: ObjectId, ref: "MailTemplate" },
    to:  [{ type: String }],
    cc:  [{ type: String }],
    bcc: [{ type: String }],
    subject:  { type: String, required: true },
    htmlBody: { type: String },
    textBody: { type: String },
    status: {
      type: String,
      enum: ["sent", "failed", "bounced"],
      default: "sent",
    },
    provider:       { type: String, default: "gmail" },
    messageId:      { type: String },
    failureReason:  { type: String },
    retryCount:     { type: Number, default: 0 },
    lastAttemptAt:  { type: Date },
    sentAt:         { type: Date },
    relatedTo: {
      module:   { type: String, enum: ["crm", "proposal", "pms", "kit", "manual", "system"] },
      recordId: { type: ObjectId },
    },
    createdBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true }
);

mailLogSchema.index({ status: 1 });
mailLogSchema.index({ "relatedTo.recordId": 1 });
mailLogSchema.index({ createdAt: -1 });
mailLogSchema.index({ to: 1 });
// KIT analytics: module-attributed delivery counts within a date range
mailLogSchema.index({ "relatedTo.module": 1, createdAt: 1 });

module.exports = mongoose.model("MailLog", mailLogSchema);
