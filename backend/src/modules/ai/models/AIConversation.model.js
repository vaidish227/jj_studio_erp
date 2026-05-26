const mongoose = require("mongoose");

const aiConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      default: "New conversation",
      trim: true,
      maxlength: 200,
    },

    startedAt:     { type: Date, default: Date.now },
    lastMessageAt: { type: Date, default: Date.now },
    messageCount:  { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["active", "archived", "deleted"],
      default: "active",
      index: true,
    },

    totalTokens:  { type: Number, default: 0 },
    totalCostUsd: { type: Number, default: 0 },

    // Optional summary used in V2 long-term memory injection
    summary: { type: String, default: "" },
  },
  { timestamps: true, collection: "ai_conversations" }
);

aiConversationSchema.index({ userId: 1, lastMessageAt: -1 });
aiConversationSchema.index({ userId: 1, status: 1, lastMessageAt: -1 });

module.exports = mongoose.model("AIConversation", aiConversationSchema, "ai_conversations");
