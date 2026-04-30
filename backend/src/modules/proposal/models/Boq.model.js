const mongoose = require("mongoose");

const boqSchema = new mongoose.Schema(
  {
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
    },

    title: {
      type: String,
      default: "BOQ",
    },

    totalAmount: {
      type: Number,
      default: 0,
    },

    gst: {
      type: Number,
      default: 0,
    },

    finalAmount: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["draft", "finalized"],
      default: "draft",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BOQ", boqSchema);