
const mongoose = require("mongoose");
const boqSchema = new mongoose.Schema(
  {
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
    },

    title: String,

    totalAmount: Number,
    gst: Number,
    finalAmount: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("BOQ", boqSchema);