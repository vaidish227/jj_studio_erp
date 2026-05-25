const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    entityType: {
      type: String,
      enum: [
        "project", "task", "drawing", "milestone",
        "approval", "material", "purchase_order",
        "site_visit", "site_log", "whatsapp_group",
      ],
      required: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    action: {
      type: String,
      enum: [
        "created", "updated", "deleted",
        "status_changed", "assigned", "unassigned",
        "approved", "rejected", "released",
        "sent_for_approval", "revision_requested",
        "commented", "checklist_updated",
        "team_updated", "kickstart_updated",
      ],
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    collection: "pms_activity_logs",
  }
);

activityLogSchema.index({ projectId: 1, createdAt: -1 });
activityLogSchema.index({ actorId: 1 });
activityLogSchema.index({ entityType: 1, entityId: 1 });

module.exports = mongoose.model("PMSActivityLog", activityLogSchema, "pms_activity_logs");
