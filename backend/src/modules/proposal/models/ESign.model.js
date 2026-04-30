const mongoose = require("mongoose");


const eSignSchema = new mongoose.Schema(
  {
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
    },

    signedBy: {
      type: String, // client name
      required: true,
    },

    signatureUrl: {
      type: String, // image or file URL
    },

    status: {
      type: String,
      enum: ["pending", "signed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ESign", eSignSchema);