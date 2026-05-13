const SiteLog = require("../models/SiteLog.model");

/**
 * @desc Create a new Daily Site Log (Supervisor Report)
 * @route POST /api/pms/sitelog/create
 */
const createSiteLog = async (req, res) => {
  try {
    const { 
      projectId, 
      supervisorId, 
      logDate, 
      workPerformed, 
      manpowerCount, 
      issuesReported, 
      blockers, 
      sitePhotos,
      relatedTaskId,
      relatedDrawingId
    } = req.body;

    const siteLog = await SiteLog.create({
      projectId,
      supervisorId,
      logDate,
      workPerformed,
      manpowerCount,
      issuesReported,
      blockers,
      sitePhotos,
      relatedTaskId,
      relatedDrawingId
    });

    res.status(201).json({
      success: true,
      message: "Daily site log submitted successfully",
      siteLog
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Get all Site Logs for a Project
 * @route GET /api/pms/sitelog/project/:projectId
 */
const getProjectLogs = async (req, res) => {
  try {
    const logs = await SiteLog.find({ projectId: req.params.projectId })
      .populate("supervisorId", "name")
      .populate("relatedTaskId", "title")
      .populate("relatedDrawingId", "title version")
      .sort({ logDate: -1 });

    res.status(200).json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Get a specific Site Log
 */
const getLogById = async (req, res) => {
  try {
    const log = await SiteLog.findById(req.params.id)
      .populate("supervisorId", "name")
      .populate("projectId", "name trackingId");

    if (!log) return res.status(404).json({ message: "Log not found" });
    res.status(200).json({ success: true, log });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Update Site Log (Manager Review)
 */
const updateLog = async (req, res) => {
  try {
    const log = await SiteLog.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    if (!log) return res.status(404).json({ message: "Log not found" });

    res.status(200).json({
      success: true,
      message: "Log updated successfully",
      log
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createSiteLog,
  getProjectLogs,
  getLogById,
  updateLog
};
