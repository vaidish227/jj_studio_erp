const DelegationActivity = require("../models/DelegationActivity.model");

/**
 * Fire-and-forget activity logger for delegation events.
 * Never throws — a logging failure must never block the main request.
 * Mirrors shared/activityLogger.js (PMS).
 */
const logDelegationActivity = async ({
  delegationId,
  actorId,
  action,
  description,
  metadata = {},
}) => {
  try {
    await DelegationActivity.create({
      delegationId,
      actorId,
      action,
      description,
      metadata,
    });
  } catch (err) {
    console.error("[DelegationActivity]", err.message);
  }
};

module.exports = { logDelegationActivity };
