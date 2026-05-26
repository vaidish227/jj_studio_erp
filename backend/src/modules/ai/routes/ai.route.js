// AI module router. Mounted at /api/ai by backend/src/app.js.
//
// IMPORTANT: backend/src/app.js calls `app.use(verifyToken)` before this
// router is mounted, so `req.user` is always present here. We chain
// `requirePermission('ai.chat')` (or 'ai.admin') per-route which lazily
// loads req.permissions if not yet loaded.

const express = require("express");
const router = express.Router();

const { requirePermission } = require("../../../middleware/auth.middleware");
const aiRateLimit = require("../middleware/aiRateLimit.middleware");
const aiAudit = require("../middleware/aiAudit.middleware");

const ai = require("../controllers/ai.controller");
const conversation = require("../controllers/conversation.controller");
const admin = require("../controllers/admin.controller");
const documents = require("../controllers/documents.controller");
const userFacts = require("../controllers/userFacts.controller");
const actions = require("../controllers/actions.controller");

// ─── Chat stream ─────────────────────────────────────────────────────────────
// SSE endpoint. requirePermission populates req.permissions for us.
router.post(
  "/chat",
  requirePermission("ai.chat"),
  aiRateLimit,
  aiAudit,
  ai.streamChat
);

// ─── Conversations CRUD ───────────────────────────────────────────────────────
router.get   ("/conversations",          requirePermission("ai.chat"), conversation.list);
router.get   ("/conversations/:id",      requirePermission("ai.chat"), conversation.getOne);
router.post  ("/conversations/:id/rename", requirePermission("ai.chat"), conversation.rename);
router.delete("/conversations/:id",      requirePermission("ai.chat"), conversation.softDelete);

// ─── Feedback ─────────────────────────────────────────────────────────────────
router.post("/feedback", requirePermission("ai.chat"), conversation.feedback);

// ─── Write-tool proposals (V3) ───────────────────────────────────────────────
// The AI proposes a write via a tool call; the user confirms or cancels here.
// Permission to invoke the underlying tool is re-checked inside the executor.
router.post("/actions/:toolCallId/confirm", requirePermission("ai.chat"), actions.confirm);
router.post("/actions/:toolCallId/cancel",  requirePermission("ai.chat"), actions.cancel);

// ─── User Facts (long-term memory) ───────────────────────────────────────────
router.get   ("/user-facts",     requirePermission("ai.chat"), userFacts.listMine);
router.post  ("/user-facts",     requirePermission("ai.chat"), userFacts.addMine);
router.delete("/user-facts/:id", requirePermission("ai.chat"), userFacts.removeMine);

// ─── Knowledge Base (V2 RAG) ─────────────────────────────────────────────────
router.get   ("/documents",            requirePermission("ai.docs.read"),   documents.list);
router.get   ("/documents/:id",        requirePermission("ai.docs.read"),   documents.getOne);
router.get   ("/documents/:id/chunks", requirePermission("ai.docs.read"),   documents.listChunks);
router.post  ("/documents",            requirePermission("ai.docs.manage"), documents.create);
router.put   ("/documents/:id",        requirePermission("ai.docs.manage"), documents.update);
router.delete("/documents/:id",        requirePermission("ai.docs.manage"), documents.remove);
router.post  ("/documents/:id/reembed", requirePermission("ai.docs.manage"), documents.reembed);

// ─── Admin / Ops ─────────────────────────────────────────────────────────────
router.get ("/health",                 requirePermission("ai.admin"), ai.health);
router.get ("/admin/metrics",          requirePermission("ai.admin"), admin.metricsRollup);
router.post("/admin/summarize-facts",  requirePermission("ai.admin"), userFacts.runSummarizer);

module.exports = router;
