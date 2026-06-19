const mongoose = require("mongoose");
const crypto = require("crypto");

// A shareable link that ties a ClientFormTemplate to a specific project.
// Each link has a unique token — clients open /forms/:token to fill the form.
const clientFormLinkSchema = new mongoose.Schema(
  {
    projectId:   { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    templateId:  { type: mongoose.Schema.Types.ObjectId, ref: "ClientFormTemplate", required: true },
    token:       {
      type: String,
      default: () => crypto.randomBytes(24).toString("hex"),
      unique: true,
      index: true,
    },
    status:      { type: String, enum: ["active", "completed", "expired"], default: "active" },
    expiresAt:   Date,
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    submittedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("ClientFormLink", clientFormLinkSchema);
