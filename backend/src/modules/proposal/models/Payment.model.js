const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProposalV2",
      required: true,
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    type: { type: String, enum: ["advance"], default: "advance" },
    amount: { type: Number, required: true },
    method: { type: String, enum: ["cash", "bank", "upi"], default: "bank" },
    referenceNo: { type: String, default: "" },
    receivedAt: { type: Date, default: Date.now },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    note: { type: String, default: "" },
    status: { type: String, enum: ["pending", "received"], default: "received" },
  },
  { timestamps: true, collection: "payments" }
);

module.exports = mongoose.model("ProposalPayment", paymentSchema);
