const mongoose = require("mongoose");

/**
 * AIDocumentChunk — a single embeddable slice of an AIDocument.
 *
 * The `embedding` field is the 1536-dim vector produced by
 * `text-embedding-3-small`. Atlas $vectorSearch is configured against this
 * field via a Search Index named `ai_vector_idx` — see
 * backend/scripts/setup-vector-index.js for the index definition.
 *
 * metadata.ownerScope mirrors the parent document so the vector index can
 * filter directly without a $lookup join (cheaper at query time).
 */
const aiDocumentChunkSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AIDocument",
      required: true,
      index: true,
    },

    chunkIndex: { type: Number, required: true },

    text: { type: String, required: true },
    tokens: { type: Number, default: 0 },

    // 1536-dim cosine-normalized vector. Mongoose stores this as Number[].
    embedding: { type: [Number], default: [] },

    metadata: {
      title: { type: String, default: "" },
      source: { type: String, default: "" },
      sourceType: { type: String, default: "other" },
      sourceUrl: { type: String, default: null },
      ownerScopeType: { type: String, default: "public" },
      ownerScopeValue: { type: String, default: null },
      // Position hints
      section: { type: String, default: null },
      char_start: { type: Number, default: null },
      char_end: { type: Number, default: null },
    },
  },
  { timestamps: true, collection: "ai_document_chunks" }
);

aiDocumentChunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true });
aiDocumentChunkSchema.index({ "metadata.ownerScopeType": 1, "metadata.ownerScopeValue": 1 });

// Text index for the keyword-search fallback path in rag.service.
aiDocumentChunkSchema.index(
  { text: "text", "metadata.title": "text" },
  { name: "ai_chunks_text_idx", default_language: "english" }
);

module.exports = mongoose.model("AIDocumentChunk", aiDocumentChunkSchema, "ai_document_chunks");
