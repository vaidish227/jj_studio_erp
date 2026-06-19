const mongoose = require("mongoose");

/**
 * WorkflowTemplate — DB-backed definition of a project workflow graph.
 * Drives workflowEngine.seedProject: which tasks to create at which day-offset,
 * which approval gates to open, and which dependencies to wire.
 *
 * Activated via Project.workflowTemplateId. Defaults to the "Residential Full"
 * template seeded by scripts/seedWorkflowTemplates.js.
 */

const taskDefSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },               // stable id within the template (e.g. "site_measurement_d0")
    title: { type: String, required: true },
    taskType: { type: String, required: true },           // must be a Task.taskType enum value
    // Stable slug from Responsibility master list (e.g. "lead_designer",
    // "furniture_measurements") — resolved at seed time via teamResolver.
    responsibilitySlug: { type: String },
    // @deprecated — old hardcoded field name. Migration script copies this
    // value into responsibilitySlug; kept readable so legacy seed data
    // continues to work until next reseed.
    teamSlot: { type: String },
    dayOffsetFromProjectStart: { type: Number, default: 0 },
    plannedDays:  { type: Number, default: 1, min: 0 },   // duration in days; drives plannedEndDate at seed time
    plannedHours: { type: Number, default: 0, min: 0 },   // estimated effort hours; copied to task.planning.plannedHours
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    dependsOnKeys: { type: [String], default: [] },       // refs other taskDef.key in this template
    requiresGateKeys: { type: [String], default: [] },    // gateDef.key entries this task is blocked by
    checklistTemplateName: { type: String },              // ChecklistTemplate.name to snapshot
    notes: { type: String, default: "" },
    // Subtask support: when set, this task seeds as a SUBTASK of the task whose
    // key === parentKey (one level deep — the parent should be a top-level task).
    // seedProject resolves it to Task.parentTaskId/isSubtask after creating tasks.
    parentKey: { type: String, default: null },
    subtaskOrder: { type: Number, default: 0 },           // order among siblings under the same parent
  },
  { _id: false }
);

const gateDefSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    gateType: { type: String, required: true },          // gate_furniture_layout, gate_ac_client, etc.
    approverType: {
      type: String,
      enum: ["client", "manager", "principal_designer", "principal_and_client"],
      required: true,
    },
    /**
     * Which Project.clientApprovals[].type this gate listens to (if approverType=client/principal_and_client).
     * Closing this approval transitions the gate.
     */
    listensTo: { type: String },                          // "furniture_layout", "ac", "automation", ...
    /**
     * Which downstream taskDef.key entries unlock when this gate closes.
     */
    unblocks: { type: [String], default: [] },
    /**
     * Which activity types are blocked while this gate is open.
     * Used by gateEnforcement.js to reject 409s.
     */
    blockedActivities: { type: [String], default: [] },  // "task.submit", "po.emit", "drawing.release", etc.
  },
  { _id: false }
);

const phaseDefSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },              // "Kickoff", "Layout", "Design", ...
    order: { type: Number, required: true },
    taskKeys: { type: [String], default: [] },           // which taskDef.key entries belong to this phase
    gateKeys: { type: [String], default: [] },
    // Phase day budget (milestone). startDayOffset = day the phase nominally
    // begins; dayBudget = nominal phase length in days. Seeded into
    // Project.planSnapshot.phases → drives the phase rollup + ProjectMilestone sync.
    startDayOffset: { type: Number, default: 0 },
    dayBudget:      { type: Number, default: null },
  },
  { _id: false }
);

const workflowTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true }, // "Residential Full"
    description: { type: String, default: "" },
    projectType: {
      type: String,
      enum: ["Residential", "Commercial", "Any"],
      default: "Any",
    },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    phases: { type: [phaseDefSchema], default: [] },
    tasks: { type: [taskDefSchema], default: [] },
    gates: { type: [gateDefSchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    collection: "pms_workflow_templates",
  }
);

workflowTemplateSchema.index({ isDefault: 1, isActive: 1 });
workflowTemplateSchema.index({ projectType: 1 });

module.exports = mongoose.model(
  "WorkflowTemplate",
  workflowTemplateSchema,
  "pms_workflow_templates"
);
