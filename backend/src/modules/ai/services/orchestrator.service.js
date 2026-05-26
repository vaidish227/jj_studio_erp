// Orchestrator — the heart of the chat flow.
//
// Responsibilities:
//   1. Ensure a conversation exists (or create one).
//   2. Persist the user message.
//   3. Stream an OpenAI completion. Forward token deltas to the SSE channel.
//   4. When the model requests tool calls, run them through the executor, emit
//      the structured tool_result events to the UI, and feed the tool messages
//      back into OpenAI. Iterate until the model produces a final answer or
//      we hit the max-iterations safety stop.
//   5. Persist all new messages and an AIMetric row. Always end the SSE channel.

const crypto = require("crypto");

const aiConfig = require("../config/aiConfig");
const openai = require("./openai.service");
const registry = require("./tools.registry");
const executor = require("./tools.executor");
const memory = require("./memory.service");
const rag = require("./rag.service");
const userFactsService = require("./userFacts.service");
const { buildMessages, pickModel } = require("./promptBuilder.service");
const { computeCost } = require("./cost.service");
const { sanitize, previewForAudit } = require("../utils/sanitize");
const { count: countTokens } = require("../utils/tokenizer");

const AIMetric = require("../models/AIMetric.model");

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function genId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Main entry. Caller must have already opened an SSE channel via stream.service.
 *
 *   sse.emit("token",       { delta })
 *   sse.emit("tool_call",   { id, name, args })
 *   sse.emit("tool_result", { id, ok, summaryText, data, uiHint })
 *   sse.emit("error",       { code, message })
 *   sse.emit("done",        { conversationId, messageId, tokens, costUsd })
 */
