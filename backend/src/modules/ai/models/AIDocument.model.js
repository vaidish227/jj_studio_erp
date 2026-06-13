const mongoose = require("mongoose");

/**
 * AIDocument — the header for a piece of indexed knowledge.
 * Each document is chunked into AIDocumentChunk rows with embeddings.
 *
 * ownerScope controls who can retrieve this content:
 *   { type: 'public' }              → visible to anyone with ai.chat
 *   { type: 'role', value: 'admin' } → visible to that role only
 *   { type: 'dept', value: 'Design' } → visible to that department only
 *
 * sourceType is informational — drives how citation tooltips render.
 */
const aiDocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
      index: true,
    },

    // Free-form attribution string — e.g. "SOP / Design", "Policy / HR"
    source: { type: String, default: "", trim: true },

    sourceType: {
      type: String,
      enum: ["sop", "policy", "manual", "faq", "note", "other"],
      default: "other",
    },

    ownerScope: {
      type: {
        type: String,
        enum: ["public", "role", "dept"],
        default: "public",
        required: true,
      },
      value: { type: String, default: null },
    },

    // The original body the document was chunked from. Stored once for
    // re-indexing without going back to the source file.
    body: { type: String, default: "" },

    chunkCount: { type: Number, default: 0 },

    // Stable hash of (title + body) used by the ingestor for idempotency.
    contentHash: { type: String, default: null, index: true },

    // Optional external URL the UI can deep-link into.
    sourceUrl: { type: String, default: null },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "indexing", "failed", "archived"],
      default: "active",
      index: true,
    },

    lastIndexedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "ai_documents" }
);

aiDocumentSchema.index({ "ownerScope.type": 1, "ownerScope.value": 1, status: 1 });

module.exports = mongoose.model("AIDocument", aiDocumentSchema, "ai_documents");
