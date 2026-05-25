const DesignRevisionRequest = require("../models/DesignRevisionRequest.model");
const Drawing = require("../models/Drawing.model");
const User = require("../../auth/models/user.model");
const {
  createRevisionRequestSchema,
  resolveRevisionRequestSchema,
} = require("../validator/DesignRevisionRequest.validator");
const { logActivity } = require("../../../shared/activityLogger");
const mailService     = require("../../mail/service/mail.service");
const whatsappService = require("../../whatsapp/service/whatsapp.service");

const notifyRevisionRequest = async ({ revisionRequest, drawing, designerUser, reviewerName }) => {
  const subject = `Revision Requested: ${drawing.title}`;
  const deadlineStr = revisionRequest.deadline
    ? new Date(revisionRequest.deadline).toLocaleDateString("en-IN")
    : "Not specified";

  const itemsHtml = revisionRequest.specificItems?.length
    ? `<ul style="margin:4px 0 0 16px;padding:0">${revisionRequest.specificItems
        .map((i) => `<li style="font-size:13px;color:#333;padding:2px 0">${i}</li>`)
        .join("")}</ul>`
    : "";

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#1a1a2e">Revision Requested on Your Drawing</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px;font-weight:bold;color:#555">Drawing</td><td style="padding:8px">${drawing.title} (v${drawing.version})</td></tr>
        <tr style="background:#f8f8f8"><td style="padding:8px;font-weight:bold;color:#555">Requested By</td><td style="padding:8px">${reviewerName}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;color:#555">Notes</td><td style="padding:8px">${revisionRequest.revisionNotes}</td></tr>
        ${revisionRequest.specificItems?.length ? `<tr style="background:#f8f8f8"><td style="padding:8px;font-weight:bold;color:#555;vertical-align:top">Items to Fix</td><td style="padding:8px">${itemsHtml}</td></tr>` : ""}
        <tr><td style="padding:8px;font-weight:bold;color:#555">Deadline</td><td style="padding:8px">${deadlineStr}</td></tr>
      </table>
      <p style="color:#888;font-size:12px;margin-top:24px">Please log in to JJ Studio ERP to view full details.</p>
    </div>
  `;

  const waMessage =
    `*Revision Requested — JJ Studio ERP*\n\n` +
    `*Drawing:* ${drawing.title} (v${drawing.version})\n` +
    `*Requested by:* ${reviewerName}\n` +
    `*Notes:* ${revisionRequest.revisionNotes}\n` +
    `*Deadline:* ${deadlineStr}\n\n` +
    `Please check JJ Studio ERP for full details.`;

  if (designerUser.email) {
    try {
      await mailService.sendImmediate({
        to:        designerUser.email,
        subject,
        html,
        relatedTo: { module: "pms", recordId: drawing._id },
        createdBy: null,
      });
    } catch (e) {
      console.error("[revisionNotify:mail]", e.message);
    }
  }

  if (designerUser.phone) {
    try {
      await whatsappService.sendImmediate({
        to:        designerUser.phone,
        message:   waMessage,
        relatedTo: { module: "pms", recordId: drawing._id },
        createdBy: null,
      });
    } catch (e) {
      console.error("[revisionNotify:whatsapp]", e.message);
    }
  }
};

/**
 * @route POST /api/pms/design-revisions
 */
const createRevisionRequest = async (req, res) => {
  try {
    const { error, value } = createRevisionRequestSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });
    }

    const drawing = await Drawing.findById(value.drawingId).lean();
    if (!drawing) {
      return res.status(404).json({ message: "Drawing not found" });
    }

    if (!drawing.uploadedBy) {
      return res.status(400).json({ message: "Drawing has no assigned designer" });
    }

    const revisionRequest = await DesignRevisionRequest.create({
      drawingId:     value.drawingId,
      projectId:     drawing.projectId,
      requestedBy:   req.user._id,
      assignedTo:    drawing.uploadedBy,
      revisionNotes: value.revisionNotes,
      specificItems: value.specificItems,
      deadline:      value.deadline || null,
    });

    logActivity({
      projectId:   drawing.projectId,
      actorId:     req.user._id,
      entityType:  "drawing",
      entityId:    drawing._id,
      action:      "revision_requested",
      description: `Revision requested on drawing "${drawing.title}"`,
    });

    // Notify designer — fire-and-forget
    const [designerUser, reviewer] = await Promise.all([
      User.findById(drawing.uploadedBy).select("name email phone").lean(),
      User.findById(req.user._id).select("name").lean(),
    ]);
    if (designerUser) {
      notifyRevisionRequest({
        revisionRequest,
        drawing,
        designerUser,
        reviewerName: reviewer?.name || "A reviewer",
      }).catch(() => {});
    }

    const populated = await DesignRevisionRequest.findById(revisionRequest._id)
      .populate({ path: "requestedBy", select: "name role" })
      .populate({ path: "assignedTo",  select: "name role" })
      .populate({ path: "drawingId",   select: "title version drawingType" });

    res.status(201).json({ message: "Revision request created", revisionRequest: populated });
  } catch (error) {
    console.error("[createRevisionRequest]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/design-revisions/drawing/:drawingId
 */
const getRevisionRequestsByDrawing = async (req, res) => {
  try {
    const revisionRequests = await DesignRevisionRequest.find({
      drawingId: req.params.drawingId,
    })
      .populate({ path: "requestedBy", select: "name role" })
      .populate({ path: "assignedTo",  select: "name role" })
      .sort({ createdAt: -1 });

    res.status(200).json({ count: revisionRequests.length, revisionRequests });
  } catch (error) {
    console.error("[getRevisionRequestsByDrawing]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PATCH /api/pms/design-revisions/:id/resolve
 */
const resolveRevisionRequest = async (req, res) => {
  try {
    const { error, value } = resolveRevisionRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const revisionRequest = await DesignRevisionRequest.findById(req.params.id);
    if (!revisionRequest) {
      return res.status(404).json({ message: "Revision request not found" });
    }

    if (revisionRequest.status === "resolved") {
      return res.status(400).json({ message: "Revision request is already resolved" });
    }

    revisionRequest.status     = "resolved";
    revisionRequest.resolvedAt = new Date();
    if (value.resubmittedDrawingVersion) {
      revisionRequest.resubmittedDrawingVersion = value.resubmittedDrawingVersion;
    }
    await revisionRequest.save();

    res.status(200).json({ message: "Revision request resolved", revisionRequest });
  } catch (error) {
    console.error("[resolveRevisionRequest]", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createRevisionRequest,
  getRevisionRequestsByDrawing,
  resolveRevisionRequest,
};
