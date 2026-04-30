const approvalSchema = new mongoose.Schema(
  {
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
    },

    type: {
      type: String,
      enum: ["internal", "manager"],
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    note: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Approval", approvalSchema);