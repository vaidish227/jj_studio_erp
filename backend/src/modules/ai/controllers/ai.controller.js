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

// One-shot text polish — rewrites raw text into professional English without
// changing meaning. Non-streaming JSON; reuses openai.chatComplete. Used by the
// "AI" button on the Record MOM Discussion Summary field.
const POLISH_MAX_CHARS = 4000;
const POLISH_SYSTEM_PROMPT =
  "You are a professional editor for meeting minutes. Rewrite the user's meeting " +
  "discussion summary in clear, professional English with correct grammar and structure. " +
  "Preserve every fact, name, number, date, decision, and the original meaning exactly. " +
  "Do NOT add, invent, infer, or remove any information. Keep roughly the same length and " +
  "the same language as the input. Return ONLY the rewritten text — no preamble, no quotes, " +
  "no markdown, no commentary.";

async function polishText(req, res) {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) {
    return res.status(400).json({ message: "Provide some text to refine." });
  }
  if (text.length > POLISH_MAX_CHARS) {
    return res.status(400).json({ message: `Text is too long (max ${POLISH_MAX_CHARS} characters).` });
  }
  if (!aiConfig.openai.apiKey) {
    return res.status(503).json({ message: "AI is not yet configured. Ask an admin to set OPENAI_API_KEY." });
  }

  try {
    const resp = await openai.chatComplete({
      model: aiConfig.models.default,
      temperature: 0.2,
      maxTokens: 1000,
      messages: [
        { role: "system", content: POLISH_SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
    });
    const polishedText = (resp?.choices?.[0]?.message?.content || "").trim();
    if (!polishedText) {
      return res.status(502).json({ message: "AI could not refine this text. Please try again." });
    }
    return res.json({ ok: true, polishedText });
  } catch (err) {
    console.error("[AI][controller][polishText]", err);
    if (err?.status === 429) {
      return res.status(503).json({ message: "OpenAI quota exceeded — add credits to the OpenAI account, then retry." });
    }
    return res.status(500).json({ message: "Failed to refine text. Please try again." });
  }
}

// Speech-to-text for the MoM voice-note feature. Multer (memory storage, see
// ai.route.js) has already parsed the upload into req.file when we get here —
// covers both mic recordings (webm/mp4 blobs) and uploaded audio files.
async function transcribeAudio(req, res) {
  if (req.fileFilterError) {
    return res.status(400).json({ message: req.fileFilterError });
  }
  if (!req.file?.buffer?.length) {
    return res.status(400).json({ message: "Attach an audio recording or file to transcribe." });
  }
  if (!aiConfig.openai.apiKey) {
    return res.status(503).json({ message: "AI is not yet configured. Ask an admin to set OPENAI_API_KEY." });
  }

  try {
    const text = await openai.transcribe({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    });
    if (!text) {
      return res.status(422).json({ message: "No speech detected in this audio." });
    }
    return res.json({ ok: true, text });
  } catch (err) {
    console.error("[AI][controller][transcribeAudio]", err);
    if (err?.status === 429) {
      return res.status(503).json({ message: "OpenAI quota exceeded — add credits to the OpenAI account, then retry." });
    }
    if (err?.status === 400) {
      return res.status(400).json({ message: "OpenAI could not read this audio format. Try a different file." });
    }
    return res.status(500).json({ message: "Transcription failed. Please try again." });
  }
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

module.exports = { streamChat, polishText, transcribeAudio, health };
