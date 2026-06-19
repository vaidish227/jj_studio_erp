const mongoose = require("mongoose");

/**
 * MaterialFinalization — a finalized-material entry for a project.
 *
 * Distinct from the procurement `Material` model (which tracks selection
 * status proposed→delivered). This captures the FINAL sign-off of a material
 * choice with supporting reference images and documents (spec sheets,
 * warranties, sample approvals, etc.). Files live in AWS S3; only metadata is
 * stored here as embedded subdocuments so a single read returns the whole
 * entry and deleting the entry cleanly cascades its S3 objects.
 */
const STATUSES = ["draft", "finalized"];

// Shared shape for an embedded image / document. `kind` discriminates the two
// arrays so the controller can validate MIME per kind and the UI can render
// thumbnails vs document chips.
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

const materialFinalizationSchema = new mongoose.Schema(
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
    category: {
      type: String,
      default: "",
      trim: true,
    },
    brand: {
      type: String,
      default: "",
      trim: true,
    },
    specification: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: STATUSES,
      default: "finalized",
    },
    images:    [fileSubSchema], // kind: "image"
    documents: [fileSubSchema], // kind: "document"

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    collection: "pms_material_finalizations",
  }
);

materialFinalizationSchema.index({ projectId: 1, createdAt: -1 });

module.exports = mongoose.model(
  "MaterialFinalization",
  materialFinalizationSchema,
  "pms_material_finalizations"
);
module.exports.STATUSES = STATUSES;
