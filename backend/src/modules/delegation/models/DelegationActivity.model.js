const mongoose = require("mongoose");

/**
 * DelegationActivity — append-only audit timeline for a delegation.
 * Mirrors the PMSActivityLog shape so the same fire-and-forget logging idiom
 * applies. Written on every state-changing action (Sprint 2 controllers/service).
 */
const delegationActivitySchema = new mongoose.Schema(
  {
    delegationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Delegation",
      required: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: [
        "created",
        "assigned",
        "reassigned",
        "status_changed",
        "commented",
        "attachment_added",
        "checklist_updated",
        "reopened",
        "cancelled",
      ],
      required: true,
    },
    description: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: true,
    collection: "delegation_activities",
  }
);

delegationActivitySchema.index({ delegationId: 1, createdAt: -1 });
delegationActivitySchema.index({ actorId: 1 });

module.exports = mongoose.model(
  "DelegationActivity",
  delegationActivitySchema,
  "delegation_activities"
);
