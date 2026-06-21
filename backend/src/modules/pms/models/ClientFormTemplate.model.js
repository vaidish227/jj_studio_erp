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

    // Scope:
    //   projectId = null  → shared/global library template (managed on the
    //                       global Form Templates page; visible to all projects).
    //   projectId = <id>  → project-specific copy. Created via copy-on-write when
    //                       a user edits a shared template from inside a project,
    //                       so the shared master is never mutated. Only this
    //                       project sees and uses it.
    projectId:       { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    // The shared template this project copy was forked from (audit / "reset to
    // shared" affordance). Null for original shared templates.
    sourceTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: "ClientFormTemplate", default: null },
  },
  { timestamps: true }
);

clientFormTemplateSchema.index({ projectId: 1, isActive: 1 });

module.exports = mongoose.model("ClientFormTemplate", clientFormTemplateSchema);
