const mongoose = require("mongoose");

/**
 * AIUserFact — long-term, per-user "what the assistant should remember"
 * facts. Populated by:
 *   1. Nightly summarizer cron (`source: 'summarized'`) — distils patterns
 *      from recent conversations.
 *   2. Explicit user notes via /api/ai/user-facts (`source: 'explicit'`).
 *
 * Facts are injected into the system prompt under "Known user facts" up to
 * a small token budget. expiresAt allows soft-decay of stale facts.
 */
const aiUserFactSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    fact: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    source: {
      type: String,
      enum: ["summarized", "explicit"],
      default: "summarized",
    },

    sourceConversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AIConversation",
      default: null,
    },

    confidence: { type: Number, default: 0.7, min: 0, max: 1 },

    // Soft-decay knob. Null = never expires.
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "ai_user_facts" }
);

aiUserFactSchema.index({ userId: 1, createdAt: -1 });
aiUserFactSchema.index({ userId: 1, fact: 1 }, { unique: true });
aiUserFactSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL

module.exports = mongoose.model("AIUserFact", aiUserFactSchema, "ai_user_facts");
