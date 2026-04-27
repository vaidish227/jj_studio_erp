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
    notes: String,

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    clientId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Client"
},
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lead", leadSchema);