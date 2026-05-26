const Drawing = require("../models/Drawing.model");
const Task    = require("../models/Task.model");
const Project = require("../models/Project.model");
const User    = require("../../auth/models/user.model");
const {
  uploadDrawingSchema,
  reviseDrawingSchema,
  approveDrawingSchema,
  rejectDrawingSchema,
} = require("../validator/Drawing.validator");
const { logActivity }    = require("../../../shared/activityLogger");
const mailService        = require("../../mail/service/mail.service");
const whatsappService    = require("../../whatsapp/service/whatsapp.service");

const POPULATE_UPLOADER = { path: "uploadedBy", select: "name email" };
const POPULATE_APPROVER  = { path: "approvedBy",  select: "name email" };
const POPULATE_RELEASER  = { path: "releasedBy",  select: "name email" };
const POPULATE_REJECTER  = { path: "rejectedBy",  select: "name email" };

// Fire-and-forget notification to the designer who uploaded the drawing.
const notifyDrawingEvent = async ({ drawing, event, notes, actorName }) => {
  if (!drawing.uploadedBy) return;

  const uploader = await User.findById(drawing.uploadedBy).select("email phone").lean();
  if (!uploader) return;

  const isApproved  = event === "approved";
  const statusLabel = isApproved ? "Approved" : "Revision Required";
  const subject     = `Drawing ${statusLabel}: ${drawing.title}`;
  const statusColor = isApproved ? "#27AE60" : "#E74C3C";

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#1a1a2e">Drawing ${statusLabel}</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px;font-weight:bold;color:#555">Drawing</td><td style="padding:8px">${drawing.title} (v${drawing.version})</td></tr>
        <tr style="background:#f8f8f8"><td style="padding:8px;font-weight:bold;color:#555">Status</td>
          <td style="padding:8px;font-weight:bold;color:${statusColor}">${statusLabel}</td></tr>
        ${notes ? `<tr><td style="padding:8px;font-weight:bold;color:#555">Notes</td><td style="padding:8px">${notes}</td></tr>` : ""}
        <tr style="background:#f8f8f8"><td style="padding:8px;font-weight:bold;color:#555">Reviewed By</td><td style="padding:8px">${actorName}</td></tr>
      </table>
      <p style="color:#888;font-size:12px;margin-top:24px">Please log in to JJ Studio ERP to view full drawing details.</p>
    </div>
  `;

  const waMessage =
    `*Drawing ${statusLabel} — JJ Studio ERP*\n\n` +
    `*Drawing:* ${drawing.title} (v${drawing.version})\n` +
    `*Status:* ${statusLabel}\n` +
    `${notes ? `*Notes:* ${notes}\n` : ""}` +
    `*Reviewed by:* ${actorName}\n\n` +
    `Please check JJ Studio ERP for full details.`;

  if (uploader.email) {
    try {
      await mailService.sendImmediate({
        to: uploader.email, subject, html,
        relatedTo: { module: "pms", recordId: drawing._id },
        createdBy: null,
      });
    } catch (e) { console.error("[drawingNotify:mail]", e.message); }
  }

  if (uploader.phone) {
    try {
      await whatsappService.sendImmediate({
        to: uploader.phone, message: waMessage,
        relatedTo: { module: "pms", recordId: drawing._id },
        createdBy: null,
      });
    } catch (e) { console.error("[drawingNotify:whatsapp]", e.message); }
  }
};

/**
 * @route POST /api/pms/drawing/upload
 */
const uploadDrawing = async (req, res) => {
  try {
    const { error, value } = uploadDrawingSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    if (!value.taskId) delete value.taskId;

    const uploadedBy = req.user._id;

    // Version auto-increment: find highest version for same title+project
    const latest = await Drawing.findOne({ projectId: value.projectId, title: value.title })
      .sort({ version: -1 })
      .lean();
    const version = latest ? latest.version + 1 : 1;

    const drawing = await Drawing.create({ ...value, version, uploadedBy, status: "draft" });

    logActivity({
      projectId:   drawing.projectId,
      actorId:     req.user._id,
      entityType:  "drawing",
      entityId:    drawing._id,
      action:      "created",
      description: `Drawing "${drawing.title}" v${version} uploaded`,
    });

    res.status(201).json({
      message: version > 1 ? `Drawing version v${version} uploaded` : "Drawing uploaded successfully",
      drawing,
    });
  } catch (error) {
    console.error("[uploadDrawing]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Upload a new version of an existing drawing (archives current into revisionHistory).
 * @route POST /api/pms/drawing/revise/:id
 */
const reviseDrawing = async (req, res) => {
  try {
    const { error, value } = reviseDrawingSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    const existing = await Drawing.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Drawing not found" });
    }

    const uploadedBy = req.user._id;

    const historyEntry = {
      version:    existing.version,
      fileUrl:    existing.fileUrl,
      fileName:   existing.fileName,
      uploadedBy: existing.uploadedBy,
      uploadedAt: existing.updatedAt,
      notes:      existing.revisionNotes,
    };

    const newVersion = existing.version + 1;

    const updated = await Drawing.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          fileUrl:           value.fileUrl,
          fileName:          value.fileName  || existing.fileName,
          fileType:          value.fileType  || existing.fileType,
          fileSize:          value.fileSize  || existing.fileSize,
          version:           newVersion,
          revisionNotes:     value.revisionNotes,
          checklistSnapshot: value.checklistSnapshot || existing.checklistSnapshot,
          uploadedBy,
          status:            "draft",
          approvedBy:        null,
          approvalDate:      null,
          rejectedBy:        null,
          rejectedAt:        null,
          rejectionReason:   null,
          isReleased:        false,
          releasedAt:        null,
          releasedBy:        null,
        },
        $push: { revisionHistory: historyEntry },
      },
      { new: true }
    );

    res.status(200).json({
      message: `Drawing revised to v${newVersion}`,
      drawing: updated,
    });
  } catch (error) {
    console.error("[reviseDrawing]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/drawing/all
 */
const getAllDrawings = async (req, res) => {
  try {
    const { projectId, drawingType, status, uploadedBy, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (projectId)   filter.projectId   = projectId;
    if (drawingType) filter.drawingType = drawingType;
    if (status)      filter.status      = status;
    if (uploadedBy)  filter.uploadedBy  = uploadedBy;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Drawing.countDocuments(filter);

    const drawings = await Drawing.find(filter)
      .populate(POPULATE_UPLOADER)
      .populate(POPULATE_APPROVER)
      .populate(POPULATE_RELEASER)
      .populate(POPULATE_REJECTER)
      .populate({ path: "projectId", select: "name trackingId" })
      .populate({ path: "taskId",    select: "title taskType" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({ total, page: Number(page), count: drawings.length, drawings });
  } catch (error) {
    console.error("[getAllDrawings]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/drawing/pending-approvals
 */
const getPendingApprovals = async (req, res) => {
  try {
    const drawings = await Drawing.find({ status: "sent_for_approval" })
      .populate(POPULATE_UPLOADER)
      .populate({ path: "projectId", select: "name trackingId" })
      .populate({ path: "taskId",    select: "title taskType" })
      .sort({ createdAt: -1 });

    res.status(200).json({ count: drawings.length, drawings });
  } catch (error) {
    console.error("[getPendingApprovals]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/drawing/project/:projectId
 */
const getDrawingsByProject = async (req, res) => {
  try {
    const { drawingType, status } = req.query;
    const filter = { projectId: req.params.projectId };

    if (drawingType) filter.drawingType = drawingType;
    if (status)      filter.status      = status;

    const drawings = await Drawing.find(filter)
      .populate(POPULATE_UPLOADER)
      .populate(POPULATE_APPROVER)
      .populate(POPULATE_RELEASER)
      .populate({ path: "taskId", select: "title taskType" })
      .sort({ createdAt: -1 });

    res.status(200).json({ count: drawings.length, drawings });
  } catch (error) {
    console.error("[getDrawingsByProject]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/drawing/task/:taskId
 */
const getDrawingsByTask = async (req, res) => {
  try {
    const drawings = await Drawing.find({ taskId: req.params.taskId })
      .populate(POPULATE_UPLOADER)
      .populate(POPULATE_APPROVER)
      .sort({ version: -1 });

    res.status(200).json({ count: drawings.length, drawings });
  } catch (error) {
    console.error("[getDrawingsByTask]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PATCH /api/pms/drawing/send-for-approval/:id
 */
const sendForApproval = async (req, res) => {
  try {
    const drawing = await Drawing.findById(req.params.id);
    if (!drawing) {
      return res.status(404).json({ message: "Drawing not found" });
    }

    if (drawing.status !== "draft" && drawing.status !== "rejected") {
      return res.status(400).json({
        message: `Cannot send for approval — current status is "${drawing.status}"`,
      });
    }

    drawing.status          = "sent_for_approval";
    drawing.rejectedBy      = undefined;
    drawing.rejectedAt      = undefined;
    drawing.rejectionReason = undefined;
    if (req.body.submissionNotes) {
      drawing.submissionNotes = req.body.submissionNotes;
    }
    await drawing.save();

    res.status(200).json({ message: "Drawing sent for approval", drawing });
  } catch (error) {
    console.error("[sendForApproval]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PATCH /api/pms/drawing/approve/:id
 */
const approveDrawing = async (req, res) => {
  try {
    const { error, value } = approveDrawingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const approvedBy = req.user._id;

    const drawing = await Drawing.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status:       "approved",
          approvedBy,
          approvalDate: new Date(),
          remarks:      value.remarks || "",
        },
      },
      { new: true }
    ).populate(POPULATE_APPROVER);

    if (!drawing) {
      return res.status(404).json({ message: "Drawing not found" });
    }

    logActivity({
      projectId:   drawing.projectId,
      actorId:     req.user._id,
      entityType:  "drawing",
      entityId:    drawing._id,
      action:      "approved",
      description: `Drawing "${drawing.title}" approved`,
    });

    // Notify the designer — fire-and-forget
    notifyDrawingEvent({
      drawing,
      event:     "approved",
      notes:     value.remarks || "",
      actorName: req.user.name || "A reviewer",
    }).catch(() => {});

    res.status(200).json({ message: "Drawing approved", drawing });
  } catch (error) {
    console.error("[approveDrawing]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PATCH /api/pms/drawing/reject/:id
 */
const rejectDrawing = async (req, res) => {
  try {
    const { error, value } = rejectDrawingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const rejectedBy = req.user._id;

    const drawing = await Drawing.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status:          "rejected",
          rejectedBy,
          rejectedAt:      new Date(),
          rejectionReason: value.rejectionReason,
        },
      },
      { new: true }
    ).populate(POPULATE_REJECTER);

    if (!drawing) {
      return res.status(404).json({ message: "Drawing not found" });
    }

    logActivity({
      projectId:   drawing.projectId,
      actorId:     req.user._id,
      entityType:  "drawing",
      entityId:    drawing._id,
      action:      "rejected",
      description: `Drawing "${drawing.title}" rejected — ${value.rejectionReason}`,
    });

    // Notify the designer — fire-and-forget
    notifyDrawingEvent({
      drawing,
      event:     "rejected",
      notes:     value.rejectionReason,
      actorName: req.user.name || "A reviewer",
    }).catch(() => {});

    res.status(200).json({ message: "Drawing rejected", drawing });
  } catch (error) {
    console.error("[rejectDrawing]", error);
    res.status(500).json({ message: error.message });
  }
};

// Notify the project supervisor when a drawing is released to site.
const notifySupervisorOnRelease = async ({ drawing, actorName }) => {
  if (!drawing.projectId) return;

  const project = await Project.findById(drawing.projectId)
    .select("name trackingId supervisor")
    .populate("supervisor", "name email phone")
    .lean();

  if (!project?.supervisor) return;

  const supervisor = project.supervisor;
  const subject    = `Drawing Released to Site — ${drawing.title}`;
  const waMessage  =
    `*Drawing Released to Site — JJ Studio ERP*\n\n` +
    `*Drawing:* ${drawing.title} (v${drawing.version})\n` +
    `*Project:* ${project.name} (${project.trackingId})\n` +
    `*Released by:* ${actorName}\n\n` +
    `Please proceed with site distribution as per the release checklist.`;

  if (supervisor.email) {
    try {
      await mailService.sendImmediate({
        to:      supervisor.email,
        subject,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <h2 style="color:#1a1a2e">Drawing Released to Site</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px;font-weight:bold;color:#555">Drawing</td><td style="padding:8px">${drawing.title} (v${drawing.version})</td></tr>
              <tr style="background:#f8f8f8"><td style="padding:8px;font-weight:bold;color:#555">Project</td><td style="padding:8px">${project.name} (${project.trackingId})</td></tr>
              <tr><td style="padding:8px;font-weight:bold;color:#555">Released By</td><td style="padding:8px">${actorName}</td></tr>
            </table>
            <p style="margin-top:16px;color:#333;font-size:13px">Please proceed with site distribution as per the release checklist.</p>
            <p style="color:#888;font-size:12px;margin-top:24px">JJ Studio ERP</p>
          </div>
        `,
        relatedTo: { module: "pms", recordId: drawing._id },
        createdBy: null,
      });
    } catch (e) { console.error("[supervisorNotify:mail]", e.message); }
  }

  if (supervisor.phone) {
    try {
      await whatsappService.sendImmediate({
        to:        supervisor.phone,
        message:   waMessage,
        relatedTo: { module: "pms", recordId: drawing._id },
        createdBy: null,
      });
    } catch (e) { console.error("[supervisorNotify:whatsapp]", e.message); }
  }
};

