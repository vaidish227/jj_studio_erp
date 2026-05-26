// Tools executor — single chokepoint that enforces:
//   1. Permission check (defense in depth — the OpenAI schema only exposes
//      tools the user *should* have, but a malicious or stale model could
//      still request another tool. We never trust that.)
//   2. JSON-schema validation via ajv.
//   3. Timeout + try/catch isolation.
//   4. Sanitization + truncation of the result.
//   5. Audit log to AIToolCall.
//
// V3 — write-tool flow:
//   Read tools work as before (one phase: handler runs, result streamed).
//   Write tools (tool.isWrite === true) are TWO-PHASE:
//     Phase 1 (propose) — `dryRun(args, ctx)` returns
//                         { ok, proposalDescription, args, ...metadata }
//                         Executor persists an AIToolCall row with
//                         status='pending_confirmation' and streams it back.
//                         The UI renders a Confirm/Cancel card.
//     Phase 2 (apply)   — POST /api/ai/actions/:toolCallId/confirm hits
//                         confirmAction() below, which re-checks permission
//                         + expiry, runs tool.apply(args, ctx), updates the
//                         AIToolCall row to confirmed_ok / confirmed_error.

const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const registry = require("./tools.registry");
const aiConfig = require("../config/aiConfig");
const { sanitize, previewForAudit } = require("../utils/sanitize");
const AIToolCall = require("../models/AIToolCall.model");

const ajv = new Ajv({
  allErrors: true,
  removeAdditional: "all",
  strict: false,
  useDefaults: true,
});
addFormats(ajv);

const PROPOSAL_TTL_MS = 5 * 60 * 1000; // 5 minutes to confirm

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

/**
 * Main entry. Called by the orchestrator for every tool the model requests.
 *
 * For write tools, this returns a "pending_confirmation" result — the actual
 * mutation only happens in confirmAction() after the user clicks Confirm.
 */
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
      isWrite: !!tool.isWrite,
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
      isWrite: !!tool.isWrite,
    });
    return { ...out, latencyMs: Date.now() - started };
  }

  // 4a. WRITE TOOL — propose only, do not execute yet.
  if (tool.isWrite) {
    return runProposal({ tool, args: argsCopy, ctx, conversationId, messageId, started });
  }

  // 4b. READ TOOL — execute under timeout
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

  return finalizeReadResult({ result, ctx, conversationId, messageId, toolName, argsCopy, started });
}

