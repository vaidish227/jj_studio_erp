const mongoose = require("mongoose");
const MaterialFinalization = require("../models/MaterialFinalization.model");
const Project = require("../models/Project.model");
const s3Storage = require("../services/s3Storage");
const { logActivity } = require("../../../shared/activityLogger");
const {
  createMaterialFinalizationSchema,
  updateMaterialFinalizationSchema,
} = require("../validator/MaterialFinalization.validator");

const POPULATE_UPLOADER = { path: "uploadedBy", select: "name email" };
const CATEGORY = "material_finalization";

const IMAGE_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const actorOf = (req) => req.user?.id || req.user?._id;

/**
 * @route GET /api/pms/material-finalization/project/:projectId
 * List finalized-material entries for a project (newest first).
 */
const getProjectEntries = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: "Invalid projectId" });
    }
    const entries = await MaterialFinalization.find({ projectId })
      .sort({ createdAt: -1 })
      .populate(POPULATE_UPLOADER)
      .lean();
    res.json({ count: entries.length, entries });
  } catch (err) {
    console.error("[getProjectEntries:materialFinalization]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route POST /api/pms/material-finalization/create
 * Create an entry (metadata only). Files are attached via POST /:id/files.
 */
const createEntry = async (req, res) => {
  try {
    const { error, value } = createMaterialFinalizationSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });
    }

    const project = await Project.findById(value.projectId).select("trackingId name").lean();
    if (!project) return res.status(404).json({ message: "Project not found" });

    const entry = await MaterialFinalization.create({
      projectId:     value.projectId,
      title:         value.title.trim(),
      category:      String(value.category || "").trim(),
      brand:         String(value.brand || "").trim(),
      specification: String(value.specification || "").trim(),
      description:   String(value.description || "").trim(),
      status:        value.status || "finalized",
      uploadedBy:    actorOf(req),
    });

    logActivity({
      projectId:   entry.projectId,
      actorId:     actorOf(req),
      entityType:  "material_finalization",
      entityId:    entry._id,
      action:      "created",
      description: `Material finalization "${entry.title}" created`,
    });

    const populated = await MaterialFinalization.findById(entry._id).populate(POPULATE_UPLOADER).lean();
    res.status(201).json({ message: "Material finalization created", entry: populated });
  } catch (err) {
    console.error("[createEntry:materialFinalization]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route POST /api/pms/material-finalization/:id/files
 * Multipart: files[] (one or more) + kind ("image" | "document").
 * Appends each uploaded file to the matching embedded array.
 */
const uploadFiles = async (req, res) => {
  try {
    if (req.fileFilterError) {
      return res.status(400).json({ message: req.fileFilterError });
    }
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ message: "At least one file is required" });
    }

    const kind = req.body.kind === "image" ? "image" : req.body.kind === "document" ? "document" : null;
    if (!kind) {
      return res.status(400).json({ message: 'kind must be "image" or "document"' });
    }

    const entry = await MaterialFinalization.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: "Entry not found" });

    if (kind === "image" && files.some((f) => !IMAGE_MIME.has(f.mimetype))) {
      return res.status(400).json({ message: "Only image files (JPEG, PNG, WEBP) are allowed for images" });
    }

    if (!s3Storage.isConfigured()) {
      return res.status(503).json({
        message: "File storage (S3) is not configured. Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and S3_BUCKET.",
      });
    }

    const project = await Project.findById(entry.projectId).select("trackingId").lean();
    const actorId = actorOf(req);

    for (const file of files) {
      const key = s3Storage.buildDocumentKey({
        projectTrackingId: project?.trackingId || String(entry.projectId),
        category:          CATEGORY,
        name:             `${entry.title}-${kind}`,
        originalFilename:  file.originalname,
      });
      const uploaded = await s3Storage.putObject({
        key,
        body: file.buffer,
        contentType: file.mimetype,
      });
      const subdoc = {
        kind,
        fileUrl:  uploaded.url,
        s3Bucket: uploaded.bucket,
        s3Key:    uploaded.key,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        uploadedBy: actorId,
      };
      if (kind === "image") entry.images.push(subdoc);
      else                  entry.documents.push(subdoc);
    }

    await entry.save();

    logActivity({
      projectId:   entry.projectId,
      actorId,
      entityType:  "material_finalization",
      entityId:    entry._id,
      action:      "updated",
      description: `${files.length} ${kind}(s) added to material finalization "${entry.title}"`,
    });

    const populated = await MaterialFinalization.findById(entry._id).populate(POPULATE_UPLOADER).lean();
    res.json({ message: "Files uploaded", entry: populated });
  } catch (err) {
    console.error("[uploadFiles:materialFinalization]", err);
    res.status(500).json({ message: err.message });
  }
};

