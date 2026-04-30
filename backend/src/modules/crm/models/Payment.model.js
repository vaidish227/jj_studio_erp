const paymentSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
    },

    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
    },

    amount: Number,

    method: {
      type: String,
      enum: ["cash", "bank", "upi"],
    },

    status: {
      type: String,
      enum: ["pending", "received"],
      default: "received",
    },

    receivedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);