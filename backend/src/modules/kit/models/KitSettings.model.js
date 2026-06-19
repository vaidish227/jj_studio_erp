const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;
const { EMAIL_DESIGN_DEFAULTS } = require("../../mail/service/emailLayout");

/**
 * KitSettings (kit_settings) — singleton config doc for KIT-wide preferences.
 *
 * Currently holds the GLOBAL email design (the branded frame around every email:
 * header colour/text/logo, footer, body & accent colours). Individual templates
 * may override any of these fields; the effective design is resolved at send time
 * by emailDesignService (global default < per-template override).
 *
 * Exactly one document exists (key: "kit_global"). Read it via getOrCreateDefaults().
 */
const emailDesignSchema = new mongoose.Schema(
  {
    headerColor:     { type: String, default: EMAIL_DESIGN_DEFAULTS.headerColor },
    headerTextColor: { type: String, default: EMAIL_DESIGN_DEFAULTS.headerTextColor },
    brandText:       { type: String, default: EMAIL_DESIGN_DEFAULTS.brandText },
    logoUrl:         { type: String, default: "" },
    logoKey:         { type: String, default: "" },
    showHeader:      { type: Boolean, default: true },
    footerText:      { type: String, default: EMAIL_DESIGN_DEFAULTS.footerText },
    showFooter:      { type: Boolean, default: true },
    bodyTextColor:   { type: String, default: EMAIL_DESIGN_DEFAULTS.bodyTextColor },
    accentColor:     { type: String, default: EMAIL_DESIGN_DEFAULTS.accentColor },
    bgColor:         { type: String, default: EMAIL_DESIGN_DEFAULTS.bgColor },
  },
  { _id: false }
);

const kitSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "kit_global", unique: true },
    emailDesign: { type: emailDesignSchema, default: () => ({}) },
    updatedBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "kit_settings" }
);

/**
 * getOrCreateDefaults — always returns the singleton settings doc, creating it
 * (with brand defaults) the first time it's requested.
 */
kitSettingsSchema.statics.getOrCreateDefaults = async function () {
  let doc = await this.findOne({ key: "kit_global" });
  if (!doc) doc = await this.create({ key: "kit_global" });
  return doc;
};

module.exports = mongoose.model("KitSettings", kitSettingsSchema);
