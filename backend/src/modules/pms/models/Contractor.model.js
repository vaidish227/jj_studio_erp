const mongoose = require("mongoose");

/**
 * Contractor — a single contractor / sub-contractor engaged on a project.
 *
 * Captures four concerns in one record:
 *   • Directory      — who they are + how to reach them (name, company, trade, contacts).
 *   • Assigned scope — the work assigned to them + lifecycle status.
 *   • Documents      — agreements, licenses, insurance (S3-backed, metadata only).
 *   • Payments       — contract value vs amount paid; pending is derived (value − paid).
 *
 * Documents live in AWS S3; only metadata is kept here as embedded subdocuments
 * so a single read returns the whole record and deleting a contractor cleanly
 * cascades its S3 objects.
 */
const STATUSES = ["active", "on_hold", "completed", "terminated"];

// Embedded agreement / license / insurance file. `kind` mirrors the closure
// modules' file shape so the shared InlineFilePicker / upload helpers work as-is.
const fileSubSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["image", "document"],
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    s3Bucket: String,
    s3Key:    String,
    fileName: String,
    fileType: String,
    fileSize: Number,
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { _id: true }
);

const contractorSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    // Directory
    name: {
      type: String,
      required: true,
      trim: true,
    },
    company: {
      type: String,
      default: "",
      trim: true,
    },
    // Trade / specialization, e.g. Civil, Electrical, Plumbing, Carpentry.
    trade: {
      type: String,
      default: "",
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    // Assigned scope & status
    scope: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: STATUSES,
      default: "active",
    },
    startDate: Date,
    endDate:   Date,
    // Payments / billing — pending = contractValue − amountPaid (derived in UI).
    contractValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      default: "",
    },
    // Agreements, licenses, insurance docs (kind: "document" | "image").
    documents: [fileSubSchema],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    collection: "pms_contractors",
  }
);

contractorSchema.index({ projectId: 1, status: 1 });
contractorSchema.index({ projectId: 1, createdAt: -1 });

module.exports = mongoose.model("Contractor", contractorSchema, "pms_contractors");
module.exports.STATUSES = STATUSES;
