const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;
const {
  CHANNELS, CAMPAIGN_AUDIENCES, CAMPAIGN_STATUSES,
} = require("../constants/enums");

/**
 * KitCampaign (kit_campaigns) — a reusable, ordered communication journey.
 *
 * The campaign is the container; its ordered steps live in kit_campaign_steps.
 * A single campaign can be enrolled against many entities (leads/clients/…)
 * via kit_enrollments.
 */
const kitCampaignSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    description: { type: String },
    audience:    { type: String, enum: CAMPAIGN_AUDIENCES, default: "leads" },
    status:      { type: String, enum: CAMPAIGN_STATUSES, default: "draft" },
    defaultChannel: { type: String, enum: CHANNELS, default: "whatsapp" },
    isReusable:  { type: Boolean, default: true },
    createdBy:   { type: ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "kit_campaigns" }
);

kitCampaignSchema.index({ status: 1 });

module.exports = mongoose.model("KitCampaign", kitCampaignSchema);
