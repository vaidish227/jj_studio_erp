// Atlas Vector Search index probe. Reports whether the `ai_vector_idx` index
// exists and is queryable. Used by /ai/health for admin self-diagnostics and
// by the startup banner so missing-setup is loud rather than silent.

const AIDocumentChunk = require("../models/AIDocumentChunk.model");

const INDEX_NAME = "ai_vector_idx";

/**
 * Returns one of:
 *   { status: 'ready',     name, latencyMs, chunkCount }
 *   { status: 'building',  name, latencyMs, chunkCount }
 *   { status: 'missing',   message, chunkCount }
 *   { status: 'unsupported', message, chunkCount }   // older Atlas tier
 *   { status: 'unknown',   error, chunkCount }
 */
async function probe() {
  const start = Date.now();
  let chunkCount = 0;
  try {
    chunkCount = await AIDocumentChunk.estimatedDocumentCount();
  } catch (_e) { /* non-fatal */ }

  const coll = AIDocumentChunk.collection;
  let indexes;
  try {
    indexes = await coll.listSearchIndexes().toArray();
  } catch (err) {
    const msg = String(err.message || "");
    if (/Unrecognized pipeline stage|listSearchIndexes/i.test(msg)) {
      return {
        status: "unsupported",
        message: "Atlas tier does not support search indexes (M0/M2/M5). Upgrade to M10+.",
        chunkCount,
        latencyMs: Date.now() - start,
      };
    }
    return { status: "unknown", error: msg, chunkCount, latencyMs: Date.now() - start };
  }

  const found = indexes.find((i) => i.name === INDEX_NAME);
  if (!found) {
    return {
      status: "missing",
      message: `Index '${INDEX_NAME}' not found. Run: node backend/scripts/setup-vector-index.js`,
      chunkCount,
      latencyMs: Date.now() - start,
    };
  }
  const ready = String(found.status || "").toUpperCase() === "READY";
  return {
    status: ready ? "ready" : "building",
    name: found.name,
    indexStatus: found.status,
    chunkCount,
    latencyMs: Date.now() - start,
  };
}

async function logStartupBanner() {
  try {
    const res = await probe();
    if (res.status === "ready") {
      console.log(`[AI][vector] index '${res.name}' READY — ${res.chunkCount} chunks indexed`);
    } else if (res.status === "building") {
      console.log(`[AI][vector] index building — ${res.chunkCount} chunks. Status: ${res.indexStatus}`);
    } else if (res.status === "missing") {
      console.warn(`[AI][vector] ⚠  ${res.message}`);
    } else if (res.status === "unsupported") {
      console.warn(`[AI][vector] ⚠  ${res.message}  RAG will use keyword + in-process cosine fallback.`);
    } else {
      console.warn(`[AI][vector] ⚠  unknown state: ${res.error}`);
    }
  } catch (err) {
    console.warn("[AI][vector] probe failed:", err.message);
  }
}

module.exports = { probe, logStartupBanner, INDEX_NAME };
