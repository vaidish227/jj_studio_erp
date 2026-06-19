const mongoose = require("mongoose");

const milestoneSchema = new mongoose.Schema(
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
    description: String,

    // Computed phase start (auto-synced milestones only). Manual milestones
    // leave this null and use dueDate as their single checkpoint date.
    startDate: Date,
    dueDate: {
      type: Date,
      required: true,
    },
    completedDate: Date,

    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "delayed"],
      default: "pending",
    },

    // 0-100 rollup (auto-synced milestones). Manual milestones keep 0.
    progressPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // When set, this milestone is auto-synced from the master-sheet phase of
    // this name. Used as the upsert key so the sync never clobbers a manually
    // created milestone. Null/absent = manual milestone (engine never touches).
    sourcePhase: {
      type: String,
      trim: true,
      default: null,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    isCritical: {
      type: Boolean,
      default: false,
    },

    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: "pms_milestones",
  }
);

milestoneSchema.index({ projectId: 1, order: 1 });
milestoneSchema.index({ status: 1 });
milestoneSchema.index({ dueDate: 1 });
// Upsert key for phase-synced milestones (unique per project+phase).
milestoneSchema.index({ projectId: 1, sourcePhase: 1 });

module.exports = mongoose.model("ProjectMilestone", milestoneSchema, "pms_milestones");
