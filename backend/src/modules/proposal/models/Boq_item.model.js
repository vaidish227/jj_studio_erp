const mongoose = require("mongoose");

const boqItemSchema = new mongoose.Schema(
  {
    boqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BOQ",
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    description: String,

    category: {
      type: String,
      enum: [
        "carpentry",
        "electrical",
        "false_ceiling",
        "marble",
        "plumbing",
        "civil",
      ],
      required: true,
    },

    unit: {
      type: String,
      enum: ["sqft", "rft", "nos", "job", "lump_sum"],
      default: "nos",
    },

    qty: {
      type: Number,
      default: 1,
    },

    rate: {
      type: Number,
      required: true,
    },

    amount: {
      type: Number,
    },

    pricingType: {
      type: String,
      enum: ["unit_based", "lump_sum"],
      default: "unit_based",
    },
  },
  { timestamps: true }
);


//  AUTO AMOUNT CALCULATION
boqItemSchema.pre("save", function (next) {
  if (this.pricingType === "lump_sum") {
    this.amount = this.rate;
  } else {
    this.amount = this.qty * this.rate;
  }
  next();
});

module.exports = mongoose.model("BOQItem", boqItemSchema);