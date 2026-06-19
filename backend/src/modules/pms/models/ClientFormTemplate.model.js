const mongoose = require("mongoose");

// One field in a client form template
const fieldSchema = new mongoose.Schema(
  {
    id:          { type: String, required: true },   // client-side UUID (stable across edits)
    type:        {
      type: String, required: true,
      enum: ["text", "textarea", "email", "phone", "number", "date",
             "dropdown", "checkbox", "section"],
    },
    label:       { type: String, required: true },
    placeholder: String,
    description: String,          // hint shown below the input
    required:    { type: Boolean, default: false },
    options:     [String],        // for dropdown / checkbox types
  },
  { _id: false }
);

const clientFormTemplateSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    fields:      [fieldSchema],
    isActive:    { type: Boolean, default: true },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ClientFormTemplate", clientFormTemplateSchema);
