const mongoose = require("mongoose");

/**
 * FinalHandoverDocument — one file in a project's final handover package.
 *
 * Project-closure documents handed to the client: completion certificate,
 * warranties, as-built drawings, equipment manuals, etc. Distinct from the
 * internal Design→Execution `Handover` model (drawing walkthrough + punch
 * list). Shaped like ProjectDocument — one row per file in S3.
 */
const finalHandoverDocumentSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },

    // --- File details ---
    fileName: String,
    fileType: String,
    fileSize: Number,
    fileUrl: {
      type: String,
      required: true,
    },
    s3Bucket: String,
    s3Key:    String,

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    collection: "pms_final_handover_documents",
  }
);

finalHandoverDocumentSchema.index({ projectId: 1, createdAt: -1 });

module.exports = mongoose.model(
  "FinalHandoverDocument",
  finalHandoverDocumentSchema,
  "pms_final_handover_documents"
);
