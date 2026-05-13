const mongoose = require("mongoose");

/**
 * PMS Site Visit Schema
 * Tracks visits made by Designers, Project Managers, or Principals to the site.
 * Different from daily site logs (which are by supervisors).
 */
const siteVisitSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    visitorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // --- Visit Details ---
    visitDate: {
      type: Date,
      default: Date.now,
    },
    purpose: {
      type: String,
      enum: ["Measurement", "Quality Check", "Client Meeting at Site", "Snag List", "Final Handover"],
      required: true,
    },
    
    observations: String,
    actionsRequired: String,

    // --- Media ---
    photos: [String],

    status: {
      type: String,
      enum: ["planned", "completed", "cancelled"],
      default: "completed",
    },

    // --- Next Steps ---
    nextVisitDate: Date,
  },
  {
    timestamps: true,
    collection: "pms_site_visits",
  }
);

module.exports = mongoose.model("SiteVisit", siteVisitSchema, "pms_site_visits");