const Approval = require("../models/Approval.model");
const { requestApprovalSchema, respondToApprovalSchema } = require("../validator/Approval.validator");
const workflowEngine = require("../services/workflowEngine");

const WORKFLOW_ENGINE_V1 =
  String(process.env.WORKFLOW_ENGINE_V1 || "").toLowerCase() === "true";

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
    const query = { approverId: req.params.userId };
    if (req.query.status) query.status = req.query.status;

    const approvals = await Approval.find(query)
      .populate("projectId",   "name trackingId")
      .populate("requestedBy", "name")
      .sort({ createdAt: -1 });

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

    // Phase 2 — Workflow Engine cascade.
    // When a principal_designer approval (with a linked gateId) is approved,
    // trigger gate closure. Hybrid gates (principal_and_client) also flow through here.
    let cascade = null;
    if (
      WORKFLOW_ENGINE_V1 &&
      value.status === "approved" &&
      approval.approverType === "principal_designer" &&
      approval.gateId
    ) {
      try {
        cascade = await workflowEngine.onPrincipalDesignerResponse({
          projectId: approval.projectId,
          gateId: approval.gateId,
          approvalStatus: "approved",
          actorId: req.user?._id,
        });
      } catch (engineErr) {
        console.error("[respondToApproval:engine]", engineErr);
      }
    }

    res.status(200).json({ message: `Request marked as ${value.status}`, approval, cascade });
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
