const mongoose = require("mongoose");

/**
 * Delegation — a standalone, cross-department unit of delegated work.
 *
 * Independent of PMS `Task` (which is project-bound): a delegation can be pure
 * internal work (HR onboarding, GST filing, a marketing campaign) with no
 * project at all. `departmentId`, `projectId`, and `clientId` are ALL optional
 * — the system functions before any department is configured.
 *
 * MVP scope only. Deferred fields (subtasks/parentId, deliverables, dependsOn,
 * timeEntries, estimatedHours, SLA, recurrence, etc.) are intentionally absent
 * and will be added in their respective later phases.
 */

// Attachment subdocument — reference files (S3), MVP allows pdf/image/document.
const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    fileName: String,
    fileType: String,
    fileSize: Number,
    fileUrl: String,
    s3Bucket: String,
    s3Key: String,
    kind: { type: String, enum: ["image", "pdf", "document"], default: "document" },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// Lightweight checklist item (MVP — not full subtasks).
const checklistItemSchema = new mongoose.Schema(
  {
    item: { type: String, required: true, trim: true },
    isCompleted: { type: Boolean, default: false },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    completedAt: Date,
  },
  { _id: true }
);

const delegationSchema = new mongoose.Schema(
  {
    // --- Identification ---
    trackingId: { type: String, unique: true, required: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    // --- Relationships (all optional in MVP) ---
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" }, // optional
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project" }, // optional context link
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "CRMClient" }, // optional context link (no client access in MVP)

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // --- Workflow (simplified MVP state machine) ---
    status: {
      type: String,
      enum: [
        "created",
        "assigned",
        "in_progress",
        "review",
        "completed",
        "reopened",
        "cancelled",
      ],
      default: "created",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    dueDate: Date,
    startedAt: Date,
    completedAt: Date,

    // --- Progress ---
    checklist: { type: [checklistItemSchema], default: [] },
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },

    // --- Attachments ---
    attachments: { type: [attachmentSchema], default: [] },
  },
  {
    timestamps: true,
    collection: "delegations",
  }
);

// ─── Indexes (hot query paths) ───────────────────────────────────────────────
// `trackingId` already has a unique index from `unique: true` on the field above.
delegationSchema.index({ assignedTo: 1, status: 1 });
delegationSchema.index({ createdBy: 1, status: 1 });
delegationSchema.index({ departmentId: 1, status: 1 });
delegationSchema.index({ status: 1, dueDate: 1 });
delegationSchema.index({ dueDate: 1 });
delegationSchema.index({ projectId: 1 });
delegationSchema.index({ clientId: 1 });
delegationSchema.index({ title: "text" });

// ─── Auto-generate trackingId (DLG-YYYY-0001) via an ATOMIC per-year counter ──
// Uses Counter.nextSeq (findOneAndUpdate $inc) so concurrent creates can never
// produce the same id — eliminating the race in the old countDocuments approach
// and giving a true per-year sequence that resets each January.
const Counter = require("./Counter.model");

delegationSchema.pre("validate", async function () {
  if (this.isNew && !this.trackingId) {
    const year = new Date().getFullYear();
    const seq = await Counter.nextSeq(`delegation:${year}`);
    this.trackingId = `DLG-${year}-${String(seq).padStart(4, "0")}`;
  }
});

module.exports = mongoose.model("Delegation", delegationSchema, "delegations");
