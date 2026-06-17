const { ALLOWED_TRANSITIONS } = require("../validator/delegation.validator");

/**
 * Single source of truth for delegation status transitions (MVP).
 * The transition table lives in the validator; this service enforces it and
 * derives the timestamp side-effects of a transition.
 */

/** Is moving `from` → `to` legal? */
const canTransition = (from, to) =>
  Array.isArray(ALLOWED_TRANSITIONS[from]) && ALLOWED_TRANSITIONS[from].includes(to);

/** Allowed next states from `from` (for 400 error payloads). */
const allowedFrom = (from) => ALLOWED_TRANSITIONS[from] || [];

/**
 * Build the field patch for a status transition, including timestamp effects:
 *   → in_progress : stamp startedAt (first time only)
 *   → completed   : stamp completedAt
 *   → reopened    : clear completedAt
 */
const buildStatusPatch = (delegation, to) => {
  const patch = { status: to };
  if (to === "in_progress" && !delegation.startedAt) patch.startedAt = new Date();
  if (to === "completed") patch.completedAt = new Date();
  if (to === "reopened") patch.completedAt = null;
  return patch;
};

/** Map a target status to the audit-log action verb. */
const actionForStatus = (to) => {
  if (to === "reopened") return "reopened";
  if (to === "cancelled") return "cancelled";
  return "status_changed";
};

module.exports = {
  ALLOWED_TRANSITIONS,
  canTransition,
  allowedFrom,
  buildStatusPatch,
  actionForStatus,
};
