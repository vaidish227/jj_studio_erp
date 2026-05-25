const SiteLog = require("../models/SiteLog.model");
const { createSiteLogSchema, updateLogSchema } = require("../validator/SiteLog.validator");

/**
 * @route POST /api/pms/sitelog/create
 * supervisorId is derived from the authenticated user — never from req.body.
 */
const createSiteLog = async (req, res) => {
  try {
    const { error, value } = createSiteLogSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    // Strip empty optional ObjectId fields so Mongoose doesn't cast '' → ObjectId
    if (!value.relatedTaskId)    delete value.relatedTaskId;
    if (!value.relatedDrawingId) delete value.relatedDrawingId;

    const siteLog = await SiteLog.create({
      ...value,
      supervisorId: req.user._id, // always from the authenticated user
    });

    res.status(201).json({ message: "Daily site log submitted successfully", siteLog });
  } catch (error) {
    console.error("[createSiteLog]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/sitelog/project/:projectId
 */
const getProjectLogs = async (req, res) => {
  try {
    const logs = await SiteLog.find({ projectId: req.params.projectId })
      .populate("supervisorId",    "name")
      .populate("relatedTaskId",   "title")
      .populate("relatedDrawingId","title version")
      .sort({ logDate: -1 });

    res.status(200).json({ count: logs.length, logs });
  } catch (error) {
    console.error("[getProjectLogs]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/sitelog/:id
 */
const getLogById = async (req, res) => {
  try {
    const log = await SiteLog.findById(req.params.id)
      .populate("supervisorId", "name")
      .populate("projectId",    "name trackingId");

    if (!log) return res.status(404).json({ message: "Log not found" });
    res.status(200).json({ log });
  } catch (error) {
    console.error("[getLogById]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PUT /api/pms/sitelog/update/:id
 */
const updateLog = async (req, res) => {
  try {
    const { error, value } = updateLogSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    const log = await SiteLog.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true }
    );

    if (!log) return res.status(404).json({ message: "Log not found" });

    res.status(200).json({ message: "Log updated successfully", log });
  } catch (error) {
    console.error("[updateLog]", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createSiteLog, getProjectLogs, getLogById, updateLog };
