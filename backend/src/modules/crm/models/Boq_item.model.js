const mongoose = require("mongoose");

const boqItemSchema = new mongoose.Schema(
  {
    boqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BOQ",
    },

    name: String,
    description: String,

    qty: Number,
    unit: String, // sqft, rft, job

    rate: Number,
    amount: Number,

    category: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("BOQItem", boqItemSchema);