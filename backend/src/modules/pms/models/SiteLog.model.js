const mongoose = require("mongoose");

/**
 * PMS Site Log Schema
 * Represents daily reports and progress updates from the construction site.
 */
const siteLogSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    supervisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // --- Daily Data ---
    logDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    workPerformed: {
      type: String,
      required: true,
    },
    manpowerCount: {
      type: Number,
      default: 0,
    },

    // --- Issues & blockers ---
    issuesReported: String,
    blockers: String,

    // --- Visual Evidence ---
    sitePhotos: [
      {
        url: String,
        caption: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],

    // --- Link back to specific Drawing/Task ---
    relatedTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },
    relatedDrawingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Drawing",
    },

    // --- Status Verification ---
    status: {
      type: String,
      enum: ["submitted", "reviewed", "flagged"],
      default: "submitted",
    },
    managerNotes: String,
  },
  {
    timestamps: true,
    collection: "pms_sitelogs",
  }
);

module.exports = mongoose.model("SiteLog", siteLogSchema, "pms_sitelogs");
