const mongoose = require("mongoose");

/**
 * VendorEngagement — Phase 2 state machine for per-vendor coordination.
 *
 * Flow: requested → quoted → client_approved → po_emitted → delivered → site_received
 *
 * Reuses existing assets:
 *   - Vendor model (registry)
 *   - PurchaseOrder model (poId back-ref once emitted)
 *   - WhatsAppProjectGroup (whatsappGroupId per-engagement group)
 *   - Task.externalCoordination (kept in sync via taskId — see vendorEngagementService)
 *
 * Rules:
 *   - PO emission is blocked unless status === "client_approved".
 *   - Marking client_approved propagates to Project.clientApprovals[<kind>] = "obtained"
 *     which triggers the workflowEngine cascade and closes the corresponding gate.
 */

const ENGAGEMENT_STATUSES = [
  "requested",
  "quoted",
  "client_approved",
  "po_emitted",
  "delivered",
  "site_received",
  "cancelled",
];

const VENDOR_KINDS = ["ac", "automation", "kitchen"];

const historyEntrySchema = new mongoose.Schema(
  {
    at:        { type: Date, default: Date.now },
    actorId:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    fromStatus: String,
    toStatus:   String,
    notes:      String,
  },
  { _id: false }
);

const vendorEngagementSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    // Source task that spawned this engagement (ac_coordination, automation_coordination, kitchen_drawing).
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    vendorKind: {
      type: String,
      enum: VENDOR_KINDS,
      required: true,
    },

    // Per-vendor WhatsApp group (Phase 2 auto-creation).
    whatsappGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WhatsAppProjectGroup",
    },

    // Quote tracking
    quotationUrl: String,
    amount:        Number,
    currency:      { type: String, default: "INR" },

    // Approval / PO links
    clientApprovalId: {
      // The Approval doc when explicit; for Phase 2 we mostly rely on Project.clientApprovals[kind]
      type: mongoose.Schema.Types.ObjectId,
      ref: "PMSApproval",
    },
    clientApprovalGateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApprovalGate",
    },
    poId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
    },

    status: {
      type: String,
      enum: ENGAGEMENT_STATUSES,
      default: "requested",
    },
    history: { type: [historyEntrySchema], default: [] },
    notes:   String,

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    collection: "pms_vendor_engagements",
  }
);

vendorEngagementSchema.index({ projectId: 1, vendorKind: 1 });
vendorEngagementSchema.index({ vendorId: 1, status: 1 });

vendorEngagementSchema.statics.STATUSES = ENGAGEMENT_STATUSES;
vendorEngagementSchema.statics.KINDS = VENDOR_KINDS;

module.exports = mongoose.model(
  "VendorEngagement",
  vendorEngagementSchema,
  "pms_vendor_engagements"
);
