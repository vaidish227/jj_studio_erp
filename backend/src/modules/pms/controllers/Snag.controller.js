const mongoose = require("mongoose");
const Snag = require("../models/Snag.model");
const Project = require("../models/Project.model");
const s3Storage = require("../services/s3Storage");
const { logActivity } = require("../../../shared/activityLogger");
const { createSnagSchema, updateSnagSchema } = require("../validator/Snag.validator");

const { SEVERITIES, STATUSES, MEDIA_KINDS } = Snag;
const POPULATE_CREATOR = { path: "createdBy", select: "name email" };
const CATEGORY = "snag_list";

const CLOSED_STATUSES = new Set(["resolved", "closed"]);

// Per-kind MIME allow-lists — the controller is the authority even though the
// route's multer filter also screens the union.
const MIME_BY_KIND = {
  image: new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]),
  audio: new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "audio/mp4", "audio/aac", "audio/x-m4a"]),
  video: new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska"]),
};

const actorOf = (req) => req.user?.id || req.user?._id;

/**
 * @route GET /api/pms/snag/project/:projectId
 * Query: ?status=&severity=
 * Returns snags (newest first) + per-status counts for the filter badges.
 */
const getProjectSnags = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: "Invalid projectId" });
    }

    const { status, severity } = req.query;
    const filter = { projectId };
    if (status && STATUSES.includes(status))       filter.status = status;
    if (severity && SEVERITIES.includes(severity)) filter.severity = severity;

    const [snags, countRows] = await Promise.all([
      Snag.find(filter).sort({ createdAt: -1 }).populate(POPULATE_CREATOR).lean(),
      Snag.aggregate([
        { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const row of countRows) {
      if (row._id in counts) counts[row._id] = row.count;
    }

    res.json({ count: snags.length, snags, counts });
  } catch (err) {
    console.error("[getProjectSnags]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route POST /api/pms/snag/create
 * Create a snag (metadata only). Media is attached via POST /:id/files.
 */
const createSnag = async (req, res) => {
  try {
    const { error, value } = createSnagSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });
    }

    const project = await Project.findById(value.projectId).select("trackingId name").lean();
    if (!project) return res.status(404).json({ message: "Project not found" });

    const status = value.status || "open";
    const snag = await Snag.create({
      projectId:   value.projectId,
      title:       value.title.trim(),
      issue:       String(value.issue || "").trim(),
      location:    String(value.location || "").trim(),
      area:        String(value.area || "").trim(),
      zone:        String(value.zone || "").trim(),
      severity:    value.severity || "medium",
      status,
      description: String(value.description || "").trim(),
      resolvedAt:  CLOSED_STATUSES.has(status) ? new Date() : undefined,
      createdBy:   actorOf(req),
    });

    logActivity({
      projectId:   snag.projectId,
      actorId:     actorOf(req),
      entityType:  "snag",
      entityId:    snag._id,
      action:      "created",
      description: `Snag "${snag.title}" raised (${snag.severity})`,
    });

    const populated = await Snag.findById(snag._id).populate(POPULATE_CREATOR).lean();
    res.status(201).json({ message: "Snag created", snag: populated });
  } catch (err) {
    console.error("[createSnag]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route POST /api/pms/snag/:id/files
 * Multipart: files[] + kind ("image" | "audio" | "video").
 */
const uploadMedia = async (req, res) => {
  try {
    if (req.fileFilterError) {
      return res.status(400).json({ message: req.fileFilterError });
    }
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ message: "At least one file is required" });
    }

    const kind = MEDIA_KINDS.includes(req.body.kind) ? req.body.kind : null;
    if (!kind) {
      return res.status(400).json({ message: `kind must be one of: ${MEDIA_KINDS.join(", ")}` });
    }
    if (files.some((f) => !MIME_BY_KIND[kind].has(f.mimetype))) {
      return res.status(400).json({ message: `One or more files are not valid ${kind} files` });
    }

    const snag = await Snag.findById(req.params.id);
    if (!snag) return res.status(404).json({ message: "Snag not found" });

    if (!s3Storage.isConfigured()) {
      return res.status(503).json({
        message: "File storage (S3) is not configured. Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and S3_BUCKET.",
      });
    }

    const project = await Project.findById(snag.projectId).select("trackingId").lean();
    const actorId = actorOf(req);

    for (const file of files) {
      const key = s3Storage.buildDocumentKey({
        projectTrackingId: project?.trackingId || String(snag.projectId),
        category:          CATEGORY,
        name:             `${snag.title}-${kind}`,
        originalFilename:  file.originalname,
      });
      const uploaded = await s3Storage.putObject({
        key,
        body: file.buffer,
        contentType: file.mimetype,
      });
      snag.media.push({
        kind,
        fileUrl:  uploaded.url,
        s3Bucket: uploaded.bucket,
        s3Key:    uploaded.key,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        uploadedBy: actorId,
      });
    }

    await snag.save();

    logActivity({
      projectId:   snag.projectId,
      actorId,
      entityType:  "snag",
      entityId:    snag._id,
      action:      "updated",
      description: `${files.length} ${kind}(s) added to snag "${snag.title}"`,
    });

    const populated = await Snag.findById(snag._id).populate(POPULATE_CREATOR).lean();
    res.json({ message: "Media uploaded", snag: populated });
  } catch (err) {
    console.error("[uploadMedia:snag]", err);
    res.status(500).json({ message: err.message });
  }
};

/** Resolve a signed URL for one snag media item. */
async function mediaSignedUrl(req, res, disposition) {
  try {
    const snag = await Snag.findById(req.params.id).select("media").lean();
    if (!snag) return res.status(404).json({ message: "Snag not found" });

    const file = (snag.media || []).find((f) => String(f._id) === req.params.fileId);
    if (!file) return res.status(404).json({ message: "Media not found" });

    let bucket = file.s3Bucket;
    let key    = file.s3Key;
    if (!key) {
      const parsed = s3Storage.parseS3Url(file.fileUrl);
      if (parsed) ({ bucket, key } = parsed);
    }
    if (!key) return res.json({ url: file.fileUrl, source: "legacy" });

    if (!s3Storage.isConfigured()) {
      return res.status(503).json({ message: "File storage is not configured" });
    }

    const url = await s3Storage.getSignedDownloadUrl({
      key,
      disposition,
      filename:  file.fileName || "media",
      expiresIn: 3600,
    });
    res.json({ url, source: "s3", expiresIn: 3600 });
  } catch (err) {
    console.error("[mediaSignedUrl:snag]", err);
    res.status(500).json({ message: err.message });
  }
}

const previewMedia  = (req, res) => mediaSignedUrl(req, res, "inline");
const downloadMedia = (req, res) => mediaSignedUrl(req, res, "attachment");

/**
 * @route DELETE /api/pms/snag/:id/files/:fileId
 * Remove one snag media item (+ its S3 object).
 */
const deleteMedia = async (req, res) => {
  try {
    const snag = await Snag.findById(req.params.id);
    if (!snag) return res.status(404).json({ message: "Snag not found" });

    const file = snag.media.id(req.params.fileId);
    if (!file) return res.status(404).json({ message: "Media not found" });

    if (file.s3Key && s3Storage.isConfigured()) {
      s3Storage.deleteObject({ key: file.s3Key })
        .catch((err) => console.error("[deleteMedia:snag:s3]", err.message));
    }
    file.deleteOne();
    await snag.save();

    const populated = await Snag.findById(snag._id).populate(POPULATE_CREATOR).lean();
    res.json({ message: "Media removed", snag: populated });
  } catch (err) {
    console.error("[deleteMedia:snag]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route PATCH /api/pms/snag/:id
 * Update snag fields. Sets/clears resolvedAt as status crosses resolved/closed.
 */
const updateSnag = async (req, res) => {
  try {
    const { error, value } = updateSnagSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });
    }

    const snag = await Snag.findById(req.params.id);
    if (!snag) return res.status(404).json({ message: "Snag not found" });

    if (value.title       !== undefined) snag.title = value.title.trim();
    if (value.issue       !== undefined) snag.issue = String(value.issue || "").trim();
    if (value.location    !== undefined) snag.location = String(value.location || "").trim();
    if (value.area        !== undefined) snag.area = String(value.area || "").trim();
    if (value.zone        !== undefined) snag.zone = String(value.zone || "").trim();
    if (value.severity    !== undefined) snag.severity = value.severity;
    if (value.description !== undefined) snag.description = String(value.description || "").trim();
    if (value.status      !== undefined) {
      snag.status = value.status;
      if (CLOSED_STATUSES.has(value.status)) {
        if (!snag.resolvedAt) snag.resolvedAt = new Date();
      } else {
        snag.resolvedAt = undefined;
      }
    }

    await snag.save();

    logActivity({
      projectId:   snag.projectId,
      actorId:     actorOf(req),
      entityType:  "snag",
      entityId:    snag._id,
      action:      "updated",
      description: `Snag "${snag.title}" updated (${snag.status})`,
    });

    const populated = await Snag.findById(snag._id).populate(POPULATE_CREATOR).lean();
    res.json({ message: "Snag updated", snag: populated });
  } catch (err) {
    console.error("[updateSnag]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route DELETE /api/pms/snag/:id
 * Delete the snag and cascade-delete its media S3 objects.
 */
const deleteSnag = async (req, res) => {
  try {
    const snag = await Snag.findByIdAndDelete(req.params.id);
    if (!snag) return res.status(404).json({ message: "Snag not found" });

    if (s3Storage.isConfigured()) {
      for (const file of snag.media || []) {
        if (!file.s3Key) continue;
        s3Storage.deleteObject({ key: file.s3Key })
          .catch((err) => console.error("[deleteSnag:s3]", err.message));
      }
    }

    logActivity({
      projectId:   snag.projectId,
      actorId:     actorOf(req),
      entityType:  "snag",
      entityId:    snag._id,
      action:      "deleted",
      description: `Snag "${snag.title}" removed`,
    });

    res.json({ message: "Snag deleted" });
  } catch (err) {
    console.error("[deleteSnag]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getProjectSnags,
  createSnag,
  uploadMedia,
  previewMedia,
  downloadMedia,
  deleteMedia,
  updateSnag,
  deleteSnag,
};
