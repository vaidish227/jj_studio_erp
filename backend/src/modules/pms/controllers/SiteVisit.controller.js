const SiteVisit = require("../models/SiteVisit.model");
const { createSiteVisitSchema, updateSiteVisitSchema } = require("../validator/SiteVisit.validator");

/**
 * @route POST /api/pms/sitevisit/create
 */
const createSiteVisit = async (req, res) => {
  try {
    const { error, value } = createSiteVisitSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    const siteVisit = await SiteVisit.create(value);

    res.status(201).json({ message: "Site visit recorded successfully", siteVisit });
  } catch (error) {
    console.error("[createSiteVisit]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/sitevisit/project/:projectId
 */
const getProjectVisits = async (req, res) => {
  try {
    const visits = await SiteVisit.find({ projectId: req.params.projectId })
      .populate("visitorId", "name email")
      .sort({ visitDate: -1 });

    res.status(200).json({ count: visits.length, visits });
  } catch (error) {
    console.error("[getProjectVisits]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PUT /api/pms/sitevisit/update/:id
 */
const updateSiteVisit = async (req, res) => {
  try {
    const { error, value } = updateSiteVisitSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    const visit = await SiteVisit.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    ).populate("visitorId", "name email");

    if (!visit) {
      return res.status(404).json({ message: "Site visit record not found" });
    }

    res.status(200).json({ message: "Site visit updated", visit });
  } catch (error) {
    console.error("[updateSiteVisit]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route DELETE /api/pms/sitevisit/delete/:id
 */
const deleteSiteVisit = async (req, res) => {
  try {
    const visit = await SiteVisit.findByIdAndDelete(req.params.id);
    if (!visit) {
      return res.status(404).json({ message: "Site visit record not found" });
    }
    res.status(200).json({ message: "Site visit deleted" });
  } catch (error) {
    console.error("[deleteSiteVisit]", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createSiteVisit,
  getProjectVisits,
  updateSiteVisit,
  deleteSiteVisit,
};
