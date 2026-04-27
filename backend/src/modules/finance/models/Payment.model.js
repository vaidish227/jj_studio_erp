const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
    },

    amount: Number,

    type: {
      type: String,
      enum: ["advance", "partial", "final"],
    },

    status: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },

    date: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);