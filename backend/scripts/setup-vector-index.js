/**
 * Create (or verify) the Atlas Search Vector index used by rag.service.
 *
 * Requires Atlas M10+ tier. Idempotent: safe to re-run; will report
 * "already exists" without altering an existing index. Use the Atlas UI for
 * destructive changes (drop + recreate).
 *
 * Usage:
 *   node backend/scripts/setup-vector-index.js
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mongoose = require("mongoose");
const { connectDb } = require("../src/config/db");
const AIDocumentChunk = require("../src/modules/ai/models/AIDocumentChunk.model");

const INDEX_NAME = "ai_vector_idx";

const VECTOR_INDEX_DEFINITION = {
  name: INDEX_NAME,
  type: "vectorSearch",
  definition: {
    fields: [
      {
        type: "vector",
        path: "embedding",
        numDimensions: 1536,
        similarity: "cosine",
      },
      { type: "filter", path: "metadata.ownerScopeType" },
      { type: "filter", path: "metadata.ownerScopeValue" },
      { type: "filter", path: "documentId" },
    ],
  },
};

async function main() {
  await connectDb();
  const coll = AIDocumentChunk.collection;

  // Mongoose ≥ 7 / driver ≥ 6 expose searchIndexes via the collection handle.
  let existing = [];
  try {
    existing = await coll.listSearchIndexes().toArray();
  } catch (err) {
    console.error("listSearchIndexes failed. This usually means:");
    console.error("  - Your cluster is M0/M2/M5 (no search indexes) — upgrade to M10+");
    console.error("  - Your MongoDB driver/Mongoose is older than required");
    console.error("Raw error:", err.message);
    process.exit(2);
  }

  const found = existing.find((idx) => idx.name === INDEX_NAME);
  if (found) {
    console.log(`[vector-index] '${INDEX_NAME}' already exists — status: ${found.status}`);
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`[vector-index] creating '${INDEX_NAME}' ...`);
  try {
    await coll.createSearchIndex(VECTOR_INDEX_DEFINITION);
    console.log(`[vector-index] requested. Atlas will build the index in the background.`);
    console.log(`[vector-index] Poll status with: db.ai_document_chunks.aggregate([{$listSearchIndexes:{}}])`);
  } catch (err) {
    console.error("[vector-index] createSearchIndex failed:", err.message);
    process.exit(3);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[vector-index] fatal:", err);
  process.exit(1);
});
