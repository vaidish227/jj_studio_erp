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

    // --- Master Sheet "Work Status" column ---
    // Manual per-row tracking status set by users on the Master Sheet.
    // Intentionally independent of the workflow `status` field below — the
    // engine never reads or writes it, so users can track work freely without
    // touching gate/approval transitions.
    workStatus: {
      type: String,
      enum: ["pending", "in_progress", "completed", "on_hold", "cancelled"],
      default: "pending",
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
    // Workflow phase this task belongs to (e.g. "kickoff" / "design" / "procurement").
    // Snapshotted at seed time from WorkflowTemplate.phases.taskKeys so the
    // master-sheet UI can render phase headers without re-resolving the template.
    // Optional — tasks added manually via "Add Row" can carry it too.
    phase: { type: String, trim: true },
    // Stable template key the task was spawned from. Lets the planner UI
    // detect which rows came from a template vs ad-hoc additions, and supports
    // future per-project plan editing flows.
    templateTaskKey: { type: String, trim: true },
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

    // --- Scheduling engine (parent/subtask + day-based auto-shift) ---
    // All fields default so existing/standalone tasks behave exactly as before.
    // Planned dates live in `planning.plannedStartDate/plannedEndDate`; actuals
    // in top-level `startDate`/`completedAt`; the dependency graph in `dependsOn`.
    // The engine NEVER writes `status` — it mutates planned dates + the audit
    // fields below via bulkWrite, so the status→workStatus/progress hooks below
    // are never tripped.

    // Parent of a subtask; null = top-level / standalone task.
    parentTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    // Denormalized flag mirroring `!!parentTaskId` for cheap grouping/filtering.
    isSubtask: { type: Boolean, default: false },
    // Manual ordering of children under their parent.
    subtaskOrder: { type: Number, default: 0 },

    // Canonical span in days. null ⇒ derived from planned dates at read time.
    durationDays: { type: Number, min: 0, default: null },

    // When true, the schedule engine never shifts this task (manual or cron).
    scheduleLocked: { type: Boolean, default: false },
    // Tri-state per-task auto-shift override. null ⇒ inherit project setting.
    autoShiftEnabled: { type: Boolean, default: null },
    // Per-task day-arithmetic override. null ⇒ inherit project.settings.calendarMode.
    calendarMode: {
      type: String,
      enum: ["calendar_days", "working_days", null],
      default: null,
    },
    // Why a manual date/lock override was applied (shown in the schedule drawer).
    manualOverrideReason: { type: String, default: "" },

    // Audit counters for shifting.
    shiftCount:    { type: Number, default: 0 },
    lastShiftedAt: { type: Date, default: null },     // cron idempotency guard (Phase 2)
    lastShiftedBy: {                                   // null = system / cron
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Capped audit trail (engine slices to the most recent 50 on push).
    shiftHistory: [
      {
        _id: false,
        shiftedAt:  { type: Date },
        shiftedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        shiftDays:  { type: Number },                 // signed
        source: {                                     // who/what triggered it
          type: String,
          enum: ["manual", "cron", "cascade", "parent", "recalculate"],
        },
        reason:    { type: String, default: "" },
        fromStart: { type: Date },
        toStart:   { type: Date },
        fromEnd:   { type: Date },
        toEnd:     { type: Date },
        triggeredByTaskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
      },
    ],

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

    // --- Plan activation ---
    // Set when this task's assignee was formally notified during the project
    // plan activation flow ("Make Plan Effective"). Used to skip re-notifying
    // on subsequent activations. Null = assignment is still a draft as far
    // as the assignee is concerned.
    delegatedAt: Date,

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
// Dashboard Designer-KRA "done in window" gate (completedAt / approvedAt fallback)
taskSchema.index({ completedAt: 1 });
taskSchema.index({ approvedAt: 1 });
// Scheduling engine — parent/subtask grouping, cron overdue scan, lock filters
taskSchema.index({ parentTaskId: 1 });
taskSchema.index({ projectId: 1, isSubtask: 1 });
taskSchema.index({ lastShiftedAt: 1 });
taskSchema.index({ projectId: 1, scheduleLocked: 1 });

// --- workStatus + progress auto-sync ---
// The Master Sheet "Work Status" and "Progress" columns auto-follow workflow
// `status` transitions via the hooks below. An explicit write of either field
// in the same operation always wins over the derived value; "cancelled" has
// no workflow counterpart and stays manual-only.
const WORK_STATUS_FROM_STATUS = {
  not_started: "pending",
  blocked: "pending",
  in_progress: "in_progress",
  pending_review: "in_progress",
  revision_requested: "in_progress",
  pending_client_approval: "in_progress",
  approved: "completed",
  released_to_site: "completed",
  completed: "completed",
  on_hold: "on_hold",
};

// on_hold is intentionally absent — pausing a task keeps its last percent.
const PROGRESS_FROM_STATUS = {
  not_started: 0,
  blocked: 0,
  in_progress: 50,
  revision_requested: 50,
  pending_review: 80,
  pending_client_approval: 90,
  approved: 100,
  released_to_site: 100,
  completed: 100,
};

// Document middleware — covers task.save() flows (workflow engine, controllers).
// Mongoose 9: no `next` callback — sync middleware completes on return.
taskSchema.pre("save", function () {
  if (!this.isModified("status")) return;
  if (!this.isModified("workStatus")) {
    const ws = WORK_STATUS_FROM_STATUS[this.status];
    if (ws) this.workStatus = ws;
  }
  if (!this.isModified("planning.progressPercent")) {
    const pct = PROGRESS_FROM_STATUS[this.status];
    if (pct != null) this.set("planning.progressPercent", pct);
  }
});

// Query middleware — covers findOneAndUpdate/updateOne/updateMany flows
taskSchema.pre(["findOneAndUpdate", "updateOne", "updateMany"], function () {
  const u = this.getUpdate();
  if (!u || Array.isArray(u)) return; // skip aggregation pipeline updates
  const status = u.$set?.status ?? u.status;
  if (!status) return;

  const hasExplicitWS =
    (u.$set && Object.prototype.hasOwnProperty.call(u.$set, "workStatus")) ||
    Object.prototype.hasOwnProperty.call(u, "workStatus");
  const hasExplicitProgress =
    (u.$set && (Object.prototype.hasOwnProperty.call(u.$set, "planning.progressPercent") ||
                u.$set.planning?.progressPercent != null)) ||
    Object.prototype.hasOwnProperty.call(u, "planning.progressPercent") ||
    u.planning?.progressPercent != null;

  const ws  = hasExplicitWS ? null : WORK_STATUS_FROM_STATUS[status];
  const pct = hasExplicitProgress ? null : PROGRESS_FROM_STATUS[status];
  if (ws == null && pct == null) return;

  // A Mongo update can't mix bare fields with $-operators. Callers that
  // pass `{ status: "x" }` (no $set) get their bare fields moved into
  // $set before derived fields are added, so the final update stays valid.
  if (!u.$set) {
    u.$set = {};
    for (const key of Object.keys(u)) {
      if (key !== "$set" && !key.startsWith("$")) {
        u.$set[key] = u[key];
        delete u[key];
      }
    }
  }
  if (ws != null)  u.$set.workStatus = ws;
  if (pct != null) u.$set["planning.progressPercent"] = pct;
});

// Exposed for code paths that bypass middleware (e.g. Task.bulkWrite in Excel import)
taskSchema.statics.WORK_STATUS_FROM_STATUS = WORK_STATUS_FROM_STATUS;
taskSchema.statics.PROGRESS_FROM_STATUS = PROGRESS_FROM_STATUS;


module.exports = mongoose.model("Task", taskSchema, "pms_tasks");