const mongoose = require("mongoose");
const Contractor = require("../models/Contractor.model");
const Project = require("../models/Project.model");
const s3Storage = require("../services/s3Storage");
const { logActivity } = require("../../../shared/activityLogger");
const {
  createContractorSchema,
  updateContractorSchema,
} = require("../validator/Contractor.validator");

const { STATUSES } = Contractor;
const POPULATE_CREATOR = { path: "createdBy", select: "name email" };
const CATEGORY = "contractor";

// Documents may be true docs (PDF/Office) or scanned images of an agreement.
// Both are stored in `documents[]`; `kind` is recorded for the UI's icon choice.
const DOC_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv", "text/plain",
  "application/zip", "application/x-zip-compressed",
]);
const IMAGE_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const actorOf = (req) => req.user?.id || req.user?._id;

/** Map a fields object (validated) onto a contractor doc — used by create + update. */
const SETTERS = {
  name:          (v) => v.trim(),
  company:       (v) => String(v || "").trim(),
  trade:         (v) => String(v || "").trim(),
  phone:         (v) => String(v || "").trim(),
  email:         (v) => String(v || "").trim().toLowerCase(),
  address:       (v) => String(v || "").trim(),
  scope:         (v) => String(v || "").trim(),
  status:        (v) => v,
  startDate:     (v) => (v ? new Date(v) : undefined),
  endDate:       (v) => (v ? new Date(v) : undefined),
  contractValue: (v) => Number(v) || 0,
  amountPaid:    (v) => Number(v) || 0,
  notes:         (v) => String(v || "").trim(),
};

/**
 * @route GET /api/pms/contractor/project/:projectId
 * Query: ?status=
 * Returns contractors (newest first) + per-status counts for the filter badges.
 */
