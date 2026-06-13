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
      enum: [
        "ok", "denied", "error", "invalid_args", "timeout", "not_found",
        // V3 write-tool lifecycle states
        "pending_confirmation",  // dryRun returned a proposal awaiting user confirm
        "cancelled",             // user clicked Cancel (or the proposal expired)
        "confirmed_ok",          // user clicked Confirm + apply succeeded
        "confirmed_error",       // user clicked Confirm but apply failed
      ],
      required: true,
    },
    errorCode: { type: String, default: null },

    latencyMs: { type: Number, default: 0 },
    permissionCheckPassed: { type: Boolean, default: false },

    // V3 write-tool fields (null for read-only tools)
    isWrite: { type: Boolean, default: false },
    proposalDescription: { type: String, default: null },     // human-readable, shown in the Confirm card
    confirmedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    // Pending proposals auto-expire after a few minutes — TTL index below.
    pendingExpiresAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "ai_tool_calls" }
);

aiToolCallSchema.index({ userId: 1, createdAt: -1 });
aiToolCallSchema.index({ toolName: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("AIToolCall", aiToolCallSchema, "ai_tool_calls");
