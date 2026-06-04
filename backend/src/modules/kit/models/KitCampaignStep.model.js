const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;
const { CHANNELS, DELAY_UNITS } = require("../constants/enums");

/**
 * KitCampaignStep (kit_campaign_steps) — one message in a campaign journey.
 *
 * `order` defines sequence (0-based). `delay` is relative to enrollment start
 * (e.g. {value: 2, unit: "days"} == the "Day 2" step). `condition` optionally
 * gates the step (evaluated by conditionEvaluator in Phase 4) — if it fails the
 * step is skipped, not retried.
 */
const conditionSchema = new mongoose.Schema(
  {
    field:    { type: String },
    operator: { type: String },
    value:    { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const kitCampaignStepSchema = new mongoose.Schema(
  {
    campaignId: { type: ObjectId, ref: "KitCampaign", required: true },
    order:      { type: Number, required: true, min: 0 },
    name:       { type: String },

    delay: {
      value: { type: Number, default: 0, min: 0 },
      unit:  { type: String, enum: DELAY_UNITS, default: "days" },
    },

    channel:    { type: String, enum: CHANNELS, required: true },
    templateId: { type: ObjectId, ref: "KitTemplate", required: true },

    condition:  { type: conditionSchema, default: undefined },
  },
  { timestamps: true, collection: "kit_campaign_steps" }
);

kitCampaignStepSchema.index({ campaignId: 1, order: 1 });

module.exports = mongoose.model("KitCampaignStep", kitCampaignStepSchema);
