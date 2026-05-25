const PMSActivityLog = require("../modules/pms/models/PMSActivityLog.model");

/**
 * Fire-and-forget activity logger for PMS events.
 * Never throws — a logging failure must never block the main request.
 */
const logActivity = async ({
  projectId,
  actorId,
  entityType,
  entityId,
  action,
  description,
  metadata = {},
}) => {
  try {
    await PMSActivityLog.create({
      projectId,
      actorId,
      entityType,
      entityId,
      action,
      description,
      metadata,
    });
  } catch (err) {
    console.error("[ActivityLog]", err.message);
  }
};

module.exports = { logActivity };
