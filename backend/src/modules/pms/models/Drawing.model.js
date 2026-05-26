const mongoose = require("mongoose");

const drawingSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
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
        "civil",
        "electrical",
        "plumbing",
        "technical_detail",
        "ac_coordination",
        "automation",
        "kitchen",
        "bathroom",
        "3d_render",
        "concept",
        "material_selection",
        "site_photo",
        "other",
      ],
      default: "plan",
    },

    // --- File Details ---
    fileUrl: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
    },
    fileType: String,
    fileSize: Number,
    version: {
      type: Number,
      default: 1,
    },
    revisionNotes: String,

    // --- Revision History (previous versions) ---
    revisionHistory: [
      {
        version: Number,
        fileUrl: String,
        fileName: String,
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        uploadedAt: { type: Date, default: Date.now },
        notes: String,
      },
    ],

    // --- Pre-Upload Checklist Snapshot ---
    checklistSnapshot: [
      {
        item: String,
        isCompleted: { type: Boolean, default: false },
      },
    ],

    // --- Submission notes (added when sending for approval) ---
    submissionNotes: {
      type: String,
    },

    // --- Status & Lifecycle ---
    status: {
      type: String,
      enum: ["draft", "sent_for_approval", "approved", "rejected", "released_to_site"],
      default: "draft",
    },

    // --- Approval Tracking ---
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvalDate: Date,

    // --- Rejection Tracking ---
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    rejectedAt: Date,
    rejectionReason: String,

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

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    remarks: String,
    notes: String,
  },
  {
    timestamps: true,
    collection: "pms_drawings",
  }
);

drawingSchema.index({ projectId: 1 });
drawingSchema.index({ taskId: 1 });
drawingSchema.index({ status: 1 });
drawingSchema.index({ isReleased: 1 });
drawingSchema.index({ drawingType: 1 });

module.exports = mongoose.model("Drawing", drawingSchema, "pms_drawings");
