const mongoose = require("mongoose");

const designRevisionRequestSchema = new mongoose.Schema(
  {
    drawingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Drawing",
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    revisionNotes: {
      type: String,
      required: true,
      trim: true,
    },
    specificItems: {
      type: [String],
      default: [],
    },
    deadline: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["pending", "resubmitted", "resolved"],
      default: "pending",
    },
    resolvedAt: {
      type: Date,
    },
    resubmittedDrawingVersion: {
      type: Number,
    },
  },
  {
    timestamps: true,
    collection: "pms_design_revision_requests",
  }
);

designRevisionRequestSchema.index({ drawingId: 1 });
designRevisionRequestSchema.index({ assignedTo: 1, status: 1 });
designRevisionRequestSchema.index({ projectId: 1 });
designRevisionRequestSchema.index({ requestedBy: 1 });

module.exports = mongoose.model(
  "DesignRevisionRequest",
  designRevisionRequestSchema,
  "pms_design_revision_requests"
);