// ─── Read-tool finalizer ────────────────────────────────────────────────────
async function finalizeReadResult({ result, ctx, conversationId, messageId, toolName, argsCopy, started }) {
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

// ─── Write-tool: phase 1 (propose) ───────────────────────────────────────────
async function runProposal({ tool, args, ctx, conversationId, messageId, started }) {
  let proposal;
  try {
    proposal = await withTimeout(tool.dryRun(args, ctx), aiConfig.limits.hardTimeoutMs);
  } catch (err) {
    const code = err?.code || "dryrun_error";
    const out = {
      ok: false,
      error: code,
      summaryText: code === "timeout" ? "Validation took too long." : (err?.message || "Validation failed."),
      uiHint: "error",
    };
    await persistAudit({
      ctx, conversationId, messageId, toolName: tool.name, args,
      status: code === "timeout" ? "timeout" : "error",
      errorCode: code,
      latencyMs: Date.now() - started,
      permissionCheckPassed: true,
      resultPreview: out.summaryText,
      isWrite: true,
    });
    return { ...out, latencyMs: Date.now() - started };
  }

  // Tool decided the action is invalid (not found, illegal transition, …)
  if (proposal?.ok === false) {
    const out = {
      ok: false,
      error: proposal.error || "invalid",
      summaryText: proposal.summaryText || "This action can't be performed.",
      uiHint: "error",
      latencyMs: Date.now() - started,
    };
    await persistAudit({
      ctx, conversationId, messageId, toolName: tool.name, args,
      status: "error",
      errorCode: out.error,
      latencyMs: out.latencyMs,
      permissionCheckPassed: true,
      resultPreview: out.summaryText,
      isWrite: true,
    });
    return out;
  }

  // Save a pending row — the UI will look this up at confirm time.
  const description = String(proposal?.proposalDescription || `Run ${tool.name}`).slice(0, 500);
  const sanitizedArgs = sanitize(proposal?.args ?? args, { stringCap: 500, maxDepth: 6 });

  let toolCallDoc;
  try {
    toolCallDoc = await AIToolCall.create({
      conversationId: conversationId || null,
      messageId: messageId || null,
      userId: ctx?.userId || null,
      toolName: tool.name,
      args: sanitizedArgs,
      resultPreview: description,
      status: "pending_confirmation",
      errorCode: null,
      latencyMs: Date.now() - started,
      permissionCheckPassed: true,
      isWrite: true,
      proposalDescription: description,
      pendingExpiresAt: new Date(Date.now() + PROPOSAL_TTL_MS),
    });
  } catch (err) {
    console.error("[AI][audit:AIToolCall][proposal]", err.message);
  }

  return {
    ok: true,
    status: "pending_confirmation",
    toolCallId: toolCallDoc ? String(toolCallDoc._id) : null,
    summaryText: description,
    proposalDescription: description,
    expiresAt: toolCallDoc?.pendingExpiresAt || new Date(Date.now() + PROPOSAL_TTL_MS),
    uiHint: "actionProposal",
    data: proposal?.preview || null,
    latencyMs: Date.now() - started,
    // The LLM sees a compact summary — it should pause and not assume the action is done.
    llmSummary: `Proposed: ${description}. Waiting for user confirmation.`,
  };
}

// ─── Write-tool: phase 2 (apply on confirm) ─────────────────────────────────
/**
 * Called by the /actions/:toolCallId/confirm route. Re-validates permission +
 * expiry, then runs `tool.apply(args, ctx)`.
 */
async function confirmAction({ toolCallId, ctx }) {
  const doc = await AIToolCall.findById(toolCallId);
  if (!doc) {
    return { ok: false, error: "not_found", summaryText: "That action no longer exists." };
  }
  if (!doc.isWrite) {
    return { ok: false, error: "not_a_write", summaryText: "That action is not confirmable." };
  }
  if (doc.status !== "pending_confirmation") {
    return { ok: false, error: "wrong_state", summaryText: `Already ${doc.status}.`, status: doc.status };
  }
  if (String(doc.userId) !== String(ctx.userId)) {
    return { ok: false, error: "denied", summaryText: "Only the original user can confirm." };
  }
  if (doc.pendingExpiresAt && doc.pendingExpiresAt < new Date()) {
    doc.status = "cancelled";
    doc.cancelledAt = new Date();
    await doc.save().catch(() => null);
    return { ok: false, error: "expired", summaryText: "The proposal expired. Ask the assistant again." };
  }

  const tool = registry.get(doc.toolName);
  if (!tool || !tool.isWrite || typeof tool.apply !== "function") {
    return { ok: false, error: "tool_gone", summaryText: "Tool is no longer available." };
  }

  // Re-check permission at confirm time — perms may have changed since propose.
  if (!registry.hasPermission(ctx.permissions, tool.permission)) {
    doc.status = "denied";
    doc.errorCode = "permission_denied";
    await doc.save().catch(() => null);
    return { ok: false, error: "denied", summaryText: `Permission denied (requires ${tool.permission}).` };
  }

  const started = Date.now();
  let applied;
  try {
    applied = await withTimeout(tool.apply(doc.args, ctx), aiConfig.limits.hardTimeoutMs);
  } catch (err) {
    doc.status = "confirmed_error";
    doc.errorCode = err?.code || "apply_error";
    doc.resultPreview = String(err?.message || "").slice(0, 1000);
    doc.confirmedAt = new Date();
    doc.latencyMs = Date.now() - started;
    await doc.save().catch(() => null);
    return { ok: false, error: doc.errorCode, summaryText: doc.resultPreview || "The action failed." };
  }

  const ok = applied?.ok !== false;
  doc.status = ok ? "confirmed_ok" : "confirmed_error";
  doc.errorCode = ok ? null : (applied?.error || "error");
  doc.confirmedAt = new Date();
  doc.latencyMs = Date.now() - started;
  doc.resultPreview = previewForAudit(applied?.data ?? applied?.summaryText, 2000);
  await doc.save().catch(() => null);

  return {
    ok,
    error: applied?.error || null,
    summaryText: applied?.summaryText || (ok ? "Done." : "Action failed."),
    uiHint: applied?.uiHint || null,
    data: sanitize(applied?.data, { stringCap: 4000, maxDepth: 8 }),
    latencyMs: doc.latencyMs,
  };
}

async function cancelAction({ toolCallId, ctx }) {
  const doc = await AIToolCall.findById(toolCallId);
  if (!doc) return { ok: false, error: "not_found" };
  if (String(doc.userId) !== String(ctx.userId)) return { ok: false, error: "denied" };
  if (doc.status !== "pending_confirmation") {
    return { ok: false, error: "wrong_state", status: doc.status };
  }
  doc.status = "cancelled";
  doc.cancelledAt = new Date();
  await doc.save().catch(() => null);
  return { ok: true, status: "cancelled" };
}

// ─── Audit helper ───────────────────────────────────────────────────────────
async function persistAudit({
  ctx, conversationId, messageId, toolName, args,
  status, errorCode, latencyMs, permissionCheckPassed, resultPreview,
  isWrite = false,
}) {
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
      isWrite,
    });
  } catch (err) {
    console.error("[AI][audit:AIToolCall]", err.message);
  }
}

module.exports = { run, confirmAction, cancelAction };
