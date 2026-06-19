const mongoose = require("mongoose");
const FinalHandoverDocument = require("../models/FinalHandoverDocument.model");
const Project = require("../models/Project.model");
const s3Storage = require("../services/s3Storage");
const { logActivity } = require("../../../shared/activityLogger");
const { updateFinalHandoverSchema } = require("../validator/FinalHandover.validator");

const POPULATE_UPLOADER = { path: "uploadedBy", select: "name email" };
const CATEGORY = "final_handover";

const actorOf = (req) => req.user?.id || req.user?._id;

/**
 * @route GET /api/pms/final-handover/project/:projectId
 * List handover documents for a project (newest first).
 */
const getProjectDocs = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: "Invalid projectId" });
    }
    const documents = await FinalHandoverDocument.find({ projectId })
      .sort({ createdAt: -1 })
      .populate(POPULATE_UPLOADER)
      .lean();
    res.json({ count: documents.length, documents });
  } catch (err) {
    console.error("[getProjectDocs:finalHandover]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route POST /api/pms/final-handover/upload
 * Multipart: file (required) · projectId (required) · name (required) · description
 */
const uploadDoc = async (req, res) => {
  try {
    if (req.fileFilterError) {
      return res.status(400).json({ message: req.fileFilterError });
    }
    if (!req.file) {
      return res.status(400).json({ message: "A file is required" });
    }

    const { projectId, name, description = "" } = req.body;
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: "Valid projectId is required" });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Document name is required" });
    }

    const project = await Project.findById(projectId).select("trackingId name").lean();
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!s3Storage.isConfigured()) {
      return res.status(503).json({
        message: "Document storage (S3) is not configured. Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and S3_BUCKET.",
      });
    }

    const key = s3Storage.buildDocumentKey({
      projectTrackingId: project.trackingId,
      category:          CATEGORY,
      name:              String(name).trim(),
      originalFilename:  req.file.originalname,
    });
    const uploaded = await s3Storage.putObject({
      key,
      body: req.file.buffer,
      contentType: req.file.mimetype,
    });

    const doc = await FinalHandoverDocument.create({
      projectId,
      name:        String(name).trim(),
      description: String(description || "").trim(),
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      fileUrl:  uploaded.url,
      s3Bucket: uploaded.bucket,
      s3Key:    uploaded.key,
      uploadedBy: actorOf(req),
    });

    logActivity({
      projectId,
      actorId:     actorOf(req),
      entityType:  "final_handover",
      entityId:    doc._id,
      action:      "created",
      description: `Handover document "${doc.name}" uploaded`,
      metadata:    { fileName: doc.fileName },
    });

    const populated = await FinalHandoverDocument.findById(doc._id).populate(POPULATE_UPLOADER).lean();
    res.status(201).json({ message: "Handover document uploaded", document: populated });
  } catch (err) {
    console.error("[uploadDoc:finalHandover]", err);
    res.status(500).json({ message: err.message });
  }
};

/** Shared signed-URL resolver for download/preview. */
async function signedUrlHandler(req, res, disposition) {
  try {
    const doc = await FinalHandoverDocument.findById(req.params.id)
      .select("s3Bucket s3Key fileName fileUrl name")
      .lean();
    if (!doc) return res.status(404).json({ message: "Document not found" });

    let bucket = doc.s3Bucket;
    let key    = doc.s3Key;
    if (!key) {
      const parsed = s3Storage.parseS3Url(doc.fileUrl);
      if (parsed) ({ bucket, key } = parsed);
    }
    if (!key) return res.json({ url: doc.fileUrl, source: "legacy" });

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
    console.error("[finalHandover:signedUrlHandler]", err);
    res.status(500).json({ message: err.message });
  }
}

const downloadDoc = (req, res) => signedUrlHandler(req, res, "attachment");
const previewDoc  = (req, res) => signedUrlHandler(req, res, "inline");

/**
 * @route PATCH /api/pms/final-handover/:id
 * Edit handover document metadata (name / description).
 */
const updateDoc = async (req, res) => {
  try {
    const { error, value } = updateFinalHandoverSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join("; ") });
    }
    const updates = {};
    if (value.name        !== undefined) updates.name = value.name.trim();
    if (value.description !== undefined) updates.description = String(value.description || "").trim();

    const doc = await FinalHandoverDocument.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    ).populate(POPULATE_UPLOADER);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    logActivity({
      projectId:   doc.projectId,
      actorId:     actorOf(req),
      entityType:  "final_handover",
      entityId:    doc._id,
      action:      "updated",
      description: `Handover document "${doc.name}" details updated`,
    });

    res.json({ message: "Handover document updated", document: doc });
  } catch (err) {
    console.error("[updateDoc:finalHandover]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route DELETE /api/pms/final-handover/:id
 * Remove the entry and its S3 object.
 */
const deleteDoc = async (req, res) => {
  try {
    const doc = await FinalHandoverDocument.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    if (doc.s3Key && s3Storage.isConfigured()) {
      s3Storage.deleteObject({ key: doc.s3Key })
        .catch((err) => console.error("[deleteDoc:finalHandover:s3]", err.message));
    }

    logActivity({
      projectId:   doc.projectId,
      actorId:     actorOf(req),
      entityType:  "final_handover",
      entityId:    doc._id,
      action:      "deleted",
      description: `Handover document "${doc.name}" removed`,
    });

    res.json({ message: "Handover document deleted" });
  } catch (err) {
    console.error("[deleteDoc:finalHandover]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getProjectDocs,
  uploadDoc,
  downloadDoc,
  previewDoc,
  updateDoc,
  deleteDoc,
};
