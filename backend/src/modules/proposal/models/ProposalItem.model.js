const mongoose = require("mongoose");

const proposalItemSchema = new mongoose.Schema(
  {
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProposalV2",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category: { type: String, default: "general" },
    unit: { type: String, default: "sqft" },
    qty: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "proposal_items" }
);

module.exports = mongoose.model("ProposalItem", proposalItemSchema);
