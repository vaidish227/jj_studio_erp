// Document ingestion — takes a {title, body, ownerScope, source, sourceType}
// payload, chunks the body, embeds each chunk, and persists everything as
// AIDocument + AIDocumentChunk rows. Idempotent by (title + body) content hash:
// re-ingesting an unchanged doc is a no-op.

const crypto = require("crypto");
const mongoose = require("mongoose");

const AIDocument = require("../models/AIDocument.model");
const AIDocumentChunk = require("../models/AIDocumentChunk.model");
const { embedBatch } = require("./embedding.service");
const { count: countTokens } = require("../utils/tokenizer");

const CHUNK_TARGET_TOKENS = 500;
const CHUNK_OVERLAP_TOKENS = 60;
const MIN_CHUNK_TOKENS = 40;

/**
 * Markdown-aware chunker:
 *   1. First splits on top-level headings (#, ##, ###) so each section starts a chunk.
 *   2. Within each section, packs sentences/paragraphs until the target size.
 *   3. Adds a small overlap between adjacent chunks within the same section.
 *
 * Returns: [{ text, tokens, section, char_start, char_end }]
 */
function chunkText(body) {
  const text = String(body || "").trim();
  if (!text) return [];

  // Split on headings while keeping the heading line with its content.
  // We capture the heading text as a section label.
  const sections = [];
  const headingRe = /^(#{1,6})\s+(.+)$/gm;
  let lastIdx = 0;
  let lastHeading = null;
  let m;
  while ((m = headingRe.exec(text)) !== null) {
    if (m.index > lastIdx) {
      sections.push({ heading: lastHeading, body: text.slice(lastIdx, m.index), start: lastIdx });
    }
    lastHeading = m[2].trim();
    lastIdx = m.index;
  }
  sections.push({ heading: lastHeading, body: text.slice(lastIdx), start: lastIdx });

  const chunks = [];
  for (const sec of sections) {
    const sectionChunks = packSection(sec.body, sec.heading, sec.start);
    chunks.push(...sectionChunks);
  }

  // Drop tiny tail chunks if any
  return chunks.filter((c) => c.tokens >= MIN_CHUNK_TOKENS || chunks.length === 1);
}

function packSection(body, heading, charOffset) {
  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return [];

  const chunks = [];
  let cur = "";
  let curTokens = 0;
  let curStart = charOffset;
  let pos = charOffset;

  const flush = () => {
    if (!cur) return;
    chunks.push({
      text: cur.trim(),
      tokens: curTokens,
      section: heading || null,
      char_start: curStart,
      char_end: pos,
    });
    // Carry overlap from the end of cur into the next chunk
    const overlap = takeTrailingTokens(cur, CHUNK_OVERLAP_TOKENS);
    cur = overlap;
    curTokens = countTokens(overlap);
    curStart = pos;
  };

  for (const para of paragraphs) {
    const paraTokens = countTokens(para);

    // Paragraph alone exceeds target — split it further by sentences.
    if (paraTokens > CHUNK_TARGET_TOKENS) {
      const sentences = para.split(/(?<=[.!?])\s+/);
      for (const sent of sentences) {
        const sentTokens = countTokens(sent);
        if (curTokens + sentTokens > CHUNK_TARGET_TOKENS && curTokens > 0) {
          flush();
        }
        cur += (cur ? " " : "") + sent;
        curTokens += sentTokens;
        pos += sent.length + 1;
      }
      continue;
    }

    if (curTokens + paraTokens > CHUNK_TARGET_TOKENS && curTokens > 0) {
      flush();
    }
    cur += (cur ? "\n\n" : "") + para;
    curTokens += paraTokens;
    pos += para.length + 2;
  }

  if (cur.trim()) {
    chunks.push({
      text: cur.trim(),
      tokens: curTokens,
      section: heading || null,
      char_start: curStart,
      char_end: pos,
    });
  }
  return chunks;
}

function takeTrailingTokens(text, tokens) {
  // Approximate by char count (4 chars/token) — chunker is best-effort overlap.
  if (!text || tokens <= 0) return "";
  const charCount = tokens * 4;
  return text.length <= charCount ? "" : text.slice(-charCount);
}

function hashContent({ title, body }) {
  return crypto.createHash("sha256").update(`${title}\n${body}`, "utf8").digest("hex");
}

/**
 * Ingest a document. If a doc with the same title + content hash already
 * exists, returns it untouched.
 *
 * @param {Object}   doc
 * @param {string}   doc.title
 * @param {string}   doc.body
 * @param {Object=}  doc.ownerScope          { type, value? } — default public
 * @param {string=}  doc.source              free-form attribution
 * @param {string=}  doc.sourceType
 * @param {string=}  doc.sourceUrl
 * @param {ObjectId=} doc.createdBy
 * @returns {Promise<{document, chunkCount, skipped}>}
 */
async function ingestDocument(doc) {
  const {
    title, body,
    ownerScope = { type: "public", value: null },
    source = "",
    sourceType = "other",
    sourceUrl = null,
    createdBy = null,
  } = doc || {};

  if (!title || !body) {
    throw new Error("ingestDocument: title and body required");
  }

  const contentHash = hashContent({ title, body });

  // Idempotency: same title + content already indexed
  const existing = await AIDocument.findOne({ title, contentHash, status: { $ne: "archived" } });
  if (existing) {
    return { document: existing.toObject(), chunkCount: existing.chunkCount, skipped: true };
  }

  // If a doc with same title exists but content differs, supersede it.
  await AIDocument.updateMany({ title, status: "active" }, { $set: { status: "archived" } });
  await AIDocumentChunk.deleteMany({
    documentId: { $in: await AIDocument.find({ title, status: "archived" }).distinct("_id") },
  }).catch(() => null); // best-effort cleanup

  const chunks = chunkText(body);
  if (chunks.length === 0) {
    throw new Error("ingestDocument: body produced no chunks");
  }

  const document = await AIDocument.create({
    title, body, source, sourceType, sourceUrl,
    ownerScope: {
      type: ownerScope.type || "public",
      value: ownerScope.value || null,
    },
    chunkCount: 0,
    contentHash,
    createdBy,
    status: "indexing",
  });

  let embeddings;
  try {
    embeddings = await embedBatch(chunks.map((c) => c.text));
  } catch (err) {
    document.status = "failed";
    await document.save();
    throw err;
  }

  const chunkDocs = chunks.map((c, i) => ({
    documentId: document._id,
    chunkIndex: i,
    text: c.text,
    tokens: c.tokens,
    embedding: embeddings[i],
    metadata: {
      title,
      source,
      sourceType,
      sourceUrl,
      ownerScopeType: ownerScope.type || "public",
      ownerScopeValue: ownerScope.value || null,
      section: c.section,
      char_start: c.char_start,
      char_end: c.char_end,
    },
  }));

  await AIDocumentChunk.insertMany(chunkDocs, { ordered: false });

  document.status = "active";
  document.chunkCount = chunks.length;
  document.lastIndexedAt = new Date();
  await document.save();

  return { document: document.toObject(), chunkCount: chunks.length, skipped: false };
}

/**
 * Re-embed all chunks for a document without re-chunking. Use when changing
 * the embedding model.
 */
async function reembedDocument(documentId) {
  const id = mongoose.isValidObjectId(documentId) ? documentId : null;
  if (!id) throw new Error("reembedDocument: invalid id");
  const chunks = await AIDocumentChunk.find({ documentId: id }).select("_id text").lean();
  if (chunks.length === 0) return { updated: 0 };

  const vectors = await embedBatch(chunks.map((c) => c.text));
  let updated = 0;
  for (let i = 0; i < chunks.length; i++) {
    await AIDocumentChunk.updateOne({ _id: chunks[i]._id }, { $set: { embedding: vectors[i] } });
    updated++;
  }
  await AIDocument.updateOne({ _id: id }, { $set: { lastIndexedAt: new Date() } });
  return { updated };
}

async function deleteDocument(documentId) {
  const id = mongoose.isValidObjectId(documentId) ? documentId : null;
  if (!id) throw new Error("deleteDocument: invalid id");
  await AIDocumentChunk.deleteMany({ documentId: id });
  await AIDocument.deleteOne({ _id: id });
}

module.exports = { ingestDocument, reembedDocument, deleteDocument, chunkText, hashContent };
