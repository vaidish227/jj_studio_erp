const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project"
    },

    materialName: String,

    category: {
      type: String,
      enum: [
        "Carpentry",
        "Electrical",
        "Plumbing",
        "Marble",
        "Paint",
        "Hardware",
        "Other"
      ]
    },

    unit: String, // sqft, nos, kg, etc.

    orderedQty: Number,
    receivedQty: {
      type: Number,
      default: 0
    },

    usedQty: {
      type: Number,
      default: 0
    },

    rate: Number,
    totalCost: Number,

    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor"
    },

    receivedDate: Date,

    notes: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("Inventory", inventorySchema);