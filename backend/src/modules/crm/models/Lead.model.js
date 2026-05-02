const mongoose = require("mongoose");


const leadSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    email: String,

    spouse: {
      name: String,
      phone: String,
    },

    referredBy: String,
    referrerPhone: String,

    projectType: {
      type: String,
      enum: ["Residential", "Commercial"],
    },

    area: Number,
    budget: Number,
    city: String,
    siteAddress: String,

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

    meetingDate: Date,
    priority: {
      type: String,
      enum: ["high", "medium", "low"],
      default: "medium",
    },
    notes: String,

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client"
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
    automation: {
      thankYouScheduledFor: Date,
      thankYouSentAt: Date,
      followupReminderFor: Date,
      followupReminderSentAt: Date,
    },
    clientInfoCompletedAt: Date,
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
          ],
          default: "note",
        },
        title: String,
        description: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lead", leadSchema);