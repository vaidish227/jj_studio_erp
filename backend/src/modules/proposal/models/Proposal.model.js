const mongoose = require("mongoose");

const proposalSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", default: null },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "QuotationTemplate", default: null },
    proposalNumber: { type: String, required: true, unique: true },
    version: { type: Number, default: 1 },
    subtotal: { type: Number, default: 0 },
    gstPercent: { type: Number, default: 18 },
    gstAmount: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    finalAmount: { type: Number, default: 0 },
    currentStatus: {
      type: String,
      enum: [
        "draft",
        "pending_approval",
        "approved",
        "rejected",
        "sent",
        "esign_received",
        "advance_received",
        "converted",
      ],
      default: "draft",
      index: true,
    },
    sentAt: Date,
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    remarks: { type: String, default: "" },
  },
  { timestamps: true, collection: "proposals" }
);

module.exports = mongoose.model("ProposalV2", proposalSchema);
