const mongoose = require("mongoose");


/**
 * PMS Project Schema
 * Represents the main project entity linked to a CRM Client and an approved Proposal.
 */
const projectSchema = new mongoose.Schema(
  {
    // --- External Links ---
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CRMClient",
      required: [true, "Client reference is required"],
    },
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: [true, "Proposal reference is required"],
    },

    // --- Identification ---
    trackingId: {
      type: String,
      unique: true,
      required: true,
    },
    name: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
    },

    // --- Project Specs ---
    projectType: {
      type: String,
      enum: ["Residential", "Commercial"],
      required: true,
    },
    siteAddress: {
      buildingName: String,
      tower: String,
      unit: String,
      floor: String,
      fullAddress: { type: String, required: true },
      city: String,
    },
    area: Number,
    budget: Number, // Sync from approved Proposal amount

    // --- Status & Lifecycle ---
    status: {
      type: String,
      enum: [
        "design_phase",
        "execution_phase",
        "handover",
        "completed",
        "on_hold",
        "cancelled",
      ],
      default: "design_phase",
    },

    // --- Team Assignment ---
    primaryDesigner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Refers to Designer A in the flow
    },
    supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // --- Timeline ---
    startDate: {
      type: Date,
      default: Date.now,
    },
    estimatedCompletionDate: Date,
    actualCompletionDate: Date,

    // --- Metadata ---
    notes: String,
    tags: [String],
  },
  {
    timestamps: true,
    collection: "pms_projects",
  }
);

// Indexes for performance
projectSchema.index({ trackingId: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ clientId: 1 });
projectSchema.index({ proposalId: 1 });
projectSchema.index({ primaryDesigner: 1 });
projectSchema.index({ supervisor: 1 });


// Pre-save hook to ensure trackingId (if not provided by controller)
projectSchema.pre("validate", async function () {
  if (this.isNew && !this.trackingId) {
    try {
      const year = new Date().getFullYear();
      const ProjectModel = mongoose.model("Project", projectSchema, "pms_projects");
      const count = await ProjectModel.countDocuments();
      this.trackingId = `PRJ-${year}-${String(count + 1).padStart(4, "0")}`;
    } catch (error) {
      console.error("Error generating trackingId:", error);
    }
  }
});



module.exports = mongoose.model("Project", projectSchema, "pms_projects");