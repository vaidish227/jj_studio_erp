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

module.exports = mongoose.model("ProjectMilestone", milestoneSchema, "pms_milestones");
