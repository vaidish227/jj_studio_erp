/**
 * conditionEvaluator — evaluates a workflow's IF conditions against a context.
 *
 * Semantics: AND across all conditions (every condition must pass). An empty
 * condition list is vacuously true (fire unconditionally).
 *
 * Context is a flat-ish object built by triggerService: the event payload merged
 * with the resolved entity variables (e.g. { status, proposal_status,
 * client_name, days_since_sent, ... }). Fields support dot-paths.
 */

const getPath = (obj, path) =>
  String(path).split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);

const num = (v) => (v === "" || v === null || v === undefined ? NaN : Number(v));

const OPERATORS = {
  eq:       (a, b) => a === b || String(a) === String(b),
  ne:       (a, b) => !(a === b || String(a) === String(b)),
  gt:       (a, b) => num(a) > num(b),
  gte:      (a, b) => num(a) >= num(b),
  lt:       (a, b) => num(a) < num(b),
  lte:      (a, b) => num(a) <= num(b),
  in:       (a, b) => (Array.isArray(b) ? b : String(b).split(",").map((s) => s.trim())).map(String).includes(String(a)),
  nin:      (a, b) => !(Array.isArray(b) ? b : String(b).split(",").map((s) => s.trim())).map(String).includes(String(a)),
  contains: (a, b) => String(a ?? "").toLowerCase().includes(String(b ?? "").toLowerCase()),
  exists:   (a, b) => {
    const want = b === true || b === "true" || b === undefined; // default: must exist
    const present = a !== undefined && a !== null && a !== "";
    return want ? present : !present;
  },
};

/** evaluateOne — single condition against the context. */
const evaluateOne = (condition, context) => {
  if (!condition || !condition.operator) return true;
  const fn = OPERATORS[condition.operator];
  if (!fn) return true; // unknown operator → don't block
  return !!fn(getPath(context, condition.field), condition.value);
};

/** evaluate — AND across all conditions. */
const evaluate = (conditions = [], context = {}) => {
  if (!Array.isArray(conditions) || conditions.length === 0) return true;
  return conditions.every((c) => evaluateOne(c, context));
};

module.exports = { evaluate, evaluateOne, OPERATORS };
