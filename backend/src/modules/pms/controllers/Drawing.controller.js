const Drawing = require("../models/Drawing.model");
const Task = require("../models/Task.model");
const {
  uploadDrawingSchema,
  reviseDrawingSchema,
  approveDrawingSchema,
  rejectDrawingSchema,
} = require("../validator/Drawing.validator");
const { logActivity } = require("../../../shared/activityLogger");

const POPULATE_UPLOADER = { path: "uploadedBy", select: "name email" };
const POPULATE_APPROVER  = { path: "approvedBy",  select: "name email" };
const POPULATE_RELEASER  = { path: "releasedBy",  select: "name email" };
const POPULATE_REJECTER  = { path: "rejectedBy",  select: "name email" };

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

    res.status(200).json({ message: "Drawing rejected", drawing });
  } catch (error) {
    console.error("[rejectDrawing]", error);
    res.status(500).json({ message: error.message });
  }
};

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

    const updated = await Drawing.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isReleased: true,
          status:     "released_to_site",
          releasedAt: new Date(),
          releasedBy,
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
};
