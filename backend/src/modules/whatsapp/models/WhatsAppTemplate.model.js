const mongoose = require("mongoose");

const whatsappTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    category: {
      type: String,
      enum: ["welcome", "meeting", "proposal", "followup", "reminder", "approval", "marketing", "system", "custom"],
      default: "custom",
    },
    body:      { type: String, required: true },
    variables: [{ type: String, trim: true }],
    mediaType: {
      type: String,
      enum: ["none", "image", "document", "video"],
      default: "none",
    },
    mediaUrl:  { type: String },
    isActive:  { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

whatsappTemplateSchema.index({ category: 1, isActive: 1 });

module.exports = mongoose.model("WhatsAppTemplate", whatsappTemplateSchema);
