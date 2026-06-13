const mongoose = require("mongoose");

/**
 * ChecklistTemplate — DB-backed default checklist for a task type.
 * Replaces the hard-coded DEFAULT_CHECKLISTS constant in Task.controller.js.
 *
 * On task creation, workflowEngine (and Task.controller.createTask later)
 * looks up the active default template for the taskType and snapshots
 * items[] into the new task.
 *
 * Snapshot pattern: changes to the template do not retroactively affect
 * existing tasks. Same convention as Drawing.checklistSnapshot.
 */

const itemSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    // Phase 2: requiredDrawingType, requiredSignoffRole — left out of v1 schema
    // to keep migration simple. Add when gate-on-checklist-completion lands.
  },
  { _id: false }
);

const checklistTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },     // "kitchen_drawing_v1"
    taskType: { type: String, required: true, trim: true },   // must match Task.taskType enum
    description: { type: String, default: "" },
    items: { type: [itemSchema], default: [] },
    isDefault: { type: Boolean, default: false },             // only one isDefault=true per taskType
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    collection: "pms_checklist_templates",
  }
);

checklistTemplateSchema.index({ taskType: 1, isDefault: 1, isActive: 1 });

/**
 * Convenience: return the snapshot-ready item list (label only, with order applied).
 * Use this in workflowEngine / Task.controller to inject into Task.checklist[].
 */
checklistTemplateSchema.statics.snapshotForTaskType = async function (taskType) {
  const tpl = await this.findOne({
    taskType,
    isDefault: true,
    isActive: true,
  }).lean();
  if (!tpl || !tpl.items?.length) return [];
  return tpl.items
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((i) => ({ item: i.label, isCompleted: false }));
};

module.exports = mongoose.model(
  "ChecklistTemplate",
  checklistTemplateSchema,
  "pms_checklist_templates"
);
