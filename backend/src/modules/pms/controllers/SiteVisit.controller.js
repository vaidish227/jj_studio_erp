const SiteVisit = require("../models/SiteVisit.model");

/**
 * @desc Create a new Site Visit record (Designer/Manager)
 * @route POST /api/pms/sitevisit/create
 */
const createSiteVisit = async (req, res) => {
  try {
    const { projectId, visitorId, visitDate, purpose, observations, actionsRequired, photos } = req.body;

    const siteVisit = await SiteVisit.create({
      projectId,
      visitorId,
      visitDate,
      purpose,
      observations,
      actionsRequired,
      photos
    });

    res.status(201).json({
      success: true,
      message: "Site visit recorded successfully",
      siteVisit
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Get all Site Visits for a Project
 * @route GET /api/pms/sitevisit/project/:projectId
 */
const getProjectVisits = async (req, res) => {
  try {
    const visits = await SiteVisit.find({ projectId: req.params.projectId })
      .populate("visitorId", "name role")
      .sort({ visitDate: -1 });

    res.status(200).json({
      success: true,
      count: visits.length,
      visits
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Update Site Visit observations
 */
const updateSiteVisit = async (req, res) => {
  try {
    const visit = await SiteVisit.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    if (!visit) return res.status(404).json({ message: "Visit record not found" });

    res.status(200).json({ success: true, visit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Delete Site Visit
 */
const deleteSiteVisit = async (req, res) => {
  try {
    await SiteVisit.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Site visit record deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createSiteVisit,
  getProjectVisits,
  updateSiteVisit,
  deleteSiteVisit
};
