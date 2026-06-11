const mongoose = require("mongoose");
const ProjectDocument = require("../models/ProjectDocument.model");
const Project = require("../models/Project.model");
const s3Storage = require("../services/s3Storage");
const { logActivity } = require("../../../shared/activityLogger");

const { CATEGORIES, STATUSES } = ProjectDocument;

const POPULATE_UPLOADER = { path: "uploadedBy", select: "name email" };

/**
 * @route POST /api/pms/document/upload
 *
 * Manual upload into a project's Document Repository. Multipart form-data:
 *   file (required) · projectId (required) · name (required)
 *   description · category · status
 * The file streams from multer memory storage straight to S3 under
 * documents/<projectTrackingId>/<category>/.
 */
const uploadDocument = async (req, res) => {
  try {
    if (req.fileFilterError) {
      return res.status(400).json({ message: req.fileFilterError });
    }
    if (!req.file) {
      return res.status(400).json({ message: "A file is required" });
    }

    const { projectId, name, description = "", category = "documents" } = req.body;
    const status = STATUSES.includes(req.body.status) ? req.body.status : "uploaded";

    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: "Valid projectId is required" });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Document name is required" });
    }
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ message: `Invalid category. Allowed: ${CATEGORIES.join(", ")}` });
    }

    const project = await Project.findById(projectId).select("trackingId name").lean();
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (!s3Storage.isConfigured()) {
      return res.status(503).json({
        message: "Document storage (S3) is not configured. Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and S3_BUCKET.",
      });
    }

    const key = s3Storage.buildDocumentKey({
      projectTrackingId: project.trackingId,
      category,
      name: String(name).trim(),
      originalFilename: req.file.originalname,
    });
    const uploaded = await s3Storage.putObject({
      key,
      body: req.file.buffer,
      contentType: req.file.mimetype,
    });

    const doc = await ProjectDocument.create({
      projectId,
      name:        String(name).trim(),
      description: String(description || "").trim(),
      category,
      status,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      fileUrl:  uploaded.url,
      s3Bucket: uploaded.bucket,
      s3Key:    uploaded.key,
      source:   "manual",
      uploadedBy: req.user?.id || req.user?._id,
    });

    logActivity({
      projectId,
      actorId:     req.user?.id || req.user?._id,
      entityType:  "document",
      entityId:    doc._id,
      action:      "created",
      description: `Document "${doc.name}" uploaded to repository (${category})`,
      metadata:    { category, fileName: doc.fileName },
    });

    const populated = await ProjectDocument.findById(doc._id).populate(POPULATE_UPLOADER).lean();
    res.status(201).json({ message: "Document uploaded", document: populated });
  } catch (err) {
    console.error("[uploadDocument]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route GET /api/pms/document/project/:projectId
 * Query: ?category=&search=
 * Returns documents (newest first) + per-category counts for the tab badges.
 */
const getProjectDocuments = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: "Invalid projectId" });
    }

    const { category, search } = req.query;
    const filter = { projectId };
    if (category && CATEGORIES.includes(category)) filter.category = category;
    if (search && String(search).trim()) {
      filter.name = { $regex: String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    }

    const [documents, countRows] = await Promise.all([
      ProjectDocument.find(filter)
        .sort({ createdAt: -1 })
        .populate(POPULATE_UPLOADER)
        .lean(),
      ProjectDocument.aggregate([
        { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
    ]);

    const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
    for (const row of countRows) {
      if (row._id in counts) counts[row._id] = row.count;
    }

    res.json({ documents, counts });
  } catch (err) {
    console.error("[getProjectDocuments]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Shared signed-URL resolver for download/preview. Resolution order mirrors
 * the drawing endpoint: s3Key on the doc → parse fileUrl → legacy passthrough.
 */
async function signedUrlHandler(req, res, disposition) {
  try {
    const doc = await ProjectDocument.findById(req.params.id)
      .select("s3Bucket s3Key fileName fileUrl name")
      .lean();
    if (!doc) return res.status(404).json({ message: "Document not found" });

    let bucket = doc.s3Bucket;
    let key    = doc.s3Key;
    if (!key) {
      const parsed = s3Storage.parseS3Url(doc.fileUrl);
      if (parsed) ({ bucket, key } = parsed);
    }

    if (!key) {
      // Local/external URL (e.g. dev-mode proposal PDF under /static) — return as-is.
      return res.json({ url: doc.fileUrl, source: "legacy" });
    }

    if (!s3Storage.isConfigured()) {
      return res.status(503).json({ message: "Document storage is not configured" });
    }

    const friendlyName = doc.fileName ||
      `${(doc.name || "document").replace(/[^a-zA-Z0-9_-]+/g, "_")}`;

    const url = await s3Storage.getSignedDownloadUrl({
      key,
      disposition,
      filename:  friendlyName,
      expiresIn: 3600,
    });

    res.json({ url, source: "s3", expiresIn: 3600 });
  } catch (err) {
    console.error("[document:signedUrlHandler]", err);
    res.status(500).json({ message: err.message });
  }
}

const downloadDocument = (req, res) => signedUrlHandler(req, res, "attachment");
const previewDocument  = (req, res) => signedUrlHandler(req, res, "inline");

/**
 * @route PATCH /api/pms/document/:id
 * Edit the repository metadata (name / description / category / status).
 * The stored file itself is immutable — re-upload to replace.
 */
const updateDocument = async (req, res) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) {
      if (!String(req.body.name).trim()) {
        return res.status(400).json({ message: "Document name cannot be empty" });
      }
      updates.name = String(req.body.name).trim();
    }
    if (req.body.description !== undefined) updates.description = String(req.body.description || "").trim();
    if (req.body.category !== undefined) {
      if (!CATEGORIES.includes(req.body.category)) {
        return res.status(400).json({ message: `Invalid category. Allowed: ${CATEGORIES.join(", ")}` });
      }
      updates.category = req.body.category;
    }
    if (req.body.status !== undefined) {
      if (!STATUSES.includes(req.body.status)) {
        return res.status(400).json({ message: `Invalid status. Allowed: ${STATUSES.join(", ")}` });
      }
      updates.status = req.body.status;
    }

    const doc = await ProjectDocument.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    ).populate(POPULATE_UPLOADER);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    logActivity({
      projectId:   doc.projectId,
      actorId:     req.user?.id || req.user?._id,
      entityType:  "document",
      entityId:    doc._id,
      action:      "updated",
      description: `Document "${doc.name}" details updated`,
    });

    res.json({ message: "Document updated", document: doc });
  } catch (err) {
    console.error("[updateDocument]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route DELETE /api/pms/document/:id
 *
 * Removes the repository entry. The S3 object is deleted ONLY for manual
 * uploads — drawing-sourced entries reference the Drawing's own file and
 * proposal PDFs may be shared with email/WhatsApp sends.
 */
const deleteDocument = async (req, res) => {
  try {
    const doc = await ProjectDocument.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    if (doc.source === "manual" && doc.s3Key && s3Storage.isConfigured()) {
      s3Storage.deleteObject({ key: doc.s3Key })
        .catch((err) => console.error("[deleteDocument:s3]", err.message));
    }

    logActivity({
      projectId:   doc.projectId,
      actorId:     req.user?.id || req.user?._id,
      entityType:  "document",
      entityId:    doc._id,
      action:      "deleted",
      description: `Document "${doc.name}" removed from repository`,
    });

    res.json({ message: "Document deleted" });
  } catch (err) {
    console.error("[deleteDocument]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  uploadDocument,
  getProjectDocuments,
  downloadDocument,
  previewDocument,
  updateDocument,
  deleteDocument,
};