async function run({ user, message, conversationId, sse, abortSignal }) {
  const requestStart = Date.now();
  const requestId = genId();

  // Honor abort on client disconnect — registered via sse.onAbort.
  const controller = new AbortController();
  if (abortSignal) {
    abortSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  if (sse?.onAbort) sse.onAbort(() => controller.abort());

  let conv;
  try {
    conv = await memory.getOrCreateConversation({
      conversationId,
      userId: user.id,
      firstMessage: message,
    });
  } catch (err) {
    sse?.emit("error", { code: "conv_init_failed", message: "Could not start conversation." });
    sse?.close();
    console.error("[AI][orchestrator] conv_init_failed", err);
    return;
  }

  // Tell the UI which conversation this turn belongs to (handy for new convs).
  sse?.emit("meta", { conversationId: String(conv._id), requestId });

  // 1. Persist the user message
  const userMsgDoc = await memory.appendMessage({
    conversationId: conv._id,
    role: "user",
    content: String(message || "").slice(0, aiConfig.limits.inputCharLimit),
  });

  // 2a. RAG retrieval + user-facts load (parallel, both best-effort)
  const canSearchDocs = (user.permissions || []).some((p) => p === "*" || p === "ai.docs.read");
  const [retrievedChunks, userFacts, history] = await Promise.all([
    canSearchDocs
      ? rag.retrieve({ query: message, user, k: 5 }).catch((err) => {
          console.error("[AI][orchestrator] rag.retrieve failed:", err.message);
          return [];
        })
      : Promise.resolve([]),
    userFactsService.loadFactsForUser(user.id).catch(() => []),
    memory.loadHistory(conv._id),
  ]);

  // Emit citations early so the UI can render a "Sources" panel before tokens stream.
  // Always emit — even with 0 hits — so the UI can show "RAG ran, no sources"
  // vs "RAG never ran" (this event simply absent).
  sse?.emit("citations", {
    ragRan: canSearchDocs,
    ragHits: retrievedChunks.length,
    citations: retrievedChunks.map((c, i) => ({
      n: i + 1,
      documentId: c.documentId,
      chunkId: c.chunkId,
      title: c.title,
      source: c.source,
      sourceType: c.sourceType,
      sourceUrl: c.sourceUrl,
      score: c.score,
      excerpt: c.text.slice(0, 240),
    })),
  });

  // 2b. Build the conversation we send to OpenAI
  const userPermissions = sanitize(user.permissions || [], { stringCap: 100, maxDepth: 2 });
  const messages = buildMessages({
    user,
    today: todayStr(),
    history,
    newUserMessage: message,
    permissionNames: userPermissions,
    retrievedChunks,
    userFacts,
  });

  const tools = registry.openaiSchema(user.permissions || []);
  const model = pickModel({
    message,
    defaultModel: aiConfig.models.default,
    complexModel: aiConfig.models.complex,
  });

  // 3. The main streaming + tool-call loop
  const newDocs = []; // assistant/tool messages we're about to persist
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalCostUsd = 0;
  let toolCount = 0;
  let lastAssistantContent = "";
  let lastAssistantId = null;
  let errorCode = null;

  try {
    for (let iter = 0; iter < aiConfig.limits.maxToolIterations; iter++) {
      if (sse?.isClosed?.()) break;

      const stream = await openai.streamChat({
        model,
        messages,
        tools,
        temperature: aiConfig.limits.temperature,
        maxTokens: aiConfig.limits.maxTokens,
        signal: controller.signal,
      });

      // Accumulators for this streaming pass
      let assistantText = "";
      const toolCallAcc = new Map(); // index -> { id, name, argsStr }
      let finishReason = null;
      let usage = null;

      for await (const chunk of stream) {
        if (sse?.isClosed?.()) {
          try { controller.abort(); } catch (_e) { /* ignore */ }
          break;
        }
        const choice = chunk.choices?.[0];
        if (!choice) {
          if (chunk.usage) usage = chunk.usage;
          continue;
        }
        const delta = choice.delta || {};

        if (typeof delta.content === "string" && delta.content.length > 0) {
          assistantText += delta.content;
          sse?.emit("token", { delta: delta.content });
        }

        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            const cur = toolCallAcc.get(idx) || { id: null, name: "", argsStr: "" };
            if (tc.id) cur.id = tc.id;
            if (tc.function?.name) cur.name = tc.function.name;
            if (typeof tc.function?.arguments === "string") cur.argsStr += tc.function.arguments;
            toolCallAcc.set(idx, cur);
          }
        }

        if (choice.finish_reason) finishReason = choice.finish_reason;
        if (chunk.usage) usage = chunk.usage;
      }

      // Tally usage
      if (usage) {
        totalPromptTokens     += usage.prompt_tokens     || 0;
        totalCompletionTokens += usage.completion_tokens || 0;
        totalCostUsd += computeCost(model, usage.prompt_tokens || 0, usage.completion_tokens || 0);
      } else {
        // Heuristic fallback when the provider doesn't return usage on stream
        totalCompletionTokens += countTokens(assistantText);
      }

      // Persist the assistant turn (with any tool_calls it requested)
      const orderedCalls = Array.from(toolCallAcc.values()).map((tc) => ({
        id: tc.id || genId(),
        name: tc.name,
        args: safeParseJson(tc.argsStr),
      }));

      const assistantDoc = await memory.appendMessage({
        conversationId: conv._id,
        role: "assistant",
        content: assistantText,
        toolCalls: orderedCalls,
        model,
        completionTokens: usage?.completion_tokens || countTokens(assistantText),
        promptTokens: usage?.prompt_tokens || 0,
        finishReason,
      });
      newDocs.push(assistantDoc);
      lastAssistantContent = assistantText;
      lastAssistantId = assistantDoc._id;

      // Push the assistant message into the OpenAI conversation array for the next iter.
      const assistantOpenAIMessage = {
        role: "assistant",
        content: assistantText,
      };
      if (orderedCalls.length) {
        assistantOpenAIMessage.tool_calls = orderedCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) },
        }));
      }
      messages.push(assistantOpenAIMessage);

      // 4. If no tool calls, we are done.
      if (finishReason !== "tool_calls" || orderedCalls.length === 0) {
        break;
      }

      // 5. Execute each tool call sequentially and feed results back.
      for (const call of orderedCalls) {
        if (sse?.isClosed?.()) break;
        toolCount++;
        sse?.emit("tool_call", { id: call.id, name: call.name, args: call.args });

        const result = await executor.run({
          toolName: call.name,
          args: call.args,
          ctx: {
            userId: user.id,
            role: user.role,
            permissions: user.permissions || [],
            email: user.email,
          },
          conversationId: conv._id,
          messageId: assistantDoc._id,
        });

        // Emit the rich result to the UI (full data + uiHint)
        sse?.emit("tool_result", {
          id: call.id,
          name: call.name,
          ok: result.ok,
          error: result.error || null,
          summaryText: result.summaryText,
          uiHint: result.uiHint,
          data: result.data,
          latencyMs: result.latencyMs,
        });

        // Build the compact tool message for OpenAI (only summary, not full data)
        const llmPayload = JSON.stringify({
          ok: result.ok,
          error: result.error || null,
          summaryText: result.summaryText,
          summary: result.llmSummary ?? null,
        }).slice(0, 6000);

        // Persist the tool message
        const toolDoc = await memory.appendMessage({
          conversationId: conv._id,
          role: "tool",
          toolCallId: call.id,
          content: llmPayload,
          uiPayload: result.data,
          uiHint: result.uiHint,
        });
        newDocs.push(toolDoc);

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: llmPayload,
        });
      }
      // loop continues — re-invoke OpenAI with the tool results.
    }
  } catch (err) {
    if (err?.name === "AbortError" || err?.code === "ABORT_ERR") {
      errorCode = "aborted";
    } else {
      errorCode = err?.code || "openai_error";
      console.error("[AI][orchestrator]", err);
      sse?.emit("error", {
        code: errorCode,
        message: friendlyMessage(errorCode, err?.message),
      });
    }
  }

  // 6. Persist citations on the FINAL assistant message (only if we retrieved
  //    any AND the model actually produced user-facing content this turn).
  if (lastAssistantId && retrievedChunks.length && lastAssistantContent) {
    try {
      const AIMessage = require("../models/AIMessage.model");
      await AIMessage.updateOne(
        { _id: lastAssistantId },
        {
          $set: {
            citations: retrievedChunks.map((c, i) => ({
              n: i + 1,
              documentId: c.documentId,
              chunkId: c.chunkId,
              title: c.title,
              source: c.source,
              sourceUrl: c.sourceUrl,
              score: c.score,
              excerpt: c.text.slice(0, 240),
            })),
          },
        }
      );
    } catch (err) {
      console.error("[AI][orchestrator][persist-citations]", err.message);
    }
  }

  // 7. Bump conversation + write metric
  try {
    const totalTokens = totalPromptTokens + totalCompletionTokens;
    await memory.bumpConversation(conv._id, {
      tokens: totalTokens,
      costUsd: totalCostUsd,
      lastMessageAt: new Date(),
      inc: 1 + newDocs.length, // user message + each new assistant/tool message
    });

    await AIMetric.create({
      requestId,
      userId: user.id,
      conversationId: conv._id,
      model,
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      costUsd: totalCostUsd,
      latencyMs: Date.now() - requestStart,
      toolCount,
      errorCode,
    });
  } catch (err) {
    console.error("[AI][orchestrator][persist-metric]", err.message);
  }

  // 8. Done
  sse?.emit("done", {
    conversationId: String(conv._id),
    messageId: lastAssistantId ? String(lastAssistantId) : null,
    requestId,
    tokens: totalPromptTokens + totalCompletionTokens,
    costUsd: Number(totalCostUsd.toFixed(6)),
    error: errorCode,
    ragRan: canSearchDocs,
    ragHits: retrievedChunks.length,
    citationCount: retrievedChunks.length,
  });
  sse?.close();
}

function safeParseJson(s) {
  if (!s) return {};
  try { return JSON.parse(s); } catch { return { _raw: String(s).slice(0, 500) }; }
}

function friendlyMessage(code, raw) {
  if (code === "ai_not_configured") return "AI is not yet configured. Ask an admin to set OPENAI_API_KEY.";
  if (code === "ai_sdk_missing")    return "AI dependencies are missing. Run `npm install` in backend.";
  if (code === "rate_limit_exceeded") return "Rate limit exceeded. Try again in a minute.";
  if (code === "timeout")           return "The AI took too long to respond. Please retry.";
  return raw && raw.length < 200 ? raw : "The AI service is temporarily unavailable.";
}

module.exports = { run };
