// CRUD for the user's own conversations. All endpoints are owner-scoped:
// userId === req.user.id, unless the caller has ai.admin / wildcard.

const mongoose = require("mongoose");
const AIConversation = require("../models/AIConversation.model");
const AIMessage = require("../models/AIMessage.model");
const AIFeedback = require("../models/AIFeedback.model");
const { renameSchema, feedbackSchema, validate } = require("../validators/chat.validator");

function isAdmin(req) {
  return (req.permissions || []).some((p) => p === "*" || p === "ai.admin");
}

async function list(req, res) {
  const limit  = Math.min(parseInt(req.query.limit, 10)  || 30, 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0,  0);

  const q = { userId: req.user.id, status: { $ne: "deleted" } };
  const [items, total] = await Promise.all([
    AIConversation.find(q)
      .sort({ lastMessageAt: -1 })
      .skip(offset)
      .limit(limit)
      .select("title startedAt lastMessageAt messageCount status totalTokens totalCostUsd")
      .lean(),
    AIConversation.countDocuments(q),
  ]);
  res.json({ items, total, limit, offset });
}

async function getOne(req, res) {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid conversation id." });
  }
  const conv = await AIConversation.findById(id).lean();
  if (!conv || conv.status === "deleted") return res.status(404).json({ message: "Not found." });
  if (String(conv.userId) !== String(req.user.id) && !isAdmin(req)) {
    return res.status(403).json({ message: "Forbidden." });
  }

  const messages = await AIMessage.find({ conversationId: id })
    .sort({ createdAt: 1 })
    .lean();
  res.json({ conversation: conv, messages });
}

async function rename(req, res) {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id." });

  let body;
  try { body = validate(renameSchema, req.body); }
  catch (e) { return res.status(e.statusCode || 400).json({ message: e.message }); }

  const conv = await AIConversation.findById(id);
  if (!conv || conv.status === "deleted") return res.status(404).json({ message: "Not found." });
  if (String(conv.userId) !== String(req.user.id) && !isAdmin(req)) {
    return res.status(403).json({ message: "Forbidden." });
  }
  conv.title = body.title;
  await conv.save();
  res.json({ ok: true });
}

async function softDelete(req, res) {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id." });

  const conv = await AIConversation.findById(id);
  if (!conv) return res.status(404).json({ message: "Not found." });
  if (String(conv.userId) !== String(req.user.id) && !isAdmin(req)) {
    return res.status(403).json({ message: "Forbidden." });
  }
  conv.status = "deleted";
  await conv.save();
  res.json({ ok: true });
}

async function feedback(req, res) {
  let body;
  try { body = validate(feedbackSchema, req.body); }
  catch (e) { return res.status(e.statusCode || 400).json({ message: e.message }); }

  // Ensure the message belongs to a conversation the user owns
  const msg = await AIMessage.findById(body.messageId).select("conversationId").lean();
  if (!msg) return res.status(404).json({ message: "Message not found." });
  const conv = await AIConversation.findById(msg.conversationId).select("userId").lean();
  if (!conv) return res.status(404).json({ message: "Conversation not found." });
  if (String(conv.userId) !== String(req.user.id) && !isAdmin(req)) {
    return res.status(403).json({ message: "Forbidden." });
  }

  await AIFeedback.updateOne(
    { messageId: body.messageId, userId: req.user.id },
    { $set: { rating: body.rating, reason: body.reason || "" } },
    { upsert: true }
  );
  res.json({ ok: true });
}

module.exports = { list, getOne, rename, softDelete, feedback };
