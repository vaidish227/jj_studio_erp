/**
 * kitEvents — the thin, controller-facing entry point for the trigger system.
 *
 * Business controllers call kitEvents.emit() at state-change points. It is
 * FIRE-AND-FORGET: it never blocks or throws into the caller (mirrors the
 * activityLogger pattern), so adding an emit to a controller can never break
 * the originating request.
 *
 * Usage:
 *   const kitEvents = require("../../kit/services/kitEvents");
 *   kitEvents.emit("lead.created", {
 *     sourceModule: "crm",
 *     entityType:   "lead",
 *     entityId:     lead._id,
 *     payload:      { status: lead.status },   // extra fields for IF conditions
 *     actor:        req.user,
 *   });
 */
const triggerService = require("./triggerService");

const emit = (eventType, payload = {}) => {
  // Defer to a microtask and swallow everything — the caller is never affected.
  Promise.resolve()
    .then(() => triggerService.processEvent({ eventType, ...payload }))
    .catch((err) => console.error("[kitEvents] emit error:", err && err.message));
};

module.exports = { emit };
