const PMSActivityLog = require("../models/PMSActivityLog.model");

/**
 * @route GET /api/pms/activity/project/:projectId
 * Returns paginated activity log for a project, newest first.
 */
const getProjectActivity = async (req, res) => {
  try {
    const { page = 1, limit = 30, entityType } = req.query;
    const filter = { projectId: req.params.projectId };

    if (entityType) filter.entityType = entityType;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await PMSActivityLog.countDocuments(filter);

    const logs = await PMSActivityLog.find(filter)
      .populate("actorId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({ total, page: Number(page), count: logs.length, logs });
  } catch (error) {
    console.error("[getProjectActivity]", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getProjectActivity };
