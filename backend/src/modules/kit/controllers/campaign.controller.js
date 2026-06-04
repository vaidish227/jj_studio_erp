const KitCampaign     = require("../models/KitCampaign.model");
const KitCampaignStep = require("../models/KitCampaignStep.model");
const KitEnrollment   = require("../models/KitEnrollment.model");
const KitScheduledJob = require("../models/KitScheduledJob.model");
const campaignEngine  = require("../services/campaignEngine");
const {
  createCampaignSchema, updateCampaignSchema,
  createStepSchema, updateStepSchema, reorderSchema, enrollSchema,
} = require("../validators/campaign.validator");

const badRequest = (res, error) =>
  res.status(400).json({ message: error.details.map((d) => d.message).join(", ") });

// ─── Campaigns ────────────────────────────────────────────────────────────────
const createCampaign = async (req, res) => {
  try {
    const { error, value } = createCampaignSchema.validate(req.body);
    if (error) return badRequest(res, error);
    const campaign = await KitCampaign.create({ ...value, createdBy: req.user._id });
    res.status(201).json({ message: "Campaign created", data: campaign });
  } catch (err) {
    console.error("[kit.createCampaign]", err);
    res.status(500).json({ message: err.message });
  }
};

const getCampaigns = async (req, res) => {
  try {
    const { status, audience } = req.query;
    const query = {};
    if (status)   query.status = status;
    if (audience) query.audience = audience;

    const campaigns = await KitCampaign.find(query).sort({ updatedAt: -1 }).lean();

    // Attach step + active-enrollment counts for the list view.
    const ids = campaigns.map((c) => c._id);
    const [stepCounts, enrollCounts] = await Promise.all([
      KitCampaignStep.aggregate([{ $match: { campaignId: { $in: ids } } }, { $group: { _id: "$campaignId", n: { $sum: 1 } } }]),
      KitEnrollment.aggregate([{ $match: { campaignId: { $in: ids }, status: "active" } }, { $group: { _id: "$campaignId", n: { $sum: 1 } } }]),
    ]);
    const stepMap   = Object.fromEntries(stepCounts.map((s) => [String(s._id), s.n]));
    const enrollMap = Object.fromEntries(enrollCounts.map((s) => [String(s._id), s.n]));

    const data = campaigns.map((c) => ({
      ...c,
      stepCount: stepMap[String(c._id)] || 0,
      activeEnrollments: enrollMap[String(c._id)] || 0,
    }));

    res.status(200).json({ message: "Campaigns fetched", data });
  } catch (err) {
    console.error("[kit.getCampaigns]", err);
    res.status(500).json({ message: err.message });
  }
};

const getCampaignById = async (req, res) => {
  try {
    const campaign = await KitCampaign.findById(req.params.id).lean();
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const steps = await KitCampaignStep.find({ campaignId: campaign._id })
      .sort({ order: 1 })
      .populate("templateId", "name channel category")
      .lean();

    res.status(200).json({ message: "Campaign fetched", data: { ...campaign, steps } });
  } catch (err) {
    console.error("[kit.getCampaignById]", err);
    res.status(500).json({ message: err.message });
  }
};

const updateCampaign = async (req, res) => {
  try {
    const { error, value } = updateCampaignSchema.validate(req.body);
    if (error) return badRequest(res, error);

    // Activating requires at least one step.
    if (value.status === "active") {
      const n = await KitCampaignStep.countDocuments({ campaignId: req.params.id });
      if (!n) return res.status(400).json({ message: "Add at least one step before activating the campaign" });
    }

    const campaign = await KitCampaign.findByIdAndUpdate(req.params.id, { $set: value }, { new: true, runValidators: true });
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    res.status(200).json({ message: "Campaign updated", data: campaign });
  } catch (err) {
    console.error("[kit.updateCampaign]", err);
    res.status(500).json({ message: err.message });
  }
};

