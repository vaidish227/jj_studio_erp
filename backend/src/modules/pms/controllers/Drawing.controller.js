const Drawing = require("../models/Drawing.model");
const Task    = require("../models/Task.model");
const Project = require("../models/Project.model");
const User    = require("../../auth/models/user.model");
const {
  uploadDrawingSchema,
  uploadDrawingFormSchema,
  reviseDrawingSchema,
  approveDrawingSchema,
  rejectDrawingSchema,
} = require("../validator/Drawing.validator");
const { logActivity }    = require("../../../shared/activityLogger");
const mailService        = require("../../mail/service/mail.service");
const whatsappService    = require("../../whatsapp/service/whatsapp.service");
// Phase 2 — Drawing release acknowledgement log
const { writeReleaseLog } = require("./DrawingReleaseLog.controller");
// Phase 4 — Per-drawing PD review enforcement on 3D renders
const Approval = require("../models/Approval.model");
const teamResolver = require("../services/teamResolver");
// Phase 5 — S3-backed drawing storage
const s3Storage = require("../services/s3Storage");

// Accepted MIME types for direct file upload — must match frontend validator.
const ALLOWED_DRAWING_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);
const MAX_DRAWING_BYTES = 20 * 1024 * 1024; // 20 MB

const WORKFLOW_ENGINE_V1 =
  String(process.env.WORKFLOW_ENGINE_V1 || "").toLowerCase() === "true";

/**
 * Returns null if the drawing isn't a 3D render OR has an approved PD review.
 * Otherwise returns a 409-shape rejection payload the caller can send to res.
 */
async function checkPDReviewIfThreeD(drawing) {
  if (!WORKFLOW_ENGINE_V1) return null;
  if (drawing.drawingType !== "3d_render") return null;

  const approved = await Approval.findOne({
    targetType: "drawing",
    targetId: drawing._id,
    approverType: "principal_designer",
    status: "approved",
  }).select("_id").lean();

  if (approved) return null;

  return {
    code: "PD_REVIEW_REQUIRED",
    message:
      "This 3D drawing has not been cleared by Principal Designer. " +
      "Use 'Send to PD' before approving or releasing.",
  };
}

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
 * Compute the next version for (projectId, zoneName, title).
 * Used by both the upload controller AND the /next-version endpoint.
 */
async function nextVersion({ projectId, zoneName, title }) {
  const filter = {
    projectId,
    title: (title || "").trim(),
  };
  // zoneName may be empty for legacy uploads — match on empty/null equally.
  const z = (zoneName || "").trim();
  if (z) filter.zoneName = z;
  else   filter.$or = [{ zoneName: "" }, { zoneName: { $exists: false } }];

  const latest = await Drawing.findOne(filter).sort({ version: -1 }).select("version").lean();
  return latest ? (Number(latest.version) || 0) + 1 : 1;
}

/**
 * @route GET /api/pms/drawing/next-version?projectId=&zoneName=&title=
 * Tiny helper for the upload modal — drives the auto-revision badge.
 */
