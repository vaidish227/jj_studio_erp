const mongoose = require("mongoose");

// Stores one submitted client form response.
// `data` is a map of fieldId → value (string, array, or file URL).
const clientFormResponseSchema = new mongoose.Schema(
  {
    formLinkId:  { type: mongoose.Schema.Types.ObjectId, ref: "ClientFormLink", required: true },
    projectId:   { type: mongoose.Schema.Types.ObjectId, ref: "Project",        required: true },
    templateId:  { type: mongoose.Schema.Types.ObjectId, ref: "ClientFormTemplate", required: true },
    data:        { type: Map, of: mongoose.Schema.Types.Mixed },
    submittedAt: { type: Date, default: Date.now },
    // Auto-generated PDF stored as a ProjectDocument
    documentId:  { type: mongoose.Schema.Types.ObjectId, ref: "ProjectDocument" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ClientFormResponse", clientFormResponseSchema);
