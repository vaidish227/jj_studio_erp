const mongoose = require("mongoose");

const mailTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    category: {
      type: String,
      enum: ["welcome", "meeting", "proposal", "followup", "reminder", "approval", "marketing", "system", "custom"],
      default: "custom",
    },
    subject: { type: String, required: true, trim: true },
    htmlBody: { type: String, required: true },
    textBody: { type: String },
    variables: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

mailTemplateSchema.index({ category: 1, isActive: 1 });

module.exports = mongoose.model("MailTemplate", mailTemplateSchema);