const deleteCampaign = async (req, res) => {
  try {
    const campaign = await KitCampaign.findByIdAndDelete(req.params.id);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    // Clean up the journey: remove steps, stop active enrollments, cancel jobs.
    const enrollments = await KitEnrollment.find({ campaignId: req.params.id, status: "active" }).select("_id").lean();
    const enrollIds = enrollments.map((e) => e._id);
    await Promise.all([
      KitCampaignStep.deleteMany({ campaignId: req.params.id }),
      KitEnrollment.updateMany({ campaignId: req.params.id, status: "active" }, { $set: { status: "stopped" } }),
      KitScheduledJob.updateMany({ enrollmentId: { $in: enrollIds }, status: "pending" }, { $set: { status: "cancelled" } }),
    ]);

    res.status(200).json({ message: "Campaign deleted" });
  } catch (err) {
    console.error("[kit.deleteCampaign]", err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Steps ────────────────────────────────────────────────────────────────────
const addStep = async (req, res) => {
  try {
    const { error, value } = createStepSchema.validate(req.body);
    if (error) return badRequest(res, error);

    const campaign = await KitCampaign.findById(req.params.id).lean();
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    let order = value.order;
    if (order === undefined) {
      const last = await KitCampaignStep.findOne({ campaignId: campaign._id }).sort({ order: -1 }).lean();
      order = last ? last.order + 1 : 0;
    }

    const step = await KitCampaignStep.create({ ...value, order, campaignId: campaign._id });
    res.status(201).json({ message: "Step added", data: step });
  } catch (err) {
    console.error("[kit.addStep]", err);
    res.status(500).json({ message: err.message });
  }
};

const updateStep = async (req, res) => {
  try {
    const { error, value } = updateStepSchema.validate(req.body);
    if (error) return badRequest(res, error);
    const step = await KitCampaignStep.findOneAndUpdate(
      { _id: req.params.stepId, campaignId: req.params.id },
      { $set: value },
      { new: true, runValidators: true }
    );
    if (!step) return res.status(404).json({ message: "Step not found" });
    res.status(200).json({ message: "Step updated", data: step });
  } catch (err) {
    console.error("[kit.updateStep]", err);
    res.status(500).json({ message: err.message });
  }
};

const deleteStep = async (req, res) => {
  try {
    const step = await KitCampaignStep.findOneAndDelete({ _id: req.params.stepId, campaignId: req.params.id });
    if (!step) return res.status(404).json({ message: "Step not found" });
    res.status(200).json({ message: "Step deleted" });
  } catch (err) {
    console.error("[kit.deleteStep]", err);
    res.status(500).json({ message: err.message });
  }
};

const reorderSteps = async (req, res) => {
  try {
    const { error, value } = reorderSchema.validate(req.body);
    if (error) return badRequest(res, error);
    // Apply the new order index-by-index.
    await Promise.all(
      value.order.map((stepId, idx) =>
        KitCampaignStep.updateOne({ _id: stepId, campaignId: req.params.id }, { $set: { order: idx } })
      )
    );
    const steps = await KitCampaignStep.find({ campaignId: req.params.id }).sort({ order: 1 }).lean();
    res.status(200).json({ message: "Steps reordered", data: steps });
  } catch (err) {
    console.error("[kit.reorderSteps]", err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Enrollment ───────────────────────────────────────────────────────────────
const enroll = async (req, res) => {
  try {
    const { error, value } = enrollSchema.validate(req.body);
    if (error) return badRequest(res, error);

    const result = await campaignEngine.enroll({
      campaignId: req.params.id,
      entityType: value.entityType,
      entityIds:  value.entityIds,
      enrolledBy: req.user._id,
    });
    res.status(200).json({ message: "Enrollment processed", data: result });
  } catch (err) {
    console.error("[kit.enroll]", err);
    res.status(err.message === "Campaign not found" ? 404 : 500).json({ message: err.message });
  }
};

const getEnrollments = async (req, res) => {
  try {
    const { campaignId, entityId, status, page = 1, limit = 50 } = req.query;
    const query = {};
    if (campaignId) query.campaignId = campaignId;
    if (entityId)   query.entityId = entityId;
    if (status)     query.status = status;

    const [enrollments, total] = await Promise.all([
      KitEnrollment.find(query)
        .sort({ updatedAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .populate("campaignId", "name audience")
        .lean(),
      KitEnrollment.countDocuments(query),
    ]);

    res.status(200).json({ message: "Enrollments fetched", data: { enrollments, total } });
  } catch (err) {
    console.error("[kit.getEnrollments]", err);
    res.status(500).json({ message: err.message });
  }
};

const stopEnrollment = async (req, res) => {
  try {
    const enrollment = await KitEnrollment.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "stopped", nextFireAt: null } },
      { new: true }
    );
    if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });
    // Cancel any pending jobs for this enrollment.
    await KitScheduledJob.updateMany({ enrollmentId: enrollment._id, status: "pending" }, { $set: { status: "cancelled" } });
    res.status(200).json({ message: "Enrollment stopped", data: enrollment });
  } catch (err) {
    console.error("[kit.stopEnrollment]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createCampaign, getCampaigns, getCampaignById, updateCampaign, deleteCampaign,
  addStep, updateStep, deleteStep, reorderSteps,
  enroll, getEnrollments, stopEnrollment,
};
