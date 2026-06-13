/**
 * PDReview.controller — Phase 2.
 *
 * Reuses the existing Approval model (no new collection).
 *
 * Endpoints (mounted at /api/pms/drawing/:id/pd-review/...):
 *   POST   /:id/pd-review/request  — create a pending Approval(approverType=principal_designer) linked to gate_pd_3d_review
 *   POST   /:id/pd-review/respond  — record PD approval/rejection on the existing pending Approval
 *
 * Rules:
 *   - Applies to drawings whose drawingType is "3d_render" or whose parent task is "3d_render".
 *   - Only one pending PD review per drawing at a time (idempotent retry returns the existing one).
 *   - Approve  → workflowEngine.onPrincipalDesignerResponse (closes gate_pd_3d_review)
 *   - Reject   → drawing.status = rejected with rejectionReason; gate stays open.
 *   - approved_with_changes → drawing.status = rejected (revision flow); gate stays open.
 */

const mongoose = require("mongoose");
const Joi = require("joi");
const Drawing = require("../models/Drawing.model");
const Task = require("../models/Task.model");
const Approval = require("../models/Approval.model");
const ApprovalGate = require("../models/ApprovalGate.model");
const workflowEngine = require("../services/workflowEngine");
const { logActivity } = require("../../../shared/activityLogger");

let notify = () => {};
try {
  ({ dispatch: notify } = require("../../notifications/services/notificationDispatcher"));
} catch (e) { /* optional */ }

const OID = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const requestSchema = Joi.object({
  reviewerId: OID.allow("", null).optional(),
  notes:      Joi.string().allow("").optional(),
});

const respondSchema = Joi.object({
  status:    Joi.string().valid("approved", "rejected", "approved_with_changes").required(),
  comments:  Joi.string().allow("").optional(),
  reviewerId: OID.allow("", null).optional(),
});

/** Returns true if the drawing is eligible for PD review (3D render). */
async function isPDReviewEligible(drawing) {
  if (drawing.drawingType === "3d_render") return true;
  if (drawing.taskId) {
    const task = await Task.findById(drawing.taskId).select("taskType").lean();
    if (task?.taskType === "3d_render") return true;
  }
  return false;
}

/**
 * @route POST /api/pms/drawing/:id/pd-review/request
 */
