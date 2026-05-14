const Approval = require("../models/Approval.model");

/**
 * @desc Create a new Approval Request
 * @route POST /api/pms/approval/request
 */
const requestApproval = async (req, res) => {
  try {
    const approval = await Approval.create(req.body);
    res.status(201).json({
      success: true,
      message: "Approval request sent",
      approval
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Get all Approvals for a Project
 * @route GET /api/pms/approval/project/:projectId
 */
const getProjectApprovals = async (req, res) => {
  try {
    const approvals = await Approval.find({ projectId: req.params.projectId })
      .populate("approverId", "name role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: approvals.length,
      approvals
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Update Approval Response (Approve/Reject)
 * @route PATCH /api/pms/approval/respond/:id
 */
const respondToApproval = async (req, res) => {
  try {
    const { status, comments, attachments } = req.body;
    
    const approval = await Approval.findByIdAndUpdate(
      req.params.id,
      { 
        $set: { 
          status, 
          comments, 
          attachments, 
          respondedAt: new Date() 
        } 
      },
      { new: true }
    );

    if (!approval) return res.status(404).json({ message: "Approval request not found" });

    res.status(200).json({
      success: true,
      message: `Request marked as ${status}`,
      approval
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Get Pending Approvals for an Approver
 */
const getPendingApprovals = async (req, res) => {
  try {
    const approvals = await Approval.find({ 
      approverId: req.params.userId, 
      status: "pending" 
    }).populate("projectId", "name trackingId");

    res.status(200).json({ success: true, count: approvals.length, approvals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  requestApproval,
  getProjectApprovals,
  respondToApproval,
  getPendingApprovals
};
