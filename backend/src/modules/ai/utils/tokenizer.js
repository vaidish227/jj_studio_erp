// Token counter and history truncator.
// Uses gpt-tokenizer for accuracy; falls back to a 4-chars-per-token heuristic
// if the package is unavailable (so the module still boots cleanly during install).

let encode = null;
try {
  // gpt-tokenizer ships precomputed BPE for cl100k_base — works for gpt-4o family.
  encode = require("gpt-tokenizer").encode;
} catch (_e) {
  encode = null;
}

const HEURISTIC_CHARS_PER_TOKEN = 4;

function count(text) {
  if (!text) return 0;
  if (encode) {
    try {
      return encode(String(text)).length;
    } catch {
      // fall through to heuristic
    }
  }
  return Math.ceil(String(text).length / HEURISTIC_CHARS_PER_TOKEN);
}

function countMessage(message) {
  // OpenAI billing: ~3 tokens overhead per message + role + content + tool_calls.
  let total = 4;
  if (message.role) total += count(message.role);
  if (typeof message.content === "string") total += count(message.content);
  if (Array.isArray(message.tool_calls)) {
    for (const tc of message.tool_calls) {
      total += count(tc?.function?.name || "");
      total += count(typeof tc?.function?.arguments === "string"
        ? tc.function.arguments
        : JSON.stringify(tc?.function?.arguments || {}));
    }
  }
  return total;
}

/**
 * Truncate a chronological list of OpenAI-format messages to fit a token budget.
 * Always preserves the latest user message. Drops oldest non-system turns first.
 * If a tool message is kept, the assistant message with the matching tool_call_id
 * must also be kept (or both dropped together) so OpenAI doesn't reject the request.
 */
function fitHistoryToBudget(messages, budgetTokens) {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  // Identify system messages — always keep them.
  const systemMsgs = messages.filter((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");

  // Latest user message must be preserved.
  let latestUserIdx = -1;
  for (let i = nonSystem.length - 1; i >= 0; i--) {
    if (nonSystem[i].role === "user") { latestUserIdx = i; break; }
  }

  const mustKeepSet = new Set();
  if (latestUserIdx >= 0) mustKeepSet.add(latestUserIdx);

  // Compute starting cost
  let total = 0;
  for (const m of systemMsgs) total += countMessage(m);
  for (const idx of mustKeepSet) total += countMessage(nonSystem[idx]);

  const includedIdx = new Set(mustKeepSet);

  // Walk newest -> oldest and add whatever still fits.
  for (let i = nonSystem.length - 1; i >= 0; i--) {
    if (includedIdx.has(i)) continue;
    const cost = countMessage(nonSystem[i]);
    if (total + cost > budgetTokens) continue;

    // Pairing rules: if this is a tool message, also need its parent assistant tool_calls msg.
    if (nonSystem[i].role === "tool") {
      const parentIdx = findParentAssistantToolCall(nonSystem, i, nonSystem[i].tool_call_id);
      if (parentIdx === -1 || (!includedIdx.has(parentIdx) && total + cost + countMessage(nonSystem[parentIdx]) > budgetTokens)) {
        continue;
      }
      if (!includedIdx.has(parentIdx)) {
        includedIdx.add(parentIdx);
        total += countMessage(nonSystem[parentIdx]);
      }
    }

    includedIdx.add(i);
    total += cost;
  }

  // Final assembly in original order.
  const kept = nonSystem.filter((_, i) => includedIdx.has(i));
  return [...systemMsgs, ...kept];
}

function findParentAssistantToolCall(messages, toolIdx, toolCallId) {
  for (let i = toolIdx - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant" || !Array.isArray(m.tool_calls)) continue;
    if (m.tool_calls.some((tc) => tc.id === toolCallId)) return i;
  }
  return -1;
}

function truncateString(s, maxChars) {
  if (typeof s !== "string") return s;
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + "…";
}

module.exports = { count, countMessage, fitHistoryToBudget, truncateString };