const requestPDReview = async (req, res) => {
  try {
    const { error, value } = requestSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

    const drawing = await Drawing.findById(req.params.id);
    if (!drawing) return res.status(404).json({ message: "Drawing not found" });

    if (!(await isPDReviewEligible(drawing))) {
      return res.status(400).json({
        code: "PD_REVIEW_NOT_APPLICABLE",
        message: "Principal Designer review only applies to 3D render drawings.",
      });
    }

    // Find the project's PD review gate (created by workflow seed)
    const gate = await ApprovalGate.findOne({
      projectId: drawing.projectId,
      gateType: "gate_pd_3d_review",
    });

    // Idempotency: return the existing pending approval if one already exists
    const existing = await Approval.findOne({
      projectId: drawing.projectId,
      targetType: "drawing",
      targetId: drawing._id,
      approverType: "principal_designer",
      status: "pending",
    });
    if (existing) {
      return res.status(200).json({
        message: "PD review already requested",
        approval: existing,
        skipped: "already_pending",
      });
    }

    const approval = await Approval.create({
      projectId: drawing.projectId,
      targetType: "drawing",
      targetId: drawing._id,
      approverType: "principal_designer",
      approverId: value.reviewerId || undefined,
      status: "pending",
      gateId: gate?._id,
      comments: value.notes || "",
    });

    try {
      await logActivity({
        projectId: drawing.projectId,
        actorId: req.user._id,
        entityType: "approval",
        entityId: approval._id,
        action: "created",
        description: `PD review requested for drawing "${drawing.title}"`,
        metadata: { drawingId: drawing._id, gateId: gate?._id },
      });
    } catch (e) { /* best-effort */ }

    try {
      notify({
        type: "pd_review.requested",
        module: "pms",
        priority: "high",
        title: `Principal Designer review requested`,
        message: `Drawing "${drawing.title}" needs your review before client meeting.`,
        link: `/drawings/pending-approvals`,
        recipients: value.reviewerId ? [value.reviewerId] : [],
        relatedTo: { module: "pms", recordId: drawing.projectId },
        metadata: { drawingId: drawing._id, approvalId: approval._id, gateId: gate?._id },
      });
    } catch (e) { /* best-effort */ }

    res.status(201).json({ message: "PD review requested", approval, gate });
  } catch (err) {
    console.error("[requestPDReview]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route POST /api/pms/drawing/:id/pd-review/respond
 */
const respondPDReview = async (req, res) => {
  try {
    const { error, value } = respondSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });

    const drawing = await Drawing.findById(req.params.id);
    if (!drawing) return res.status(404).json({ message: "Drawing not found" });

    // Find the latest pending PD approval for this drawing
    const approval = await Approval.findOne({
      projectId: drawing.projectId,
      targetType: "drawing",
      targetId: drawing._id,
      approverType: "principal_designer",
      status: "pending",
    }).sort({ createdAt: -1 });

    if (!approval) {
      return res.status(404).json({
        code: "NO_PENDING_PD_REVIEW",
        message: "No pending PD review for this drawing. Request one first.",
      });
    }

    approval.status = value.status;
    approval.comments = value.comments || approval.comments;
    approval.approverId = value.reviewerId || req.user._id;
    approval.respondedAt = new Date();
    await approval.save();

    // On approve, close the gate via the engine
    let cascadeSummary = null;
    if (value.status === "approved") {
      cascadeSummary = await workflowEngine.onPrincipalDesignerResponse({
        projectId: drawing.projectId,
        gateId: approval.gateId,
        approvalStatus: value.status,
        actorId: req.user._id,
      });

      try {
        notify({
          type: "pd_review.approved",
          module: "pms",
          priority: "high",
          title: `PD review: approved`,
          message: `Drawing "${drawing.title}" cleared by Principal Designer.`,
          link: `/projects/${drawing.projectId}`,
          relatedTo: { module: "pms", recordId: drawing.projectId },
          metadata: { drawingId: drawing._id, gateId: approval.gateId },
        });
      } catch (e) { /* best-effort */ }
    } else {
      // Rejection / approved_with_changes — mark the drawing for revision so the designer iterates.
      drawing.status = "rejected";
      drawing.rejectedBy = req.user._id;
      drawing.rejectedAt = new Date();
      drawing.rejectionReason = value.comments || "Principal Designer requested changes";
      await drawing.save();

      try {
        notify({
          type: "pd_review.rejected",
          module: "pms",
          priority: "high",
          title: `PD review: changes requested`,
          message: drawing.rejectionReason,
          link: `/projects/${drawing.projectId}`,
          relatedTo: { module: "pms", recordId: drawing.projectId },
          metadata: { drawingId: drawing._id, gateId: approval.gateId },
        });
      } catch (e) { /* best-effort */ }
    }

    try {
      await logActivity({
        projectId: drawing.projectId,
        actorId: req.user._id,
        entityType: "approval",
        entityId: approval._id,
        action: value.status === "approved" ? "approved" : "rejected",
        description: `PD review ${value.status} for drawing "${drawing.title}"`,
      });
    } catch (e) { /* best-effort */ }

    res.json({
      message: `PD review ${value.status}`,
      approval,
      drawing,
      cascade: cascadeSummary,
    });
  } catch (err) {
    console.error("[respondPDReview]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route GET /api/pms/drawing/:id/pd-review
 * Returns the latest PD review approval for this drawing (or null).
 * Useful for the DrawingCard UI to render "Send to PD" vs "PD: approved" badge.
 */
const getDrawingPDReview = async (req, res) => {
  try {
    const approval = await Approval.findOne({
      targetType: "drawing",
      targetId: req.params.id,
      approverType: "principal_designer",
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ approval });
  } catch (err) {
    console.error("[getDrawingPDReview]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  requestPDReview,
  respondPDReview,
  getDrawingPDReview,
};
