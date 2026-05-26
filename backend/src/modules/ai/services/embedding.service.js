// Embedding helper. Batches embed requests to keep OpenAI calls under the
// per-request limits and to amortize round-trip cost.
//
// `text-embedding-3-small` supports up to ~8191 input tokens per item and
// 2048 items per batch. We stay well below both.

const aiConfig = require("../config/aiConfig");
const openai = require("./openai.service");
const { count: countTokens } = require("../utils/tokenizer");

const MAX_BATCH_ITEMS = 96;     // Keep batches small to bound retry blast radius.
const MAX_INPUT_TOKENS = 7000;  // Single-item ceiling — chunker should already be smaller.

/**
 * Embed an array of strings. Returns an array of float vectors aligned with input.
 * Throws if OpenAI is not configured.
 */
async function embedBatch(texts) {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  // Truncate any oversized inputs defensively (chunker should prevent this).
  const safe = texts.map((t) => {
    const s = String(t || "");
    if (countTokens(s) <= MAX_INPUT_TOKENS) return s;
    // Coarse truncation by chars proportional to token estimate.
    return s.slice(0, MAX_INPUT_TOKENS * 4);
  });

  const out = new Array(safe.length);
  for (let i = 0; i < safe.length; i += MAX_BATCH_ITEMS) {
    const batch = safe.slice(i, i + MAX_BATCH_ITEMS);
    const vectors = await openai.embed(batch, aiConfig.models.embedding);
    for (let j = 0; j < vectors.length; j++) {
      out[i + j] = vectors[j];
    }
  }
  return out;
}

async function embedOne(text) {
  const [v] = await embedBatch([text]);
  return v;
}

/** Cosine similarity between two same-length vectors. Used by the in-process
 *  fallback path in rag.service when $vectorSearch is unavailable. */
function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

module.exports = { embedBatch, embedOne, cosine };
