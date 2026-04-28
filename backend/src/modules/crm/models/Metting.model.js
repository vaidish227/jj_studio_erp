const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true
    },

    date: {
      type: Date,
      required: true
    },

    type: {
      type: String,
      enum: ["call", "office", "site"],
      required: true
    },

    notes: String,

    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
    },

    durationMinutes: {
      type: Number,
      default: 60,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Meeting", meetingSchema);