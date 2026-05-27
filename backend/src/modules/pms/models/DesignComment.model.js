const mongoose = require("mongoose");

const designCommentSchema = new mongoose.Schema(
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
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    commentType: {
      type: String,
      enum: ["review_note", "revision_request", "designer_response", "general"],
      default: "general",
    },
    attachmentUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: "pms_design_comments",
  }
);

designCommentSchema.index({ drawingId: 1, createdAt: 1 });
designCommentSchema.index({ projectId: 1 });
designCommentSchema.index({ authorId: 1 });

module.exports = mongoose.model("DesignComment", designCommentSchema, "pms_design_comments");
