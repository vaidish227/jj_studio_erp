const mongoose = require("mongoose");

const proposalSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
    },

    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
    },

    items: [
      {
        name: String,
        qty: Number,
        rate: Number,
        amount: Number,
      },
    ],

    totalAmount: Number,
    gst: Number,
    finalAmount: Number,

    status: {
      type: String,
      enum: ["draft", "sent", "approved", "rejected"],
      default: "draft",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Proposal", proposalSchema);