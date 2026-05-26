const mongoose = require("mongoose");

const aiToolCallSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AIConversation",
      index: true,
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AIMessage",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    toolName: { type: String, required: true },
    args:     { type: mongoose.Schema.Types.Mixed, default: {} },

    // Preview only — capped to ~2000 chars to keep this collection compact.
    // Full data is stored in AIMessage.uiPayload for UI rendering.
    resultPreview: { type: String, default: "" },

    status: {
      type: String,
      enum: ["ok", "denied", "error", "invalid_args", "timeout", "not_found"],
      required: true,
    },
    errorCode: { type: String, default: null },

    latencyMs: { type: Number, default: 0 },
    permissionCheckPassed: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "ai_tool_calls" }
);

aiToolCallSchema.index({ userId: 1, createdAt: -1 });
aiToolCallSchema.index({ toolName: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("AIToolCall", aiToolCallSchema, "ai_tool_calls");
