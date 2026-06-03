const mongoose = require("mongoose");

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
      // Optional — not every project originates from a formal proposal
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
    budget: Number,

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

    // --- Workflow Engine (Phase 1) ---
    // `phase` is the engine's view of where the project sits in the workflow graph.
    // Decoupled from `status` (lifecycle) so the two can evolve independently.
    // Standardised to exactly 7 phases — handover is the terminal phase.
    phase: {
      type: String,
      enum: [
        "kickoff",
        "layout",
        "design",
        "procurement",
        "release",
        "execution",
        "handover",
      ],
      default: "kickoff",
    },
    workflowTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkflowTemplate",
    },
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    currentGateIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "ApprovalGate" },
    ],

    // --- Core Team ---
    primaryDesigner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // --- Sub-Designer Assignments (per Design Sub-Flow) ---
    designerB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    designerC: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    designerD: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    designerE: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    contractor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // --- Kickstart Process Tracking ---
    kickstartCompleted: {
      type: Boolean,
      default: false,
    },
    kickstartData: {
      mainGroupCreated:        { type: Boolean, default: false },
      drawingGroupCreated:     { type: Boolean, default: false },
      supervisionGroupCreated: { type: Boolean, default: false },
      paymentGroupCreated:     { type: Boolean, default: false },
      detailFormSentToClient:  { type: Boolean, default: false },
      labourQuotationSent:     { type: Boolean, default: false },
    },

    // --- Client Approvals Tracking (PDF mandatory sign-offs) ---
    // furniture_layout added in Phase 1 — gates the entire parallel design tracks
    clientApprovals: [
      {
        type: {
          type: String,
          enum: [
            "furniture_layout",
            "ac",
            "automation",
            "kitchen",
            "bathroom_material",
            "cp_fittings",
            "wall_floor_material",
          ],
        },
        status: {
          type: String,
          enum: ["pending", "obtained", "not_applicable"],
          default: "pending",
        },
        obtainedAt: Date,
        notes: String,
      },
    ],

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

projectSchema.index({ trackingId: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ clientId: 1 });
projectSchema.index({ proposalId: 1 });
projectSchema.index({ primaryDesigner: 1 });
projectSchema.index({ supervisor: 1 });

projectSchema.pre("validate", async function () {
  if (this.isNew && !this.trackingId) {
    try {
      const year = new Date().getFullYear();
      const count = await mongoose.model("Project").countDocuments();
      this.trackingId = `PRJ-${year}-${String(count + 1).padStart(4, "0")}`;
    } catch (error) {
      console.error("Error generating trackingId:", error);
    }
  }
});

module.exports = mongoose.model("Project", projectSchema, "pms_projects");
