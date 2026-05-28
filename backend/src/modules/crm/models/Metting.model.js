const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CRMClient",
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    type: {
      type: String,
      enum: ["call", "office", "site"],
      required: true,
    },

    notes: String,

    status: {
      type: String,
      enum: ["scheduled", "rescheduled", "completed", "cancelled", "follow_up_required"],
      default: "scheduled",
    },

    durationMinutes: {
      type: Number,
      default: 60,
    },

    // Staff member assigned to conduct this meeting
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Captured after meeting completion
    outcome: String,

    // Key signal: drives the CRM "Interested" lifecycle transition
    clientInterested: {
      type: Boolean,
      default: null, // null = not yet captured
    },

    // Next follow-up date (set when follow_up_required)
    followUpDate: Date,

    // Original date before reschedule (audit trail)
    rescheduledFrom: Date,

    // ─── Minutes of Meeting (recorded after meeting completion) ────────
    mom: {
      attendees: {
        staff: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        ],
        clients: [String], // free-text names from client side
      },
      discussionSummary: String,
      decisions: [String],
      actionItems: [
        {
          description: { type: String, required: true },
          assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          dueDate: Date,
          status: {
            type: String,
            enum: ["open", "done"],
            default: "open",
          },
          // Linked Followup created from this action item
          followUpId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Followup",
          },
        },
      ],
      recordedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      recordedAt: Date,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Meeting", meetingSchema);