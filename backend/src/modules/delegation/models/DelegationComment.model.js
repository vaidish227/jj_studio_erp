const mongoose = require("mongoose");

/**
 * DelegationComment — team-visible discussion thread on a delegation.
 *
 * MVP: all comments are visible to anyone who can read the delegation
 * (no internal-note / client-visibility split, no @mentions — those are
 * deferred to a later phase).
 */

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    fileName: String,
    fileType: String,
    fileSize: Number,
    fileUrl: String,
    s3Bucket: String,
    s3Key: String,
    kind: { type: String, enum: ["image", "pdf", "document"], default: "document" },
  },
  { _id: true }
);

const delegationCommentSchema = new mongoose.Schema(
  {
    delegationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Delegation",
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    body: { type: String, required: true, trim: true },
    attachments: { type: [attachmentSchema], default: [] },
  },
  {
    timestamps: true,
    collection: "delegation_comments",
  }
);

delegationCommentSchema.index({ delegationId: 1, createdAt: 1 });

module.exports = mongoose.model(
  "DelegationComment",
  delegationCommentSchema,
  "delegation_comments"
);
