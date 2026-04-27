const mongoose = require("mongoose");

const milestoneSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },

  title: String, // e.g. "Design Complete"
  description: String,

  dueDate: Date,
  completedAt: Date,

  status: {
    type: String,
    enum: ["pending", "in_progress", "completed"],
    default: "pending"
  }
}, { timestamps: true });

module.exports = mongoose.model("Milestone", milestoneSchema);