// 5-item site release checklist — applied to every drawing when released to site.
const SITE_RELEASE_CHECKLIST = [
  { item: "Release complete set of drawings", isCompleted: false },
  { item: "Print in A3/A4 as per design",     isCompleted: false },
  { item: "Release all reference pictures",   isCompleted: false },
  { item: "Release all 3D after rectification if needed", isCompleted: false },
  { item: "3D after written rectification uploaded to DLR", isCompleted: false },
];

/**
 * @route PATCH /api/pms/drawing/release/:id
 */
const releaseDrawing = async (req, res) => {
  try {
    const drawing = await Drawing.findById(req.params.id);
    if (!drawing) {
      return res.status(404).json({ message: "Drawing not found" });
    }

    if (drawing.status !== "approved") {
      return res.status(400).json({
        message: "Only approved drawings can be released to site",
      });
    }

    const releasedBy = req.user._id;

    // Only inject site release checklist if checklistSnapshot is empty
    const checklistSnapshot =
      drawing.checklistSnapshot && drawing.checklistSnapshot.length > 0
        ? drawing.checklistSnapshot
        : SITE_RELEASE_CHECKLIST;

    const updated = await Drawing.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isReleased:        true,
          status:            "released_to_site",
          releasedAt:        new Date(),
          releasedBy,
          checklistSnapshot,
        },
      },
      { new: true }
    ).populate(POPULATE_RELEASER);

    // Propagate released status to parent task
    if (updated.taskId) {
      await Task.findByIdAndUpdate(updated.taskId, { status: "released_to_site" });
    }

    logActivity({
      projectId:   updated.projectId,
      actorId:     req.user._id,
      entityType:  "drawing",
      entityId:    updated._id,
      action:      "released",
      description: `Drawing "${updated.title}" released to site`,
    });

    // Notify supervisor — fire-and-forget
    notifySupervisorOnRelease({
      drawing: updated,
      actorName: req.user.name || "A reviewer",
    }).catch(() => {});

    res.status(200).json({ message: "Drawing released to site", drawing: updated });
  } catch (error) {
    console.error("[releaseDrawing]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route DELETE /api/pms/drawing/delete/:id
 */
const deleteDrawing = async (req, res) => {
  try {
    const drawing = await Drawing.findByIdAndDelete(req.params.id);
    if (!drawing) {
      return res.status(404).json({ message: "Drawing not found" });
    }
    res.status(200).json({ message: "Drawing deleted" });
  } catch (error) {
    console.error("[deleteDrawing]", error);
    res.status(500).json({ message: error.message });
  }
};

const DRAWING_TYPE_LABELS = {
  plan: "Plan", elevation: "Elevation", civil: "Civil",
  electrical: "Electrical", plumbing: "Plumbing",
  technical_detail: "Technical Detail", ac_coordination: "AC Coordination",
  automation: "Automation", kitchen: "Kitchen", bathroom: "Bathroom",
  "3d_render": "3D Render", concept: "Concept",
  material_selection: "Material Selection", site_photo: "Site Photo", other: "Other",
};

/**
 * DLR Sheet — all drawings for a project grouped by type with full details.
 * @route GET /api/pms/drawing/dlr/:projectId
 */
const getDLRSheet = async (req, res) => {
  try {
    const Project = require("../models/Project.model");
    const project = await Project.findById(req.params.projectId)
      .select("name trackingId status")
      .lean();
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const drawings = await Drawing.find({ projectId: req.params.projectId })
      .populate(POPULATE_UPLOADER)
      .populate(POPULATE_APPROVER)
      .populate(POPULATE_RELEASER)
      .populate({ path: "taskId", select: "title taskType" })
      .sort({ drawingType: 1, version: -1 });

    // Group by drawing type
    const typeMap = {};
    for (const d of drawings) {
      const t = d.drawingType || "other";
      if (!typeMap[t]) typeMap[t] = [];
      typeMap[t].push(d);
    }

    const byType = Object.entries(typeMap).map(([type, items]) => ({
      type,
      label: DRAWING_TYPE_LABELS[type] || type,
      count: items.length,
      drawings: items,
    }));

    const summary = {
      total:    drawings.length,
      draft:    drawings.filter((d) => d.status === "draft").length,
      pending:  drawings.filter((d) => d.status === "sent_for_approval").length,
      approved: drawings.filter((d) => d.status === "approved").length,
      rejected: drawings.filter((d) => d.status === "rejected").length,
      released: drawings.filter((d) => d.status === "released_to_site").length,
    };

    res.status(200).json({
      project: { _id: project._id, name: project.name, trackingId: project.trackingId, status: project.status },
      summary,
      byType,
    });
  } catch (error) {
    console.error("[getDLRSheet]", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  uploadDrawing,
  reviseDrawing,
  getAllDrawings,
  getPendingApprovals,
  getDrawingsByProject,
  getDrawingsByTask,
  sendForApproval,
  approveDrawing,
  rejectDrawing,
  releaseDrawing,
  deleteDrawing,
  getDLRSheet,
};
