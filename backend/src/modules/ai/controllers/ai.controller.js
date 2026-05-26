// Main chat controller. Handles the SSE streaming endpoint and a non-streaming
// fallback used by integration tests and clients that can't consume SSE.

const { openSseChannel } = require("../services/stream.service");
const orchestrator = require("../services/orchestrator.service");
const openai = require("../services/openai.service");
const vectorIndex = require("../services/vectorIndex.service");
const aiConfig = require("../config/aiConfig");
const { chatSchema, validate } = require("../validators/chat.validator");
const AIDocument = require("../models/AIDocument.model");

async function streamChat(req, res) {
  let body;
  try {
    body = validate(chatSchema, req.body);
  } catch (err) {
    return res.status(err.statusCode || 400).json({ message: err.message });
  }

  // The /chat endpoint passes through requirePermission('ai.chat'), so
  // req.permissions is already populated. Pass it into orchestrator.
  const user = {
    id: req.user.id,
    role: req.user.role,
    email: req.user.email,
    permissions: req.permissions || [],
    name: req.user.name,
    department: req.user.department,
  };

  // Soft preflight — if AI is not configured, fail fast with a clean SSE error
  // so the UI shows a usable message instead of an opaque crash.
  if (!aiConfig.openai.apiKey) {
    const sse = openSseChannel(res);
    sse.emit("error", {
      code: "ai_not_configured",
      message: "AI is not yet configured. Ask an admin to set OPENAI_API_KEY.",
    });
    sse.emit("done", { conversationId: null, error: "ai_not_configured" });
    sse.close();
    return;
  }

  const sse = openSseChannel(res);
  const abortController = new AbortController();
  sse.onAbort(() => abortController.abort());

  // Fire-and-forget — orchestrator manages its own lifecycle and closes the SSE.
  orchestrator
    .run({
      user,
      message: body.message,
      conversationId: body.conversationId || null,
      sse,
      abortSignal: abortController.signal,
    })
    .catch((err) => {
      console.error("[AI][controller][streamChat]", err);
      try {
        sse.emit("error", { code: "orchestrator_failed", message: "Unexpected error." });
        sse.close();
      } catch (_e) { /* socket already gone */ }
    });
}

async function health(_req, res) {
  if (!aiConfig.openai.apiKey) {
    return res.json({
      ok: false,
      openai: { configured: false },
      vectorIndex: { status: "skipped" },
      documents: { total: 0 },
    });
  }
  const [ping, vec, docCount] = await Promise.all([
    openai.ping(),
    vectorIndex.probe(),
    AIDocument.countDocuments({ status: "active" }),
  ]);
  res.json({
    ok: ping.ok && (vec.status === "ready" || vec.status === "building"),
    openai: { configured: true, ok: ping.ok, latencyMs: ping.latencyMs, error: ping.error || null },
    vectorIndex: vec,
    documents: { total: docCount },
    models: {
      default: aiConfig.models.default,
      complex: aiConfig.models.complex,
      embedding: aiConfig.models.embedding,
    },
  });
}

module.exports = { streamChat, health };
