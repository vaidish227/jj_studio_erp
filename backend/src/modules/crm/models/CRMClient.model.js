const mongoose = require("mongoose");

const crmClientSchema = new mongoose.Schema(
  {
    // ─── Unique Tracking ID ──────────────────────────────────────────
    trackingId: {
      type: String,
      unique: true,
    },

    // ─── Source Tracking ─────────────────────────────────────────────
    source: {
      type: String,
      enum: ["walk_in", "referral", "website", "instagram", "whatsapp", "other"],
      default: "walk_in",
    },

    // ─── Basic Enquiry Information ───────────────────────────────────
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: String,

    // ─── Client Info Completion Flag ─────────────────────────────────
    clientInfoCompleted: {
      type: Boolean,
      default: false,
    },

    // ─── Spouse / Partner Information ────────────────────────────────
    spouse: {
      name: String,
      phone: String,
      email: String,
      dob: Date,
      anniversary: Date,
    },

    // ─── Extended Client Information (filled in Client Info Form) ────
    dob: Date,
    anniversary: Date,
    address: String, // Residential address
    companyName: String,
    officeAddress: String,
    children: [
      {
        age: Number,
      },
    ],

    // ─── Project / Requirement Information ───────────────────────────
    projectType: {
      type: String,
      enum: ["Residential", "Commercial"],
    },
    area: Number,
    budget: Number,
    city: String,
    siteAddress: {
      buildingName: String,
      tower: String,
      unit: String,
      floor: String,
      fullAddress: String,
      city: String,
    },

    // ─── Referral Information ────────────────────────────────────────
    referredBy: String,
    referrerPhone: String,

    // ─── Lifecycle & Status ──────────────────────────────────────────
    status: {
      type: String,
      enum: [
        "new",
        "contacted",
        "meeting_done",
        "proposal_sent",
        "converted",
        "lost",
      ],
      default: "new",
    },
    lifecycleStage: {
      type: String,
      enum: [
        "enquiry",
        "meeting_scheduled",
        "thank_you_sent",
        "client_info_pending",
        "kit",
        "followup_due",
        "show_project",
        "interested",
        "proposal_sent",
        "advance_received",
        "project_moved",
        "project_started",
        "converted",
        "lost",
      ],
      default: "enquiry",
    },
    priority: {
      type: String,
      enum: ["high", "medium", "low"],
      default: "medium",
    },

    // ─── Timeline & History (Event Sourcing) ─────────────────────────
    interactionHistory: [
      {
        type: {
          type: String,
          enum: [
            "note",
            "meeting",
            "thank_you",
            "followup",
            "client_info",
            "show_project",
            "proposal",
            "advance_payment",
            "project",
            "status_change",
            "communication",
            "esign",
            "payment",
            "promotional",
            "migration",
          ],
          default: "note",
        },
        title: String,
        description: String,
        metadata: mongoose.Schema.Types.Mixed,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ─── Communication Tracking (WhatsApp / Email / SMS) ─────────────
    communicationLogs: [
      {
        channel: { type: String, enum: ["WhatsApp", "Email", "SMS"] },
        direction: { type: String, enum: ["Inbound", "Outbound"] },
        content: String,
        subject: String,
        status: String, // sent, delivered, opened, failed
        messageId: String, // external tracking ID
        timestamp: { type: Date, default: Date.now },
      },
    ],

    // ─── Relationship Tracking (Keep In Touch Module) ────────────────
    relationshipNotes: [
      {
        occasion: String, // "birthday", "anniversary", "festival", "custom"
        message: String,
        sentAt: Date,
        channel: String,
      },
    ],

    // ─── Automation Tracking ─────────────────────────────────────────
    automation: {
      thankYouScheduledFor: Date,
      thankYouSentAt: Date,
      followupReminderFor: Date,
      followupReminderSentAt: Date,
    },

    // ─── Client Info Timestamps ──────────────────────────────────────
    clientInfoCompletedAt: Date,

    // ─── Show Project ────────────────────────────────────────────────
    showProject: {
      assets: [
        {
          type: {
            type: String,
            enum: ["image", "video", "template", "link"],
            default: "image",
          },
          title: String,
          url: String,
          note: String,
        },
      ],
      siteVisitPlanned: {
        type: Boolean,
        default: false,
      },
      siteVisitNote: String,
      showcasedAt: Date,
    },

    // ─── Advance Payment ─────────────────────────────────────────────
    advancePayment: {
      received: {
        type: Boolean,
        default: false,
      },
      amount: Number,
      receivedAt: Date,
      note: String,
      movedToProjectManagement: {
        type: Boolean,
        default: false,
      },
      movedAt: Date,
    },

    // ─── Future Module Anchor Points ─────────────────────────────────
    linkedProjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project",
      },
    ],
    linkedInvoices: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Invoice",
      },
    ],

    // ─── Metadata ────────────────────────────────────────────────────
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    notes: String,
    lastInteractionAt: Date,
  },
  { timestamps: true }
);

// ─── Auto-generate Tracking ID ──────────────────────────────────────
crmClientSchema.pre("validate", async function () {
  if (!this.trackingId) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments() + 1;
    this.trackingId = `CLI-${year}-${String(count).padStart(4, "0")}`;
  }
});

// ─── Indexes for fast lookups ───────────────────────────────────────
crmClientSchema.index({ phone: 1 });
crmClientSchema.index({ email: 1 });
crmClientSchema.index({ trackingId: 1 });
crmClientSchema.index({ status: 1, lifecycleStage: 1 });

module.exports = mongoose.model("CRMClient", crmClientSchema);
