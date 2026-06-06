const mongoose = require("mongoose");

/**
 * PMS Task Schema
 * Represents specialized sub-flows (AC, Kitchen, Bathroom, Technical Drawings, etc.)
 */
const taskSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    // --- Task Classification ---
    taskType: {
      type: String,
      enum: [
        "ac_coordination",
        "technical_drawing",
        "kitchen_drawing",
        "bathroom_drawing",
        "automation_coordination",
        "3d_render",
        "concept_making",
        "furniture_layout",
        "site_measurement",
        "civil_drawing",
        // Phase 1 — Workflow Engine additions (PDF-accurate task graph)
        "mep_collection",
        "concept_first_meeting",
        "concept_feedback_meeting",
        "handover_signoff",
        // Phase 2 — Kitchen routing children (in_house branch)
        "kitchen_detail_elevation",
        "kitchen_3d",
        "kitchen_technical_drawings",
        "kitchen_release_ready",
        // Phase 2 — Kitchen routing children (outsourced branch)
        "kitchen_vendor_purchase",
        "kitchen_tentative_quote",
        "kitchen_client_meeting",
        "kitchen_vendor_finalization",
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    // --- Ownership ---
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Can be Designer B, C, or D
    },

    // --- Status & Workflow ---
    status: {
      type: String,
      enum: [
        "not_started",
        "blocked",                  // Phase 1 — Workflow Engine: prerequisite not met
        "in_progress",
        "pending_review",           // designer submitted to PM/PC/MD for internal review
        "revision_requested",       // PM/PC/MD sent back with change instructions
        "pending_client_approval",
        "approved",
        "released_to_site",
        "completed",
        "on_hold",
      ],
      default: "not_started",
    },

    // --- Workflow Engine (Phase 1) ---
    // Cached list of TaskDependency.fromTaskId entries. Engine seeds these
    // at workflow-template instantiation; gateEnforcement reads them to decide
    // 409 BLOCKED_BY_DEPENDENCY.
    dependsOn: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
      },
    ],
    // Computed at write-time by engine; "open" = at least one gate blocks this task.
    gateStatus: {
      type: String,
      enum: ["none", "open", "closed", "overridden"],
      default: "none",
    },
    dayOffsetFromProjectStart: { type: Number, default: 0 },
    // For kitchen_drawing branch: "in_house" | "outsourced" | null (not decided)
    routing: {
      type: String,
      enum: ["in_house", "outsourced", null],
      default: null,
    },

    // --- Checklist (Dynamic based on flow chart) ---
    checklist: [
      {
        item: String,
        isCompleted: { type: Boolean, default: false },
        completedAt: Date,
      },
    ],

    // --- External Quotes Coordination (For AC, Automation, Kitchen) ---
    externalCoordination: {
      isNeeded: { type: Boolean, default: false },
      vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
      quotationUrl: String,
      amount: Number,
      isApprovedByClient: { type: Boolean, default: false },
    },

    // --- Timeline ---
    startDate: Date,
    dueDate: Date,
    completedAt: Date,

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    notes: String,

    // --- Submission (designer → PM review) ---
    submissionNotes: String,
    submittedAt: Date,

    // --- Revision (PM → designer) ---
    revisionInstructions: String,
    revisionDeadline: Date,

    // --- Approval tracking ---
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: Date,

    // --- Reassignment tracking ---
    reassignedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reassignedAt: Date,
    reassignedReason: String,

    // --- Status remarks ---
    holdReason: String,   // required when status → on_hold
    delayReason: String,  // optional note explaining a deadline extension

    // --- Project Planner / Master Plan (Phase 1) ---
    // Master-sheet fields surfaced in the Planner module. All new planner
    // mutations go through planner endpoints; legacy Task code is untouched.
    planning: {
      // Location
      floor:    { type: String, default: "" },
      area:     { type: String, default: "" },
      zoneName: { type: String, default: "" }, // mirrored to attached Drawings on save
      room:     { type: String, default: "" },
      block:    { type: String, default: "" },

      // Drawing taxonomy hint for tasks without a Drawing yet
      proposedDrawingType: { type: String, default: "" },
      proposedSubCategory: { type: String, default: "" },
      drawingCode:         { type: String, default: "" },

      // Planning
      plannedStartDate:     { type: Date },
      plannedEndDate:       { type: Date },
      plannedHours:         { type: Number, default: 0, min: 0 },
      bufferDays:           { type: Number, default: 0, min: 0 },
      targetSubmissionDate: { type: Date },

      // Effort actuals (top-level startDate/completedAt cover wall-clock)
      actualHours:     { type: Number, default: 0, min: 0 },
      progressPercent: { type: Number, default: 0, min: 0, max: 100 },

      // Classification
      complexity: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium",
      },
      requiredInputs: [{ type: String }],
      siteMeasurementStatus: {
        type: String,
        enum: ["not_required", "pending", "done"],
        default: "not_required",
      },

      // Additional planner roles (top-level assignedTo is the primary designer)
      designLeadId:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      reviewerId:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      coordinatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

      // Client approval routing — joins to project.clientApprovals[].type
      requiresClientApproval: { type: Boolean, default: false },
      clientApprovalKey:      { type: String, default: "" },

      // Baseline snapshot (frozen at first save unless re-baselined)
      baselinePlannedStartDate: { type: Date },
      baselinePlannedEndDate:   { type: Date },
      // Set by nightly delay scan when delay first crosses threshold
      delayAlertedAt: { type: Date },

      // Optional reference doc (brief/input file)
      referenceFileUrl: { type: String, default: "" },
    },
  },
  {
    timestamps: true,
    collection: "pms_tasks",
  }
);

// Indexes
taskSchema.index({ projectId: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ taskType: 1 });
// Planner — delay scans and zone filters
taskSchema.index({ projectId: 1, "planning.plannedEndDate": 1 });
taskSchema.index({ projectId: 1, "planning.zoneName": 1 });


module.exports = mongoose.model("Task", taskSchema, "pms_tasks");