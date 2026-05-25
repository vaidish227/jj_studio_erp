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


module.exports = mongoose.model("Task", taskSchema, "pms_tasks");