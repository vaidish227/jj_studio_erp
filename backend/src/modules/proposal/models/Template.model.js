const mongoose = require("mongoose");

const templateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["residential", "commercial"],
      default: "residential",
    },
    description: String,
    structure: {
      columns: [
        {
          id: String,
          label: String,
          type: {
            type: String,
            enum: ["text", "number", "label"],
            default: "text",
          },
          width: String,
        },
      ],
      rows: [
        {
          id: String,
          isGroupHeader: {
            type: Boolean,
            default: false,
          },
          cells: mongoose.Schema.Types.Mixed, // Dynamic key-value pairs mapping colId -> value
        },
      ],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Template", templateSchema);