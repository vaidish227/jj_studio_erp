const mongoose = require("mongoose");

/**
 * PlannerImportLog — one document per Excel import attempt on a project.
 * Captures the file name, who ran it, what got updated/skipped, and any
 * per-row errors. Linked back to ProjectPlan via excelImportLogIds.
 */
const plannerImportLogSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    importedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    fileName: { type: String, default: "" },
    rowsRead:    { type: Number, default: 0, min: 0 },
    rowsUpdated: { type: Number, default: 0, min: 0 },
    rowsSkipped: { type: Number, default: 0, min: 0 },
    rowsFailed:  { type: Number, default: 0, min: 0 },
    // Up to 200 row-level error entries — keeps the log compact even for huge
    // imports. Excess errors are summarised in `truncated`.
    errors: [
      {
        row:     Number,
        taskId:  String,
        message: String,
      },
    ],
    truncated: { type: Boolean, default: false },
    // Dry-run mode? When true, no DB writes happened — useful for preview UX.
    dryRun: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: "pms_planner_import_logs",
  }
);

module.exports = mongoose.model(
  "PlannerImportLog",
  plannerImportLogSchema,
  "pms_planner_import_logs"
);
