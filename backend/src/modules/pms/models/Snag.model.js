const mongoose = require("mongoose");

/**
 * Snag — a single site snag / defect raised against a project.
 *
 * Carries structured issue details (issue summary, location/area/zone,
 * severity, status) plus a freeform description and reference media (photos,
 * voice notes, video clips). Media live in AWS S3; only metadata is kept here
 * as embedded subdocuments so deleting a snag cleanly cascades its S3 objects.
 */
const SEVERITIES   = ["low", "medium", "high"];
const STATUSES     = ["open", "in_progress", "resolved", "closed"];
const MEDIA_KINDS  = ["image", "audio", "video"];

const mediaSubSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: MEDIA_KINDS,
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

const snagSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    // Short summary of the defect itself (distinct from the freeform description).
    issue: {
      type: String,
      default: "",
      trim: true,
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    area: {
      type: String,
      default: "",
      trim: true,
    },
    zone: {
      type: String,
      default: "",
      trim: true,
    },
    severity: {
      type: String,
      enum: SEVERITIES,
      default: "medium",
    },
    status: {
      type: String,
      enum: STATUSES,
      default: "open",
    },
    description: {
      type: String,
      default: "",
    },
    // Mixed media — kind discriminates images / audio / video.
    media: [mediaSubSchema],

    resolvedAt: Date,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    collection: "pms_snags",
  }
);

snagSchema.index({ projectId: 1, status: 1 });
snagSchema.index({ projectId: 1, createdAt: -1 });

module.exports = mongoose.model("Snag", snagSchema, "pms_snags");
module.exports.SEVERITIES  = SEVERITIES;
module.exports.STATUSES    = STATUSES;
module.exports.MEDIA_KINDS = MEDIA_KINDS;
