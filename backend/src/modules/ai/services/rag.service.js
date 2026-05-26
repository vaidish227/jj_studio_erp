// RAG retrieval — given a user query + caller context, return the top-k
// relevant chunks the model is allowed to see.
//
// Strategy:
//   1. Embed the query.
//   2. Run Atlas $vectorSearch with an ownerScope filter so the index does
//      RBAC at scan time (cheaper than post-filtering).
//   3. If $vectorSearch is unavailable (older Atlas tier) OR returns fewer
//      than k hits, fall back to a text search via $text on the same scoped
//      pool, then in-process re-rank by cosine similarity.
//
// Returns: [{ chunkId, documentId, score, text, title, source, sourceUrl, ownerScopeType }]

const AIDocument = require("../models/AIDocument.model");
const AIDocumentChunk = require("../models/AIDocumentChunk.model");
const { embedOne, cosine } = require("./embedding.service");

const DEFAULT_K = 5;
const VECTOR_INDEX_NAME = "ai_vector_idx";

let vectorSearchAvailable = null; // tri-state: null|true|false

function buildScopeFilter(user) {
  // Always include public. Add role + dept scoped buckets when present.
  const orClauses = [{ "metadata.ownerScopeType": "public" }];
  if (user?.role) {
    orClauses.push({ "metadata.ownerScopeType": "role", "metadata.ownerScopeValue": user.role });
  }
  if (user?.department) {
    orClauses.push({ "metadata.ownerScopeType": "dept", "metadata.ownerScopeValue": user.department });
  }
  return { $or: orClauses };
}

async function vectorSearch({ vector, user, k }) {
  // $vectorSearch.filter takes plain MongoDB Query Language (MQL) and may
  // only reference fields declared as `filter` in the index definition.
  // We use a single $or to allow public + role-scoped + dept-scoped chunks.
  const orClauses = [{ "metadata.ownerScopeType": "public" }];
  if (user?.role) {
    orClauses.push({
      "metadata.ownerScopeType": "role",
      "metadata.ownerScopeValue": user.role,
    });
  }
  if (user?.department) {
    orClauses.push({
      "metadata.ownerScopeType": "dept",
      "metadata.ownerScopeValue": user.department,
    });
  }

  const pipeline = [
    {
      $vectorSearch: {
        index: VECTOR_INDEX_NAME,
        path: "embedding",
        queryVector: vector,
        numCandidates: Math.max(100, k * 20),
        limit: k,
        filter: { $or: orClauses },
      },
    },
    {
      $project: {
        _id: 1,
        documentId: 1,
        text: 1,
        metadata: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ];

  return AIDocumentChunk.aggregate(pipeline);
}

async function keywordFallback({ query, user, k, queryVector }) {
  const scopeFilter = buildScopeFilter(user);
  // Try $text first (uses ai_chunks_text_idx)
  let docs = [];
  try {
    docs = await AIDocumentChunk.find(
      { $text: { $search: query }, ...scopeFilter },
      { score: { $meta: "textScore" }, text: 1, metadata: 1, documentId: 1, embedding: 1 }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(k * 4)
      .lean();
  } catch {
    docs = [];
  }

  // If nothing matched, broaden to "any chunk in scope" so the in-process
  // re-rank still has candidates (cheap when collection is small).
  if (docs.length === 0) {
    docs = await AIDocumentChunk.find(scopeFilter)
      .select("text metadata documentId embedding")
      .limit(k * 8)
      .lean();
  }

  // In-process cosine re-rank using the query vector
  const scored = docs
    .map((d) => ({ ...d, score: cosine(queryVector, d.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  return scored.map((d) => ({
    _id: d._id,
    documentId: d.documentId,
    text: d.text,
    metadata: d.metadata,
    score: d.score,
  }));
}

/**
 * Public API.
 *
 * @param {Object} opts
 * @param {string} opts.query     The user message (already cleaned)
 * @param {Object} opts.user      { role, department }
 * @param {number=} opts.k        top-k chunks to return (default 5)
 * @param {number=} opts.minScore drop hits below this score (default 0)
 */
async function retrieve({ query, user, k = DEFAULT_K, minScore = 0 }) {
  if (!query || !query.trim()) return [];

  let queryVector;
  try {
    queryVector = await embedOne(query);
  } catch (err) {
    console.error("[AI][rag] embedding failed:", err.message);
    return [];
  }

  let hits = [];
  if (vectorSearchAvailable !== false) {
    try {
      hits = await vectorSearch({ vector: queryVector, user, k });
      vectorSearchAvailable = true;
    } catch (err) {
      // The most common error message contains "vectorSearch" if the stage
      // isn't recognized (older Atlas tier or missing index).
      const msg = String(err.message || "");
      if (/vectorSearch|search index|\$vectorSearch|index not found/i.test(msg)) {
        vectorSearchAvailable = false;
        console.warn("[AI][rag] $vectorSearch unavailable — falling back to keyword + in-process cosine. " +
          "Create the index via backend/scripts/setup-vector-index.js.");
      } else {
        console.error("[AI][rag] vectorSearch error:", msg);
      }
    }
  }

  if (hits.length < k) {
    try {
      const fallback = await keywordFallback({ query, user, k, queryVector });
      // Merge & dedupe by chunkId
      const seen = new Set(hits.map((h) => String(h._id)));
      for (const f of fallback) {
        if (seen.has(String(f._id))) continue;
        hits.push(f);
        if (hits.length >= k) break;
      }
    } catch (err) {
      console.error("[AI][rag] keyword fallback failed:", err.message);
    }
  }

  // Filter by minScore and normalize the shape
  const filtered = hits
    .filter((h) => (h.score ?? 0) >= minScore)
    .slice(0, k)
    .map((h) => ({
      chunkId: String(h._id),
      documentId: String(h.documentId),
      score: Number(h.score?.toFixed?.(4) ?? h.score ?? 0),
      text: String(h.text || ""),
      title: h.metadata?.title || "",
      source: h.metadata?.source || "",
      sourceType: h.metadata?.sourceType || "other",
      sourceUrl: h.metadata?.sourceUrl || null,
      section: h.metadata?.section || null,
      ownerScopeType: h.metadata?.ownerScopeType || "public",
    }));

  return filtered;
}

function _forceVectorSearchState(state) {
  vectorSearchAvailable = state;
}

module.exports = { retrieve, _forceVectorSearchState };
