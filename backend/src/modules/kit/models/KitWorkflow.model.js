const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;
const {
  SOURCE_MODULES, CONDITION_OPERATORS, ACTION_TYPES, CHANNELS, DELAY_UNITS,
} = require("../constants/enums");

/**
 * KitWorkflow (kit_workflows) — a WHEN → IF → THEN automation rule.
 *
 *   WHEN  trigger.event fires from trigger.sourceModule   (e.g. "lead.created")
 *   IF    all `conditions` evaluate true                  (AND semantics)
 *   THEN  run each of `actions` in order
 *
 * Conditions/actions are embedded (no separate kit_workflow_rules collection)
 * because they are owned by exactly one workflow. Evaluated/executed by
 * conditionEvaluator + triggerService in Phase 4.
 */
const conditionSchema = new mongoose.Schema(
  {
    field:    { type: String, required: true },
    operator: { type: String, enum: CONDITION_OPERATORS, required: true },
    value:    { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const actionSchema = new mongoose.Schema(
  {
    type:       { type: String, enum: ACTION_TYPES, required: true },
    // start_campaign / stop_campaign
    campaignId: { type: ObjectId, ref: "KitCampaign" },
    // send_template / notify
    templateId: { type: ObjectId, ref: "KitTemplate" },
    channel:    { type: String, enum: CHANNELS },
    // optional defer before the action runs
    delay: {
      value: { type: Number, default: 0, min: 0 },
      unit:  { type: String, enum: DELAY_UNITS, default: "days" },
    },
    params: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const kitWorkflowSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    description: { type: String },
    isActive:    { type: Boolean, default: false },

    trigger: {
      event:        { type: String, required: true }, // e.g. "proposal.sent"
      sourceModule: { type: String, enum: SOURCE_MODULES, required: true },
    },

    conditions: { type: [conditionSchema], default: [] },
    actions:    { type: [actionSchema], default: [] },

    createdBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "kit_workflows" }
);

// Matching hot path: active workflows for a given event.
kitWorkflowSchema.index({ isActive: 1, "trigger.event": 1 });

module.exports = mongoose.model("KitWorkflow", kitWorkflowSchema);
