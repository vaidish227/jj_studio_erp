const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const whatsappLogSchema = new mongoose.Schema(
  {
    templateId: { type: ObjectId, ref: "WhatsAppTemplate" },
    to:         { type: String, required: true },
    message:    { type: String, required: true },
    mediaUrl:   { type: String },
    mediaType:  { type: String },
    status: {
      type: String,
      enum: ["sent", "delivered", "read", "failed"],
      default: "sent",
    },
    provider:      { type: String, default: "maytapi" },
    messageId:     { type: String },
    failureReason: { type: String },
    retryCount:    { type: Number, default: 0 },
    lastAttemptAt: { type: Date },
    sentAt:        { type: Date },
    relatedTo: {
      module:   { type: String, enum: ["crm", "proposal", "pms", "kit", "manual", "system"] },
      recordId: { type: ObjectId },
    },
    createdBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true }
);

whatsappLogSchema.index({ status: 1 });
whatsappLogSchema.index({ to: 1 });
whatsappLogSchema.index({ "relatedTo.recordId": 1 });
whatsappLogSchema.index({ createdAt: -1 });
// KIT analytics: module-attributed delivery counts within a date range
whatsappLogSchema.index({ "relatedTo.module": 1, createdAt: 1 });

module.exports = mongoose.model("WhatsAppLog", whatsappLogSchema);
