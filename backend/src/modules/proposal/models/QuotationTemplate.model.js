const mongoose = require("mongoose");

const templateItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category: { type: String, default: "general" },
    unit: {
      type: String,
      enum: ["sqft", "rft", "nos", "job", "lumpsum", "mtr", "piece"],
      default: "sqft",
    },
    defaultRate: { type: Number, default: 0 },
  },
  { _id: false }
);

const quotationTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    projectType: {
      type: String,
      enum: ["residential", "commercial", "mixed"],
      default: "residential",
    },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    items: [templateItemSchema],
  },
  { timestamps: true, collection: "quotation_templates" }
);

module.exports = mongoose.model("QuotationTemplate", quotationTemplateSchema);
