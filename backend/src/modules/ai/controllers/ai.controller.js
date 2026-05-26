// Main chat controller. Handles the SSE streaming endpoint and a non-streaming
// fallback used by integration tests and clients that can't consume SSE.

const { openSseChannel } = require("../services/stream.service");
const orchestrator = require("../services/orchestrator.service");
const openai = require("../services/openai.service");
const aiConfig = require("../config/aiConfig");
const { chatSchema, validate } = require("../validators/chat.validator");

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
    return res.json({ ok: false, error: "ai_not_configured" });
  }
  const ping = await openai.ping();
  res.json({ ok: ping.ok, latencyMs: ping.latencyMs, error: ping.error });
}

module.exports = { streamChat, health };
