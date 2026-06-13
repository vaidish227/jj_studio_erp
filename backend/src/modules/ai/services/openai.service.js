// Thin wrapper around the official `openai` SDK. Centralizes client construction,
// retries, timeouts, and provides simple APIs the rest of the module uses.
//
// We deliberately do not throw when the API key is missing — the orchestrator
// surfaces a friendly SSE error event instead, so the rest of the app boots fine
// in environments where AI is disabled.

const aiConfig = require("../config/aiConfig");

let OpenAI = null;
let toFile = null;
try {
  const openaiPkg = require("openai");
  OpenAI = openaiPkg.OpenAI || openaiPkg;
  toFile = openaiPkg.toFile || null;
} catch (_e) {
  OpenAI = null;
}

let singleton = null;

function getClient() {
  if (!aiConfig.openai.apiKey) {
    const err = new Error("OPENAI_API_KEY is not configured");
    err.code = "ai_not_configured";
    throw err;
  }
  if (!OpenAI) {
    const err = new Error("openai package not installed — run `npm install openai`");
    err.code = "ai_sdk_missing";
    throw err;
  }
  if (!singleton) {
    singleton = new OpenAI({
      apiKey: aiConfig.openai.apiKey,
      baseURL: aiConfig.openai.baseUrl,
      timeout: aiConfig.limits.hardTimeoutMs,
      maxRetries: 1,
    });
  }
  return singleton;
}

/**
 * Stream a chat completion. Caller handles the AsyncIterable.
 * Returns the raw OpenAI stream object so the orchestrator can pipe deltas + tool calls.
 *
 * @param {Object}   opts
 * @param {string}   opts.model
 * @param {Array}    opts.messages          OpenAI-format messages
 * @param {Array=}   opts.tools             OpenAI tool/function schemas
 * @param {string=}  opts.toolChoice        "auto" | "none" | { type:"function", function:{name} }
 * @param {number=}  opts.temperature
 * @param {number=}  opts.maxTokens
 * @param {AbortSignal=} opts.signal
 */
async function streamChat({ model, messages, tools, toolChoice = "auto", temperature, maxTokens, signal }) {
  const client = getClient();
  return client.chat.completions.create(
    {
      model,
      messages,
      tools: tools && tools.length ? tools : undefined,
      tool_choice: tools && tools.length ? toolChoice : undefined,
      temperature: temperature ?? aiConfig.limits.temperature,
      max_tokens: maxTokens ?? aiConfig.limits.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    },
    { signal }
  );
}

/**
 * Non-streaming chat completion — used for health checks and the
 * `?stream=false` integration-test variant of the chat endpoint.
 */
async function chatComplete({ model, messages, tools, temperature, maxTokens, signal }) {
  const client = getClient();
  return client.chat.completions.create(
    {
      model,
      messages,
      tools: tools && tools.length ? tools : undefined,
      tool_choice: tools && tools.length ? "auto" : undefined,
      temperature: temperature ?? aiConfig.limits.temperature,
      max_tokens: maxTokens ?? aiConfig.limits.maxTokens,
    },
    { signal }
  );
}

/**
 * Embed a batch of texts. Returns an array of float vectors aligned with `inputs`.
 * Used by V2 RAG. Safe to call from V1 builds — only fails if invoked.
 */
async function embed(inputs, model) {
  const client = getClient();
  const res = await client.embeddings.create({
    model: model || aiConfig.models.embedding,
    input: Array.isArray(inputs) ? inputs : [inputs],
  });
  return res.data.map((d) => d.embedding);
}

/**
 * Speech-to-text. Accepts a raw audio buffer (any Whisper-supported container:
 * webm/ogg/mp3/m4a/wav/flac…) and returns the transcript text. The filename
 * extension is what the API uses to sniff the container, so keep it accurate.
 */
async function transcribe({ buffer, filename, mimetype }) {
  const client = getClient();
  if (!toFile) {
    const err = new Error("openai package too old — `toFile` helper missing. Run `npm install openai@latest`.");
    err.code = "ai_sdk_missing";
    throw err;
  }
  // MediaRecorder blobs may carry a codecs suffix ("audio/webm;codecs=opus").
  const cleanType = (mimetype || "audio/webm").split(";")[0].trim();
  const file = await toFile(buffer, filename || "recording.webm", { type: cleanType });
  const res = await client.audio.transcriptions.create({
    model: aiConfig.models.transcription,
    file,
  });
  return (res?.text || "").trim();
}

/**
 * Lightweight health probe. Returns { ok, latencyMs, error? }.
 */
async function ping() {
  const started = Date.now();
  try {
    const client = getClient();
    await client.chat.completions.create({
      model: aiConfig.models.default,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
      temperature: 0,
    });
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - started, error: err.code || err.message };
  }
}

module.exports = { getClient, streamChat, chatComplete, embed, transcribe, ping };
