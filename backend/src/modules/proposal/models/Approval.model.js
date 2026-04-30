const mongoose = require("mongoose");
const approvalSchema = new mongoose.Schema(
  {
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
    },

    type: {
      type: String,
      enum: ["internal", "manager"],
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
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