const getNextVersion = async (req, res) => {
  try {
    const { projectId, zoneName, title } = req.query;
    if (!projectId || !title) {
      return res.status(400).json({ message: "projectId and title are required" });
    }
    const version = await nextVersion({ projectId, zoneName, title });
    res.json({ projectId, zoneName: zoneName || "", title, version });
  } catch (err) {
    console.error("[getNextVersion]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route POST /api/pms/drawing/upload
 *
 * Two modes:
 *  1) multipart/form-data with a `file` part → multer captures it in memory,
 *     we validate type/size, stream to S3, then persist the Drawing doc.
 *  2) application/json with `fileUrl` → legacy URL-paste flow (still works
 *     if S3 isn't configured or someone is pointing at Drive / external).
 */
const uploadDrawing = async (req, res) => {
  try {
    // ── Mode 1: multipart with file
    if (req.file) {
      // Multer rejected the file? It'd be in fileFilterError on the request.
      if (req.fileFilterError) {
        return res.status(400).json({ message: req.fileFilterError });
      }

      const { error, value } = uploadDrawingFormSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
      }

      // Mime + size guards (multer already does size, but double-check)
      if (!ALLOWED_DRAWING_MIME.has(req.file.mimetype)) {
        return res.status(400).json({
          message: `Unsupported file type "${req.file.mimetype}". Allowed: PDF, JPEG, PNG.`,
        });
      }
      if (req.file.size > MAX_DRAWING_BYTES) {
        return res.status(400).json({
          message: `File too large (${(req.file.size / 1048576).toFixed(2)} MB). Max 20 MB.`,
        });
      }

      // Resolve the project so we can use its trackingId in the S3 key.
      const project = await Project.findById(value.projectId).select("trackingId").lean();
      if (!project) return res.status(404).json({ message: "Project not found" });

      const version = await nextVersion({
        projectId: value.projectId,
        zoneName:  value.zoneName,
        title:     value.title,
      });

      if (!s3Storage.isConfigured()) {
        return res.status(503).json({
          message:
            "Drawing storage is not configured. Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET in backend/.env, then restart the server.",
        });
      }

      const s3Key = s3Storage.buildDrawingKey({
        projectTrackingId: project.trackingId || String(project._id),
        zoneName:          value.zoneName || "general",
        designName:        value.title,
        version,
        originalFilename:  req.file.originalname,
      });

      const put = await s3Storage.putObject({
        key:         s3Key,
        body:        req.file.buffer,
        contentType: req.file.mimetype,
      });

      const docPayload = {
        projectId:     value.projectId,
        taskId:        value.taskId || undefined,
        title:         value.title,
        zoneName:      (value.zoneName || "").trim(),
        description:   (value.description || "").trim(),
        drawingType:   value.drawingType || "plan",
        fileUrl:       put.url,
        fileName:      req.file.originalname,
        fileType:      req.file.mimetype,
        fileSize:      req.file.size,
        s3Bucket:      put.bucket,
        s3Key:         put.key,
        version,
        revisionNotes: (value.revisionNotes || "").trim(),
        notes:         (value.notes || "").trim(),
        uploadedBy:    req.user._id,
        status:        "draft",
      };
      const drawing = await Drawing.create(docPayload);

      logActivity({
        projectId:   drawing.projectId,
        actorId:     req.user._id,
        entityType:  "drawing",
        entityId:    drawing._id,
        action:      "created",
        description: `Drawing "${drawing.title}" v${version} uploaded`,
      });

      return res.status(201).json({
        message: version > 1 ? `Drawing version v${version} uploaded` : "Drawing uploaded successfully",
        drawing,
      });
    }

    // ── Mode 2: JSON body with fileUrl (legacy / external links)
    const { error, value } = uploadDrawingSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }
    if (!value.taskId) delete value.taskId;

    const version = await nextVersion({
      projectId: value.projectId,
      zoneName:  value.zoneName,
      title:     value.title,
    });
    const drawing = await Drawing.create({
      ...value,
      zoneName:    (value.zoneName || "").trim(),
      description: (value.description || "").trim(),
      version,
      uploadedBy: req.user._id,
      status: "draft",
    });

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
 * @route GET /api/pms/drawing/:id/download
 * @route GET /api/pms/drawing/:id/preview
 *
 * Returns a pre-signed S3 URL valid for 1 hour. The `disposition` controls
 * whether the browser previews inline (PDF / image) or forces a download.
 */
async function signedUrlHandler(req, res, disposition) {
  try {
    const drawing = await Drawing.findById(req.params.id)
      .select("s3Bucket s3Key fileName fileUrl title version revisionHistory")
      .lean();
    if (!drawing) return res.status(404).json({ message: "Drawing not found" });

    // Optional ?historyVersion=N → sign a past revision instead of the current
    // file. Useful for revision-history viewers in the UI.
    const historyVersionRaw = req.query.historyVersion;
    const historyVersion    = historyVersionRaw != null ? Number(historyVersionRaw) : null;

    let sourceFileUrl  = drawing.fileUrl;
    let sourceFileName = drawing.fileName;
    let sourceVersion  = drawing.version;
    let sourceS3Bucket = drawing.s3Bucket;
    let sourceS3Key    = drawing.s3Key;

    if (historyVersion != null && Number.isFinite(historyVersion)) {
      // Current version requested via historyVersion → fall through to the
      // normal path (no special handling needed).
      if (historyVersion !== drawing.version) {
        const entry = (drawing.revisionHistory || [])
          .find((e) => Number(e.version) === historyVersion);
        if (!entry || !entry.fileUrl) {
          return res.status(404).json({ message: `No file stored for version v${historyVersion}` });
        }
        sourceFileUrl  = entry.fileUrl;
        sourceFileName = entry.fileName || sourceFileName;
        sourceVersion  = entry.version;
        // Historical entries pre-date the s3Key field — always resolve via URL.
        sourceS3Bucket = undefined;
        sourceS3Key    = undefined;
      }
    }

    if (!sourceFileUrl && !sourceS3Key) {
      return res.status(404).json({ message: "Drawing has no stored file" });
    }

    // Resolve { bucket, key } in this order:
    //   1. Use s3Key on the doc if present (fast path, current version only).
    //   2. Otherwise parse the fileUrl — covers drawings that were uploaded
    //      before the s3Key/s3Bucket fields were added to the schema, AND
    //      every historical revisionHistory entry.
    //   3. Fall back to returning fileUrl as-is (legacy external links —
    //      e.g. someone pasted a Google Drive URL).
    let bucket = sourceS3Bucket;
    let key    = sourceS3Key;

    if (!key) {
      const parsed = s3Storage.parseS3Url(sourceFileUrl);
      if (parsed) {
        bucket = parsed.bucket;
        key    = parsed.key;
        // Backfill the document so subsequent requests skip the parse step.
        // Only safe to backfill when serving the CURRENT file — never write
        // a historical key onto the doc.
        if (historyVersion == null || historyVersion === drawing.version) {
          Drawing.updateOne(
            { _id: drawing._id },
            { $set: { s3Bucket: parsed.bucket, s3Key: parsed.key } }
          ).catch((err) => console.error("[signedUrlHandler:backfill]", err.message));
        }
      }
    }

    if (!key) {
      // Not an S3 URL — hand back the original fileUrl (Drive / external link).
      return res.json({ url: sourceFileUrl, source: "legacy" });
    }

    if (!s3Storage.isConfigured()) {
      return res.status(503).json({ message: "Drawing storage is not configured" });
    }

    const friendlyName = sourceFileName ||
      `${(drawing.title || "drawing").replace(/[^a-zA-Z0-9_-]+/g, "_")}-v${sourceVersion || 1}`;

    const url = await s3Storage.getSignedDownloadUrl({
      key,
      disposition,
      filename:  friendlyName,
      expiresIn: 3600,
    });

    res.json({ url, source: "s3", bucket, key, expiresIn: 3600 });
  } catch (err) {
    console.error("[signedUrlHandler]", err);
    res.status(500).json({ message: err.message });
  }
}

const downloadDrawing = (req, res) => signedUrlHandler(req, res, "attachment");
const previewDrawing  = (req, res) => signedUrlHandler(req, res, "inline");

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

    // Phase 4 — Per-drawing PD review gate: 3D drawings must have an approved
    // PD review before they can be approved for client/release.
    const pre = await Drawing.findById(req.params.id).select("drawingType").lean();
    if (pre) {
      const blocker = await checkPDReviewIfThreeD(pre);
      if (blocker) return res.status(409).json(blocker);
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

// Notify every supervisor on the project's dynamic assignments when a
// drawing is released to site.
const notifySupervisorOnRelease = async ({ drawing, actorName }) => {
  if (!drawing.projectId) return;

  const project = await Project.findById(drawing.projectId)
    .select("name trackingId assignments")
    .populate("assignments.responsibilityId", "slug")
    .populate("assignments.users", "name email phone")
    .lean();

  if (!project) return;

  const supervisors = await teamResolver.resolveBySlug(project, "supervisor");
  if (!supervisors.length) return;

  const subject   = `Drawing Released to Site — ${drawing.title}`;
  const waMessage =
    `*Drawing Released to Site — JJ Studio ERP*\n\n` +
    `*Drawing:* ${drawing.title} (v${drawing.version})\n` +
    `*Project:* ${project.name} (${project.trackingId})\n` +
    `*Released by:* ${actorName}\n\n` +
    `Please proceed with site distribution as per the release checklist.`;

  for (const supervisor of supervisors) {
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

    // Phase 4 — Per-drawing PD review enforcement at the release boundary too.
    const blocker = await checkPDReviewIfThreeD(drawing);
    if (blocker) return res.status(409).json(blocker);

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

    // Phase 2 — Write release log for acknowledgement tracking (best-effort).
    writeReleaseLog({ drawing: updated, releasedBy }).catch(() => {});

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
  getNextVersion,
  downloadDrawing,
  previewDrawing,
};
