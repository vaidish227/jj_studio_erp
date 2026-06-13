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
 * Repair tool_call/tool-response consistency in a chronological message list so
 * OpenAI never rejects the request. OpenAI requires every assistant `tool_calls`
 * entry to be answered by a `tool` message, and every `tool` message to point at
 * a real assistant tool_call. Persisted history can violate this if a turn was
 * interrupted (client disconnect mid tool-loop) or a tool result was dropped —
 * which otherwise poisons every future turn in that conversation.
 *
 * Repairs:
 *   - drop assistant tool_call entries that were never answered by a tool message
 *   - drop the whole assistant message if that leaves it empty (no content, no calls)
 *   - drop orphan tool messages whose tool_call_id has no surviving assistant call
 */
function sanitizeToolPairs(messages) {
  if (!Array.isArray(messages)) return [];

  const answered = new Set();
  for (const m of messages) {
    if (m.role === "tool" && m.tool_call_id) answered.add(m.tool_call_id);
  }

  const declared = new Set();
  const out = [];
  for (const m of messages) {
    if (m.role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length) {
      const keptCalls = m.tool_calls.filter((tc) => tc?.id && answered.has(tc.id));
      if (keptCalls.length) {
        keptCalls.forEach((tc) => declared.add(tc.id));
        out.push({ ...m, tool_calls: keptCalls });
      } else if (typeof m.content === "string" && m.content.trim()) {
        // Keep the prose, drop the unanswered tool_calls.
        const { tool_calls, ...rest } = m; // eslint-disable-line no-unused-vars
        out.push(rest);
      }
      // else: empty assistant whose calls were all unanswered → drop entirely
    } else {
      out.push(m);
    }
  }

  return out.filter((m) => !(m.role === "tool" && !declared.has(m.tool_call_id)));
}

/**
 * Truncate a chronological list of OpenAI-format messages to fit a token budget.
 * Always preserves the latest user message. Drops oldest non-system turns first.
 *
 * An assistant message that carries tool_calls travels together with the tool
 * messages that answer it as ONE atomic unit — either the whole unit fits and is
 * kept, or it's dropped together. This prevents a large tool result from being
 * trimmed while its (often empty) parent assistant tool_call survives, which
 * would leave a dangling tool_call that OpenAI rejects with a 400.
 */
function fitHistoryToBudget(messages, budgetTokens) {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  const systemMsgs = messages.filter((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");

  // Group into atomic units: an assistant-with-tool_calls + its following tool
  // replies become a single unit; every other message is its own unit.
  const units = [];
  for (let i = 0; i < nonSystem.length; i++) {
    const m = nonSystem[i];
    if (m.role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length) {
      const group = [m];
      let j = i + 1;
      while (j < nonSystem.length && nonSystem[j].role === "tool") {
        group.push(nonSystem[j]);
        j++;
      }
      units.push(group);
      i = j - 1;
    } else {
      units.push([m]);
    }
  }

  const unitCost = (u) => u.reduce((s, msg) => s + countMessage(msg), 0);

  // The unit containing the latest user message must be preserved.
  let latestUserUnit = -1;
  for (let u = units.length - 1; u >= 0; u--) {
    if (units[u].some((msg) => msg.role === "user")) { latestUserUnit = u; break; }
  }

  let total = 0;
  for (const m of systemMsgs) total += countMessage(m);

  const included = new Set();
  if (latestUserUnit >= 0) {
    included.add(latestUserUnit);
    total += unitCost(units[latestUserUnit]);
  }

  // Walk newest -> oldest, adding whole units that still fit.
  for (let u = units.length - 1; u >= 0; u--) {
    if (included.has(u)) continue;
    const cost = unitCost(units[u]);
    if (total + cost > budgetTokens) continue;
    included.add(u);
    total += cost;
  }

  const kept = [];
  for (let u = 0; u < units.length; u++) {
    if (included.has(u)) kept.push(...units[u]);
  }
  return [...systemMsgs, ...kept];
}

function truncateString(s, maxChars) {
  if (typeof s !== "string") return s;
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + "…";
}

module.exports = { count, countMessage, fitHistoryToBudget, sanitizeToolPairs, truncateString };
