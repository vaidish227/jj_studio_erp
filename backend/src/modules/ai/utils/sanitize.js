// Defensive sanitizer for tool outputs and user-provided values that flow into
// (a) the LLM context, (b) Mongo queries, (c) audit logs. The goals are:
//   - cap string sizes so a malicious or oversized field can't bloat context or storage
//   - strip Mongo operator keys ($where, $expr, etc.) that could leak through if we
//     ever forwarded user-controlled args into a query unsanitized
//   - drop prototype-pollution keys
const { truncateString } = require("./tokenizer");

const DEFAULT_STRING_CAP = 2000;
const DEFAULT_DEPTH = 6;
const BAD_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const OPERATOR_KEY = (k) => typeof k === "string" && k.startsWith("$");

function sanitize(value, opts = {}) {
  const stringCap = opts.stringCap ?? DEFAULT_STRING_CAP;
  const maxDepth  = opts.maxDepth  ?? DEFAULT_DEPTH;
  const stripOperators = opts.stripOperators ?? true;
  return walk(value, 0, { stringCap, maxDepth, stripOperators });
}

function walk(value, depth, opts) {
  if (value == null) return value;
  if (depth > opts.maxDepth) return undefined;

  const t = typeof value;
  if (t === "string") return truncateString(value, opts.stringCap);
  if (t === "number" || t === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  // Mongoose ObjectId, etc.
  if (value && typeof value.toString === "function" && t === "object" && value.constructor?.name === "ObjectId") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((v) => walk(v, depth + 1, opts)).filter((v) => v !== undefined);
  }

  if (t === "object") {
    const out = {};
    for (const k of Object.keys(value)) {
      if (BAD_KEYS.has(k)) continue;
      if (opts.stripOperators && OPERATOR_KEY(k)) continue;
      const v = walk(value[k], depth + 1, opts);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }

  return undefined;
}

/**
 * Produce a short text preview of a tool result for AIToolCall.resultPreview.
 * Caps total length at ~2000 chars regardless of structure depth.
 */
function previewForAudit(value, maxChars = 2000) {
  try {
    const safe = sanitize(value, { stringCap: 200, maxDepth: 4 });
    const s = JSON.stringify(safe);
    return truncateString(s, maxChars);
  } catch {
    return "";
  }
}

module.exports = { sanitize, previewForAudit };
