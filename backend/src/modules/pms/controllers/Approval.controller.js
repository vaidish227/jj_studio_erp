const Approval = require("../models/Approval.model");
const { requestApprovalSchema, respondToApprovalSchema } = require("../validator/Approval.validator");

/**
 * @route POST /api/pms/approval/request
 */
const requestApproval = async (req, res) => {
  try {
    const { error, value } = requestApprovalSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    if (!value.approverId) delete value.approverId;

    const approval = await Approval.create(value);
    res.status(201).json({ message: "Approval request created", approval });
  } catch (error) {
    console.error("[requestApproval]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/approval/project/:projectId
 */
const getProjectApprovals = async (req, res) => {
  try {
    const approvals = await Approval.find({ projectId: req.params.projectId })
      .populate("approverId", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({ count: approvals.length, approvals });
  } catch (error) {
    console.error("[getProjectApprovals]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/approval/pending/:userId
 */
const getPendingApprovals = async (req, res) => {
  try {
    const approvals = await Approval.find({
      approverId: req.params.userId,
      status: "pending",
    }).populate("projectId", "name trackingId");

    res.status(200).json({ count: approvals.length, approvals });
  } catch (error) {
    console.error("[getPendingApprovals]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PATCH /api/pms/approval/respond/:id
 */
const respondToApproval = async (req, res) => {
  try {
    const { error, value } = respondToApprovalSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    const approval = await Approval.findByIdAndUpdate(
      req.params.id,
      { $set: { ...value, respondedAt: new Date() } },
      { new: true }
    );

    if (!approval) {
      return res.status(404).json({ message: "Approval request not found" });
    }

    res.status(200).json({ message: `Request marked as ${value.status}`, approval });
  } catch (error) {
    console.error("[respondToApproval]", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  requestApproval,
  getProjectApprovals,
  respondToApproval,
  getPendingApprovals,
};
