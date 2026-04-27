const mongoose = require("mongoose");

const siteVisitSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },

  date: Date,

  visitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  notes: String,

  photos: [String] // image URLs
}, { timestamps: true });

module.exports = mongoose.model("SiteVisit", siteVisitSchema);