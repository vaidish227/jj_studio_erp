const mongoose = require("mongoose");

/**
 * PMS Drawing Schema (DLR - Data Log Report)
 * Represents the drawings and documents uploaded for various project tasks.
 */
const drawingSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task", // Link to specific sub-flow (AC, Kitchen, etc.)
    },

    // --- Drawing Info ---
    title: {
      type: String,
      required: true,
      trim: true,
    },
    drawingType: {
      type: String,
      enum: [
        "plan",
        "elevation",
        "electrical",
        "plumbing",
        "3d_render",
        "site_photo",
        "material_selection",
        "technical_detail",
        "other",
      ],
      default: "plan",
    },

    // --- File Details ---
    fileUrl: {
      type: String,
      required: true,
    },
    fileType: String, // pdf, png, dwg, etc.
    version: {
      type: Number,
      default: 1,
    },

    // --- Status & Lifecycle ---
    status: {
      type: String,
      enum: ["draft", "sent_for_approval", "approved", "rejected", "released_to_site"],
      default: "draft",
    },

    // --- Release Tracking ---
    isReleased: {
      type: Boolean,
      default: false,
    },
    releasedAt: Date,
    releasedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // --- Approvals ---
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvalDate: Date,
    remarks: String,

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    notes: String,
  },
  {
    timestamps: true,
    collection: "pms_drawings",
  }
);

// Indexes
drawingSchema.index({ projectId: 1 });
drawingSchema.index({ taskId: 1 });
drawingSchema.index({ status: 1 });
drawingSchema.index({ isReleased: 1 });
drawingSchema.index({ title: 1, taskId: 1 }, { unique: false }); // For versioning lookup

module.exports = mongoose.model("Drawing", drawingSchema, "pms_drawings");
