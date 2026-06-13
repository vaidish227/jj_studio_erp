const mongoose = require("mongoose");

/**
 * ProjectPlan — one document per project.
 * Holds aggregated planner-level settings and rolling totals that would otherwise
 * require an aggregation query on every master-sheet read. Lazily created on
 * first read (controller upserts {projectId}).
 */
const projectPlanSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      unique: true,
      index: true,
    },

    // Baseline frozen at first save; only re-baselined with planner.baseline perm
    baselineDate: { type: Date },

    // --- Plan activation ("Make Plan Effective") ---
    // Set when the project manager runs the activation flow. Once set, the
    // plan is considered committed: assignees have been notified and
    // re-activation is blocked. Re-assigning a task afterward goes through
    // the regular reassign flow (which has its own notify path).
    effectiveAt: { type: Date },
    effectiveBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    effectiveNotifyChannels: {
      mail:     { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
    },

    // Rolling totals — recomputed by planner controller after any row mutation
    totalPlannedDays:  { type: Number, default: 0, min: 0 },
    totalPlannedHours: { type: Number, default: 0, min: 0 },
    totalActualHours:  { type: Number, default: 0, min: 0 },

    // Optional override of Project.estimatedCompletionDate purely for planner views
    deadlineOverride: { type: Date },

    // Workload default (overridable per User via User.capacityHoursPerWeek)
    defaultDesignerCapacityHoursPerWeek: { type: Number, default: 40, min: 1 },

    // Per-user column-show preferences keyed by userId
    columnPresets: { type: mongoose.Schema.Types.Mixed, default: {} },

    excelImportLogIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlannerImportLog",
    }],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    collection: "pms_project_plans",
  }
);

module.exports = mongoose.model("ProjectPlan", projectPlanSchema, "pms_project_plans");
