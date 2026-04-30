const mongoose = require("mongoose");

const templateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: ["residential", "commercial"],
      required: true,
    },

    description: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Template", templateSchema);