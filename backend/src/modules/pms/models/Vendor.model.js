const mongoose = require("mongoose");

/**
 * PMS Vendor Schema
 * Represents external agencies, contractors, or suppliers involved in specialized project tasks.
 */
const vendorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Vendor name is required"],
      trim: true,
    },
    category: {
      type: String,
      enum: ["AC", "Automation", "Kitchen", "Carpentry", "Electrical", "Plumbing", "Other"],
      required: true,
    },
    
    // --- Contact Details ---
    contactPerson: String,
    phone: {
      type: String,
      required: true,
    },
    email: String,
    address: String,

    // --- Performance Tracking ---
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "blacklisted"],
      default: "active",
    },

    notes: String,
  },
  {
    timestamps: true,
    collection: "pms_vendors",
  }
);

module.exports = mongoose.model("Vendor", vendorSchema, "pms_vendors");
