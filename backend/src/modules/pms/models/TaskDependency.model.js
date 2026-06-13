const mongoose = require("mongoose");

/**
 * TaskDependency — explicit edge between two tasks.
 * Replaces implicit gating with a queryable DAG.
 *
 * Semantics:
 *   fromTask must reach `requiredStatus` (default: "approved")
 *   before toTask can transition out of `not_started`/`blocked`.
 *
 * hardGate=true → gateEnforcement middleware rejects 409.
 * hardGate=false → soft warning surfaced in UI (BlockedByChip),
 *                  PM can transition the task freely.
 *
 * Records are created by workflowEngine.seedProject() from WorkflowTemplate.tasks.dependsOnKeys.
 */

const taskDependencySchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    fromTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    toTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    requiredStatus: {
      type: String,
      default: "approved",
    },
    hardGate: { type: Boolean, default: true },
    notes: { type: String, default: "" },
    // Source workflow template (for traceability + future re-seed)
    workflowTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkflowTemplate",
    },
  },
  {
    timestamps: true,
    collection: "pms_task_dependencies",
  }
);

taskDependencySchema.index({ projectId: 1, toTaskId: 1 });
taskDependencySchema.index({ projectId: 1, fromTaskId: 1 });
// Prevent duplicate edges
taskDependencySchema.index({ fromTaskId: 1, toTaskId: 1 }, { unique: true });

module.exports = mongoose.model(
  "TaskDependency",
  taskDependencySchema,
  "pms_task_dependencies"
);
