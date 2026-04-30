const mongoose = require("mongoose");

const approvalSchema = new mongoose.Schema(
  {
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProposalV2",
      required: true,
      index: true,
    },
    level: { type: String, enum: ["manager"], default: "manager" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    actedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actedAt: { type: Date, default: null },
    note: { type: String, default: "" },
  },
  { timestamps: true, collection: "approvals" }
);

module.exports = mongoose.model("ProposalApproval", approvalSchema);
