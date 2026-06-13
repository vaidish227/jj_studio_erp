const mongoose = require("mongoose");

const aiMetricSchema = new mongoose.Schema(
  {
    requestId: { type: String, index: true },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AIConversation",
    },

    model:            { type: String },
    promptTokens:     { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    costUsd:          { type: Number, default: 0 },

    latencyMs: { type: Number, default: 0 },
    toolCount: { type: Number, default: 0 },

    errorCode: { type: String, default: null },
  },
  { timestamps: true, collection: "ai_metrics" }
);

aiMetricSchema.index({ createdAt: -1 });
aiMetricSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("AIMetric", aiMetricSchema, "ai_metrics");
