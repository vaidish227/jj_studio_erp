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
    // --- Master Sheet plan snapshot (project-specific template config) ---
    // Frozen copy of the workflow template (AFTER any initiation-time
    // customization overlay) taken when seedProject runs. The planner reads
    // THIS instead of the live WorkflowTemplate, so edits to the global
    // default after initiation can never change an existing project's master
    // sheet. Replaced only by the explicit per-project "Change Template" flow.
    planSnapshot: {
      baseTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: "WorkflowTemplate" },
      templateName:   { type: String, trim: true },
      appliedAt:      Date,
      // true when the MD customized the plan during initiation
      customized:     { type: Boolean, default: false },
      phases: [
        {
          _id: false,
          name:     { type: String, trim: true },
          order:    Number,
          taskKeys: [String],
        },
      ],
      tasks: [
        {
          _id: false,
          key:      { type: String, trim: true },
          title:    { type: String, trim: true },
          taskType: String,
          dayOffsetFromProjectStart: Number,
          plannedDays:  Number,
          plannedHours: Number,
          priority:     String,
          responsibilitySlug:    String,
          checklistTemplateName: String,
          notes: String,
        },
      ],
    },
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    currentGateIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "ApprovalGate" },
    ],

    // --- Dynamic Team Assignments ---
    // Each row is a unit of work on this project + the users assigned to it.
    // A row carries EITHER a responsibilityId (reuse from master list — used
    // by notification routing via slug) OR a customName (per-project work
    // item typed by the manager — not reusable elsewhere). At least one of
    // the two must be set; both is allowed but customName wins for display.
    assignments: [
      {
        responsibilityId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Responsibility",
        },
        customName: {
          type: String,
          trim: true,
          maxlength: 100,
        },
        users: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        ],
      },
    ],

    // --- Migration Backup (D3) ---
    // Snapshot of the original 7-field team taken by
    // scripts/migrateProjectTeams.js. Used by --rollback. Do NOT read in
    // application code.
    _legacyTeam: {
      primaryDesigner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      supervisor:      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      designerB:       { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      designerC:       { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      designerD:       { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      designerE:       { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      contractor:      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      migratedAt:      Date,
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
projectSchema.index({ "assignments.users": 1 });
projectSchema.index({ "assignments.responsibilityId": 1 });

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