const getProjectContractors = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: "Invalid projectId" });
    }

    const { status } = req.query;
    const filter = { projectId };
    if (status && STATUSES.includes(status)) filter.status = status;

    const [contractors, countRows] = await Promise.all([
      Contractor.find(filter).sort({ createdAt: -1 }).populate(POPULATE_CREATOR).lean(),
      Contractor.aggregate([
        { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const row of countRows) {
      if (row._id in counts) counts[row._id] = row.count;
    }

    res.json({ count: contractors.length, contractors, counts });
  } catch (err) {
    console.error("[getProjectContractors]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route POST /api/pms/contractor/create
 * Create a contractor (metadata only). Documents are attached via POST /:id/files.
 */
const createContractor = async (req, res) => {
  try {
    const { error, value } = createContractorSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });
    }

    const project = await Project.findById(value.projectId).select("trackingId name").lean();
    if (!project) return res.status(404).json({ message: "Project not found" });

    const doc = { projectId: value.projectId, createdBy: actorOf(req) };
    for (const [key, setter] of Object.entries(SETTERS)) {
      if (value[key] !== undefined) doc[key] = setter(value[key]);
    }

    const contractor = await Contractor.create(doc);

    logActivity({
      projectId:   contractor.projectId,
      actorId:     actorOf(req),
      entityType:  "contractor",
      entityId:    contractor._id,
      action:      "created",
      description: `Contractor "${contractor.name}" added${contractor.trade ? ` (${contractor.trade})` : ""}`,
    });

    const populated = await Contractor.findById(contractor._id).populate(POPULATE_CREATOR).lean();
    res.status(201).json({ message: "Contractor created", contractor: populated });
  } catch (err) {
    console.error("[createContractor]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route POST /api/pms/contractor/:id/files
 * Multipart: files[] + kind ("document" | "image"). Appends to documents[].
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
      return res.status(400).json({ message: 'kind must be "document" or "image"' });
    }
    const allow = kind === "image" ? IMAGE_MIME : DOC_MIME;
    if (files.some((f) => !allow.has(f.mimetype))) {
      return res.status(400).json({ message: `One or more files are not valid ${kind} files` });
    }

    const contractor = await Contractor.findById(req.params.id);
    if (!contractor) return res.status(404).json({ message: "Contractor not found" });

    if (!s3Storage.isConfigured()) {
      return res.status(503).json({
        message: "File storage (S3) is not configured. Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and S3_BUCKET.",
      });
    }

    const project = await Project.findById(contractor.projectId).select("trackingId").lean();
    const actorId = actorOf(req);

    for (const file of files) {
      const key = s3Storage.buildDocumentKey({
        projectTrackingId: project?.trackingId || String(contractor.projectId),
        category:          CATEGORY,
        name:             `${contractor.name}-doc`,
        originalFilename:  file.originalname,
      });
      const uploaded = await s3Storage.putObject({
        key,
        body: file.buffer,
        contentType: file.mimetype,
      });
      contractor.documents.push({
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

    await contractor.save();

    logActivity({
      projectId:   contractor.projectId,
      actorId,
      entityType:  "contractor",
      entityId:    contractor._id,
      action:      "updated",
      description: `${files.length} document(s) added to contractor "${contractor.name}"`,
    });

    const populated = await Contractor.findById(contractor._id).populate(POPULATE_CREATOR).lean();
    res.json({ message: "Files uploaded", contractor: populated });
  } catch (err) {
    console.error("[uploadFiles:contractor]", err);
    res.status(500).json({ message: err.message });
  }
};

/** Resolve a signed URL for one contractor document. */
async function fileSignedUrl(req, res, disposition) {
  try {
    const contractor = await Contractor.findById(req.params.id).select("documents").lean();
    if (!contractor) return res.status(404).json({ message: "Contractor not found" });

    const file = (contractor.documents || []).find((f) => String(f._id) === req.params.fileId);
    if (!file) return res.status(404).json({ message: "Document not found" });

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
      filename:  file.fileName || "document",
      expiresIn: 3600,
    });
    res.json({ url, source: "s3", expiresIn: 3600 });
  } catch (err) {
    console.error("[fileSignedUrl:contractor]", err);
    res.status(500).json({ message: err.message });
  }
}

const previewFile  = (req, res) => fileSignedUrl(req, res, "inline");
const downloadFile = (req, res) => fileSignedUrl(req, res, "attachment");

/**
 * @route DELETE /api/pms/contractor/:id/files/:fileId
 * Remove one contractor document (+ its S3 object).
 */
const deleteFile = async (req, res) => {
  try {
    const contractor = await Contractor.findById(req.params.id);
    if (!contractor) return res.status(404).json({ message: "Contractor not found" });

    const file = contractor.documents.id(req.params.fileId);
    if (!file) return res.status(404).json({ message: "Document not found" });

    if (file.s3Key && s3Storage.isConfigured()) {
      s3Storage.deleteObject({ key: file.s3Key })
        .catch((err) => console.error("[deleteFile:contractor:s3]", err.message));
    }
    file.deleteOne();
    await contractor.save();

    const populated = await Contractor.findById(contractor._id).populate(POPULATE_CREATOR).lean();
    res.json({ message: "Document removed", contractor: populated });
  } catch (err) {
    console.error("[deleteFile:contractor]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route PATCH /api/pms/contractor/:id
 * Update contractor fields (directory / scope / status / payments / dates).
 */
const updateContractor = async (req, res) => {
  try {
    const { error, value } = updateContractorSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });
    }

    const contractor = await Contractor.findById(req.params.id);
    if (!contractor) return res.status(404).json({ message: "Contractor not found" });

    for (const [key, setter] of Object.entries(SETTERS)) {
      if (value[key] !== undefined) contractor[key] = setter(value[key]);
    }

    await contractor.save();

    logActivity({
      projectId:   contractor.projectId,
      actorId:     actorOf(req),
      entityType:  "contractor",
      entityId:    contractor._id,
      action:      "updated",
      description: `Contractor "${contractor.name}" updated (${contractor.status})`,
    });

    const populated = await Contractor.findById(contractor._id).populate(POPULATE_CREATOR).lean();
    res.json({ message: "Contractor updated", contractor: populated });
  } catch (err) {
    console.error("[updateContractor]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route DELETE /api/pms/contractor/:id
 * Delete the contractor and cascade-delete its document S3 objects.
 */
const deleteContractor = async (req, res) => {
  try {
    const contractor = await Contractor.findByIdAndDelete(req.params.id);
    if (!contractor) return res.status(404).json({ message: "Contractor not found" });

    if (s3Storage.isConfigured()) {
      for (const file of contractor.documents || []) {
        if (!file.s3Key) continue;
        s3Storage.deleteObject({ key: file.s3Key })
          .catch((err) => console.error("[deleteContractor:s3]", err.message));
      }
    }

    logActivity({
      projectId:   contractor.projectId,
      actorId:     actorOf(req),
      entityType:  "contractor",
      entityId:    contractor._id,
      action:      "deleted",
      description: `Contractor "${contractor.name}" removed`,
    });

    res.json({ message: "Contractor deleted" });
  } catch (err) {
    console.error("[deleteContractor]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getProjectContractors,
  createContractor,
  uploadFiles,
  previewFile,
  downloadFile,
  deleteFile,
  updateContractor,
  deleteContractor,
};
