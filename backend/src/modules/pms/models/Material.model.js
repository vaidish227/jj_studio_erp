const mongoose = require("mongoose");

/**
 * PMS Material Selection Schema
 * Tracks specific items selected by the client (Tiles, Fittings, Paint, etc.)
 * Referenced in Bathroom, Kitchen, and Interior design sub-flows.
 */
const materialSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task", // Link to Kitchen, Bathroom, or Interior task
    },

    // --- Material Details ---
    category: {
      type: String,
      enum: ["Flooring", "Fittings", "Paint", "Hardware", "Lighting", "Furniture", "Other"],
      required: true,
    },
    itemName: {
      type: String,
      required: true,
    },
    brand: String,
    specification: String, // Color, Size, Model number
    quantity: Number,
    unit: { type: String, default: "pcs" }, // pcs, sqft, ltr

    // --- Status & Selection ---
    selectionStatus: {
      type: String,
      enum: ["proposed", "selected_by_client", "ordered", "delivered_at_site"],
      default: "proposed",
    },
    
    selectedAt: Date,
    selectionSource: {
      type: String,
      enum: ["showroom", "catalog", "website", "sample_at_office"],
    },

    // --- Visuals ---
    images: [String],
    
    notes: String,
  },
  {
    timestamps: true,
    collection: "pms_materials",
  }
);

module.exports = mongoose.model("Material", materialSchema, "pms_materials");