/** Resolve a signed URL for one embedded file. */
async function fileSignedUrl(req, res, disposition) {
  try {
    const entry = await MaterialFinalization.findById(req.params.id)
      .select("images documents")
      .lean();
    if (!entry) return res.status(404).json({ message: "Entry not found" });

    const file =
      (entry.images || []).find((f) => String(f._id) === req.params.fileId) ||
      (entry.documents || []).find((f) => String(f._id) === req.params.fileId);
    if (!file) return res.status(404).json({ message: "File not found" });

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
      filename:  file.fileName || "file",
      expiresIn: 3600,
    });
    res.json({ url, source: "s3", expiresIn: 3600 });
  } catch (err) {
    console.error("[fileSignedUrl:materialFinalization]", err);
    res.status(500).json({ message: err.message });
  }
}

const previewFile  = (req, res) => fileSignedUrl(req, res, "inline");
const downloadFile = (req, res) => fileSignedUrl(req, res, "attachment");

/**
 * @route DELETE /api/pms/material-finalization/:id/files/:fileId
 * Remove one embedded file (+ its S3 object).
 */
const deleteFile = async (req, res) => {
  try {
    const entry = await MaterialFinalization.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: "Entry not found" });

    const inImages = entry.images.id(req.params.fileId);
    const inDocs   = entry.documents.id(req.params.fileId);
    const file = inImages || inDocs;
    if (!file) return res.status(404).json({ message: "File not found" });

    if (file.s3Key && s3Storage.isConfigured()) {
      s3Storage.deleteObject({ key: file.s3Key })
        .catch((err) => console.error("[deleteFile:materialFinalization:s3]", err.message));
    }
    file.deleteOne();
    await entry.save();

    const populated = await MaterialFinalization.findById(entry._id).populate(POPULATE_UPLOADER).lean();
    res.json({ message: "File removed", entry: populated });
  } catch (err) {
    console.error("[deleteFile:materialFinalization]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route PATCH /api/pms/material-finalization/:id
 * Update entry metadata (title / description / status).
 */
const updateEntry = async (req, res) => {
  try {
    const { error, value } = updateMaterialFinalizationSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });
    }
    const updates = {};
    if (value.title         !== undefined) updates.title = value.title.trim();
    if (value.category      !== undefined) updates.category = String(value.category || "").trim();
    if (value.brand         !== undefined) updates.brand = String(value.brand || "").trim();
    if (value.specification !== undefined) updates.specification = String(value.specification || "").trim();
    if (value.description   !== undefined) updates.description = String(value.description || "").trim();
    if (value.status        !== undefined) updates.status = value.status;

    const entry = await MaterialFinalization.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    ).populate(POPULATE_UPLOADER);
    if (!entry) return res.status(404).json({ message: "Entry not found" });

    logActivity({
      projectId:   entry.projectId,
      actorId:     actorOf(req),
      entityType:  "material_finalization",
      entityId:    entry._id,
      action:      "updated",
      description: `Material finalization "${entry.title}" updated`,
    });

    res.json({ message: "Material finalization updated", entry });
  } catch (err) {
    console.error("[updateEntry:materialFinalization]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route DELETE /api/pms/material-finalization/:id
 * Delete the entry and cascade-delete all its S3 objects.
 */
const deleteEntry = async (req, res) => {
  try {
    const entry = await MaterialFinalization.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ message: "Entry not found" });

    if (s3Storage.isConfigured()) {
      const keys = [...(entry.images || []), ...(entry.documents || [])]
        .map((f) => f.s3Key)
        .filter(Boolean);
      for (const key of keys) {
        s3Storage.deleteObject({ key })
          .catch((err) => console.error("[deleteEntry:materialFinalization:s3]", err.message));
      }
    }

    logActivity({
      projectId:   entry.projectId,
      actorId:     actorOf(req),
      entityType:  "material_finalization",
      entityId:    entry._id,
      action:      "deleted",
      description: `Material finalization "${entry.title}" removed`,
    });

    res.json({ message: "Material finalization deleted" });
  } catch (err) {
    console.error("[deleteEntry:materialFinalization]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getProjectEntries,
  createEntry,
  uploadFiles,
  previewFile,
  downloadFile,
  deleteFile,
  updateEntry,
  deleteEntry,
};
