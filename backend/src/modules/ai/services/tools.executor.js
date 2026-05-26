// Tools executor — the single chokepoint that enforces:
//   1. Permission check (defense in depth — the OpenAI schema only exposes
//      tools the user *should* have, but a malicious or stale model could
//      still request another tool. We never trust that.)
//   2. JSON-schema validation via ajv.
//   3. Timeout + try/catch isolation.
//   4. Sanitization + truncation of the result.
//   5. Audit log to AIToolCall and PMSActivityLog.
//
// Every tool result returned to the orchestrator has the shape:
//   { ok, data?, summaryText, uiHint, llmSummary?, error?, latencyMs }

const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const registry = require("./tools.registry");
const aiConfig = require("../config/aiConfig");
const { sanitize, previewForAudit } = require("../utils/sanitize");
const AIToolCall = require("../models/AIToolCall.model");
// Note: we deliberately do NOT write AI tool invocations to PMSActivityLog —
// its `projectId` is required and `entityType` enum doesn't include "ai_query".
// AIToolCall is the authoritative audit surface for AI activity.

const ajv = new Ajv({
  allErrors: true,
  removeAdditional: "all",
  strict: false,
  useDefaults: true,
});
addFormats(ajv);

const validatorCache = new Map();
function getValidator(tool) {
  if (validatorCache.has(tool.name)) return validatorCache.get(tool.name);
  const validate = ajv.compile(tool.parameters || { type: "object" });
  validatorCache.set(tool.name, validate);
  return validate;
}

function withTimeout(promise, ms) {
  let timer;
  const t = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error(`Tool exceeded ${ms}ms timeout`);
      e.code = "timeout";
      reject(e);
    }, ms);
  });
  return Promise.race([promise, t]).finally(() => clearTimeout(timer));
}

async function run({ toolName, args, ctx, conversationId, messageId }) {
  const started = Date.now();
  const tool = registry.get(toolName);

  // 1. Tool exists?
  if (!tool) {
    const out = { ok: false, error: "unknown_tool", summaryText: `Unknown tool: ${toolName}`, uiHint: "error" };
    await persistAudit({
      ctx, conversationId, messageId, toolName, args, status: "error",
      errorCode: "unknown_tool", latencyMs: Date.now() - started, permissionCheckPassed: false,
      resultPreview: out.summaryText,
    });
    return { ...out, latencyMs: Date.now() - started };
  }

  // 2. Permission check
  const permitted = registry.hasPermission(ctx.permissions, tool.permission);
  if (!permitted) {
    const out = {
      ok: false,
      error: "denied",
      summaryText: `Permission denied (requires ${tool.permission}).`,
      uiHint: "error",
    };
    await persistAudit({
      ctx, conversationId, messageId, toolName, args, status: "denied",
      errorCode: "permission_denied", latencyMs: Date.now() - started, permissionCheckPassed: false,
      resultPreview: out.summaryText,
    });
    return { ...out, latencyMs: Date.now() - started };
  }

  // 3. Validate args. ajv `removeAdditional:'all'` strips unknown keys and
  //    `useDefaults:true` fills declared defaults.
  const validate = getValidator(tool);
  const argsCopy = JSON.parse(JSON.stringify(args || {}));
  const valid = validate(argsCopy);
  if (!valid) {
    const detail = (validate.errors || []).map((e) => `${e.instancePath || "(root)"} ${e.message}`).join("; ");
    const out = {
      ok: false,
      error: "invalid_args",
      summaryText: `Invalid arguments: ${detail || "schema validation failed"}`,
      uiHint: "error",
    };
    await persistAudit({
      ctx, conversationId, messageId, toolName, args, status: "invalid_args",
      errorCode: "schema", latencyMs: Date.now() - started, permissionCheckPassed: true,
      resultPreview: out.summaryText,
    });
    return { ...out, latencyMs: Date.now() - started };
  }

  // 4. Execute under timeout
  let result;
  try {
    result = await withTimeout(tool.handler(argsCopy, ctx), aiConfig.limits.hardTimeoutMs);
  } catch (err) {
    const code = err?.code || "handler_error";
    const out = {
      ok: false,
      error: code,
      summaryText: code === "timeout" ? "The tool took too long to respond." : "Tool failed to execute.",
      uiHint: "error",
    };
    await persistAudit({
      ctx, conversationId, messageId, toolName, args: argsCopy, status: code === "timeout" ? "timeout" : "error",
      errorCode: code, latencyMs: Date.now() - started, permissionCheckPassed: true,
      resultPreview: String(err?.message || code).slice(0, 1000),
    });
    return { ...out, latencyMs: Date.now() - started };
  }

  // 5. Normalize the result shape
  const ok = result?.ok !== false;
  const llmSummary = sanitize(result?.llmSummary ?? result?.data, { stringCap: 500, maxDepth: 5 });
  const data = sanitize(result?.data, { stringCap: 4000, maxDepth: 8 });
  const final = {
    ok,
    error: result?.error || null,
    data,
    llmSummary,
    summaryText: result?.summaryText || (ok ? "" : "Tool returned an error."),
    uiHint: result?.uiHint || (ok ? null : "error"),
    latencyMs: Date.now() - started,
  };

  // 6. Audit
  await persistAudit({
    ctx, conversationId, messageId, toolName, args: argsCopy,
    status: ok ? "ok" : (result?.error || "error"),
    errorCode: ok ? null : (result?.error || "error"),
    latencyMs: final.latencyMs,
    permissionCheckPassed: true,
    resultPreview: previewForAudit(final.llmSummary ?? final.data ?? final.summaryText, 2000),
  });

  return final;
}

async function persistAudit({
  ctx, conversationId, messageId, toolName, args,
  status, errorCode, latencyMs, permissionCheckPassed, resultPreview,
}) {
  // Fire-and-forget — auditing must never break the chat loop.
  try {
    await AIToolCall.create({
      conversationId: conversationId || null,
      messageId: messageId || null,
      userId: ctx?.userId || null,
      toolName,
      args: sanitize(args, { stringCap: 500, maxDepth: 5 }),
      resultPreview: resultPreview || "",
      status,
      errorCode: errorCode || null,
      latencyMs,
      permissionCheckPassed: !!permissionCheckPassed,
    });
  } catch (err) {
    console.error("[AI][audit:AIToolCall]", err.message);
  }
}

module.exports = { run };
