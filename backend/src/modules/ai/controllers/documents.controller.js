// Admin CRUD for the AI knowledge base.
// Guarded by requirePermission('ai.docs.manage') in the router for write ops,
// and 'ai.docs.read' for read ops.

const mongoose = require("mongoose");
const Joi = require("joi");

const AIDocument = require("../models/AIDocument.model");
const AIDocumentChunk = require("../models/AIDocumentChunk.model");
const ingestion = require("../services/ingestion.service");

const ownerScopeSchema = Joi.object({
  type: Joi.string().valid("public", "role", "dept").required(),
  value: Joi.string().allow(null, "").optional(),
});

const createSchema = Joi.object({
  title: Joi.string().trim().min(1).max(300).required(),
  body: Joi.string().trim().min(1).max(200_000).required(),
  source: Joi.string().allow("").max(200).optional(),
  sourceType: Joi.string().valid("sop", "policy", "manual", "faq", "note", "other").optional(),
  sourceUrl: Joi.string().uri().allow(null, "").optional(),
  ownerScope: ownerScopeSchema.optional(),
});

const updateSchema = Joi.object({
  title: Joi.string().trim().min(1).max(300).optional(),
  body: Joi.string().trim().min(1).max(200_000).optional(),
  source: Joi.string().allow("").max(200).optional(),
  sourceType: Joi.string().valid("sop", "policy", "manual", "faq", "note", "other").optional(),
  sourceUrl: Joi.string().uri().allow(null, "").optional(),
  ownerScope: ownerScopeSchema.optional(),
});

function validate(schema, payload) {
  const { value, error } = schema.validate(payload, { stripUnknown: true });
  if (error) {
    const e = new Error(error.details?.[0]?.message || "Invalid request");
    e.statusCode = 400;
    throw e;
  }
  return value;
}

async function list(req, res) {
  const limit  = Math.min(parseInt(req.query.limit, 10)  || 50, 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const q = {};
  if (req.query.status) q.status = req.query.status;
  else q.status = { $ne: "archived" };

  if (req.query.search) {
    q.title = { $regex: String(req.query.search).slice(0, 100), $options: "i" };
  }

  const [items, total] = await Promise.all([
    AIDocument.find(q)
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(limit)
      .select("-body")
      .lean(),
    AIDocument.countDocuments(q),
  ]);
  res.json({ items, total, limit, offset });
}

async function getOne(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid id." });
  }
  const doc = await AIDocument.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ message: "Not found." });
  res.json({ document: doc });
}

async function create(req, res) {
  let body;
  try { body = validate(createSchema, req.body); }
  catch (e) { return res.status(e.statusCode || 400).json({ message: e.message }); }

  try {
    const result = await ingestion.ingestDocument({
      ...body,
      createdBy: req.user?.id || null,
    });
    res.status(result.skipped ? 200 : 201).json(result);
  } catch (err) {
    console.error("[AI][documents.create]", err);
    res.status(500).json({ message: err.message || "Ingestion failed." });
  }
}

async function update(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid id." });
  }
  let body;
  try { body = validate(updateSchema, req.body); }
  catch (e) { return res.status(e.statusCode || 400).json({ message: e.message }); }

  const existing = await AIDocument.findById(req.params.id).lean();
  if (!existing) return res.status(404).json({ message: "Not found." });

  // If body or title changed → re-ingest (which archives the old doc).
  const bodyChanged = body.body !== undefined && body.body !== existing.body;
  const titleChanged = body.title !== undefined && body.title !== existing.title;
  if (bodyChanged || titleChanged) {
    try {
      const result = await ingestion.ingestDocument({
        title: body.title || existing.title,
        body: body.body || existing.body,
        ownerScope: body.ownerScope || existing.ownerScope,
        source: body.source ?? existing.source,
        sourceType: body.sourceType ?? existing.sourceType,
        sourceUrl: body.sourceUrl ?? existing.sourceUrl,
        createdBy: req.user?.id || existing.createdBy,
      });
      return res.json(result);
    } catch (err) {
      console.error("[AI][documents.update]", err);
      return res.status(500).json({ message: err.message || "Re-ingestion failed." });
    }
  }

  // Metadata-only update — no re-embed needed.
  const updates = {};
  for (const key of ["source", "sourceType", "sourceUrl", "ownerScope"]) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  const updated = await AIDocument.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).lean();

  // Also update the chunks' denormalized metadata so retrieval reflects the change immediately.
  if (Object.keys(updates).length) {
    const chunkUpdates = {};
    if (updates.source !== undefined)      chunkUpdates["metadata.source"] = updates.source;
    if (updates.sourceType !== undefined)  chunkUpdates["metadata.sourceType"] = updates.sourceType;
    if (updates.sourceUrl !== undefined)   chunkUpdates["metadata.sourceUrl"] = updates.sourceUrl;
    if (updates.ownerScope !== undefined) {
      chunkUpdates["metadata.ownerScopeType"] = updates.ownerScope.type;
      chunkUpdates["metadata.ownerScopeValue"] = updates.ownerScope.value || null;
    }
    if (Object.keys(chunkUpdates).length) {
      await AIDocumentChunk.updateMany({ documentId: req.params.id }, { $set: chunkUpdates });
    }
  }
  res.json({ document: updated });
}

async function remove(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid id." });
  }
  try {
    await ingestion.deleteDocument(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function reembed(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid id." });
  }
  try {
    const result = await ingestion.reembedDocument(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function listChunks(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid id." });
  }
  const chunks = await AIDocumentChunk.find({ documentId: req.params.id })
    .sort({ chunkIndex: 1 })
    .select("chunkIndex text tokens metadata")
    .lean();
  res.json({ chunks });
}

module.exports = { list, getOne, create, update, remove, reembed, listChunks };
