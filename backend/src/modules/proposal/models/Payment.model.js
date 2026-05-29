const mongoose = require("mongoose");
const paymentSchema = new mongoose.Schema(
  {
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
    },

    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    // Kept in sync with ApprovalFormModal options. "bank" preserved for
    // backwards-compat with any rows already in the DB.
    method: {
      type: String,
      enum: ["cash", "upi", "bank", "bank_transfer", "cheque", "online"],
    },

    status: {
      type: String,
      enum: ["pending", "received"],
      default: "pending",
    },

    receivedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);