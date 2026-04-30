const mongoose = require("mongoose");

const eSignSchema = new mongoose.Schema(
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
    status: { type: String, enum: ["pending", "received", "rejected"], default: "received" },
    signedByName: { type: String, default: "" },
    signedAt: { type: Date, default: Date.now },
    documentUrl: { type: String, default: "" },
    ipAddress: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { timestamps: true, collection: "esign" }
);

module.exports = mongoose.model("ProposalESign", eSignSchema);
