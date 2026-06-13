const mongoose = require("mongoose");

/**
 * ProjectDocument — one file in a project's Document Repository.
 *
 * Documents arrive two ways:
 *   - manual:   uploaded via the repository UI (name + details + file → S3)
 *   - auto-ingested: created by documentIngest when a document that already
 *     lives in the system gets client approval (approved proposal PDF on
 *     project initiation, client-approved drawings). Auto-ingested entries
 *     carry `source` + `sourceRef` so ingestion is idempotent and the entry
 *     can link back to the original record.
 *
 * Drawing-sourced documents REFERENCE the drawing's existing S3 object
 * (same bucket/key) — the file is never copied, so deleting the repository
 * entry must never delete the underlying S3 object unless source === manual.
 */
const CATEGORIES = ["client_details", "documents", "mom", "design_files", "sop"];
const STATUSES   = ["uploaded", "approved", "signed", "verified"];
const SOURCES    = ["manual", "proposal", "drawing"];

const projectDocumentSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    // Display name shown on the card ("Agreement", "Approved Proposal").
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      enum: CATEGORIES,
      default: "documents",
    },
    // Badge rendered on the card. Manual uploads default to "uploaded";
    // auto-ingested entries carry the approval state of their source.
    status: {
      type: String,
      enum: STATUSES,
      default: "uploaded",
    },

    // --- File details ---
    fileName: String,
    fileType: String,
    fileSize: Number,
    fileUrl: {
      type: String,
      required: true,
    },
    // Present when the file lives in our S3 bucket; absent for legacy/local URLs.
    s3Bucket: String,
    s3Key:    String,

    // --- Provenance ---
    source: {
      type: String,
      enum: SOURCES,
      default: "manual",
    },
    // For auto-ingested docs: the record this entry was generated from.
    sourceRef: {
      kind:  { type: String, enum: ["Proposal", "Drawing"], required: false },
      refId: { type: mongoose.Schema.Types.ObjectId, required: false },
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    collection: "pms_project_documents",
  }
);

projectDocumentSchema.index({ projectId: 1, category: 1 });
// Idempotency guard for auto-ingestion: one repository entry per source record
// per project. Partial so manual uploads (no sourceRef) are unconstrained.
projectDocumentSchema.index(
  { projectId: 1, source: 1, "sourceRef.refId": 1 },
  { unique: true, partialFilterExpression: { "sourceRef.refId": { $exists: true } } }
);

module.exports = mongoose.model("ProjectDocument", projectDocumentSchema, "pms_project_documents");
module.exports.CATEGORIES = CATEGORIES;
module.exports.STATUSES   = STATUSES;
