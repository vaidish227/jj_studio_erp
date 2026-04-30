const mongoose = require("mongoose");

const proposalStatusHistorySchema = new mongoose.Schema(
  {
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProposalV2",
      required: true,
      index: true,
    },
    fromStatus: { type: String, default: null },
    toStatus: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reason: { type: String, default: "" },
    metadata: { type: Object, default: {} },
    changedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: "proposal_status_history" }
);

module.exports = mongoose.model("ProposalStatusHistory", proposalStatusHistorySchema);
