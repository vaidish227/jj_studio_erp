const mongoose = require("mongoose");

/**
 * HandoverPackage — Phase 3b.
 *
 * Single-instance-per-project document that orchestrates the Design → Execution
 * handover. Created when the design lead requests handover; closed when the
 * supervisor accepts. Closing the package closes gate_handover and advances
 * Project.phase → execution.
 *
 * Flow:
 *   requested  → design lead opens with the complete drawing set
 *   signed     → design lead signoff captured
 *   accepted   → supervisor signoff captured (terminal)
 *   rejected   → supervisor flagged issues (back to requested)
 *
 * Drawing set:
 *   Snapshot of all drawings the design team is handing over. Each entry
 *   references the live Drawing, captures the version, and the supervisor can
 *   tick them off as they walk through them.
 */

const HANDOVER_STATUSES = ["requested", "signed", "accepted", "rejected"];

const drawingItemSchema = new mongoose.Schema(
  {
    drawingId:  { type: mongoose.Schema.Types.ObjectId, ref: "Drawing" },
    title:      String,
    drawingType: String,
    version:    Number,
    walked:     { type: Boolean, default: false },  // supervisor toggles during walkthrough
    walkedAt:   Date,
    notes:      String,
  },
  { _id: true }
);

const punchListItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    raisedBy:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    raisedAt:    { type: Date, default: Date.now },
    severity:    {
      type: String,
      enum: ["minor", "major", "blocker"],
      default: "minor",
    },
    resolvedAt:  Date,
    resolvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolution:  String,
  },
  { _id: true }
);

const handoverPackageSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
      unique: true,            // one handover per project
    },

    status: {
      type: String,
      enum: HANDOVER_STATUSES,
      default: "requested",
    },

    // Snapshot of drawings included in the handover
    drawings: { type: [drawingItemSchema], default: [] },

    // Walkthrough punch list — items raised, with optional resolution
    punchList: { type: [punchListItemSchema], default: [] },

    // Design lead signoff
    designLeadId:        { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    designLeadSignedAt:  Date,
    designLeadNotes:     String,

    // Supervisor signoff
    supervisorId:        { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    supervisorAcceptedAt: Date,
    supervisorRejectedAt: Date,
    supervisorNotes:     String,
    supervisorRejectionReason: String,

    // Link to the corresponding gate so we can close it on acceptance
    gateId: { type: mongoose.Schema.Types.ObjectId, ref: "ApprovalGate" },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes:     String,
  },
  {
    timestamps: true,
    collection: "pms_handover_packages",
  }
);

handoverPackageSchema.index({ projectId: 1, status: 1 });

handoverPackageSchema.statics.STATUSES = HANDOVER_STATUSES;

module.exports = mongoose.model(
  "HandoverPackage",
  handoverPackageSchema,
  "pms_handover_packages"
);
