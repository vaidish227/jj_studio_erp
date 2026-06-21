const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;
const { EMAIL_DESIGN_DEFAULTS } = require("../../mail/service/emailLayout");

/**
 * EmailDesign (kit_email_designs) — a NAMED, reusable email frame.
 *
 * Replaces the old single global frame: studios can now keep a LIBRARY of designs
 * (e.g. "Default", "Festive Campaign", "Minimal") and each Mail Template picks the
 * one it wears via `KitTemplate.designId`. Exactly one design is `isDefault` — used
 * by automations (thank-you / kickoff) and as the fallback when a template hasn't
 * chosen one.
 *
 *   • theme  — the palette/brand tokens (colours, logo, brand & footer text).
 *   • layout — the ordered, toggleable block stack (header/body/footer/button/
 *              divider/spacer/signature/social/image). Empty => default frame.
 *
 * The effective design is resolved at send time by emailDesignService and rendered
 * by mail/service/emailLayout.wrapEmailHtml.
 */
const themeSchema = new mongoose.Schema(
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

const layoutSectionSchema = new mongoose.Schema(
  {
    key:     { type: String, required: true },
    enabled: { type: Boolean, default: true },
    props:   { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  { _id: false }
);

const emailDesignSchema = new mongoose.Schema(
  {
    name:      { type: String, required: true, unique: true, trim: true },
    isDefault: { type: Boolean, default: false },
    theme:     { type: themeSchema, default: () => ({}) },
    layout:    { sections: { type: [layoutSectionSchema], default: undefined } },
    createdBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "kit_email_designs" }
);

emailDesignSchema.index({ isDefault: 1 });

/** getDefault — the default design, or the oldest one as a fallback (null if none). */
emailDesignSchema.statics.getDefault = async function () {
  return (await this.findOne({ isDefault: true })) || (await this.findOne().sort({ createdAt: 1 }));
};

/**
 * getOrSeedDefault — always returns a usable default design, creating one named
 * "Default" the first time. It seeds from the legacy KitSettings singleton so any
 * branding/layout configured before this feature carries over seamlessly.
 */
emailDesignSchema.statics.getOrSeedDefault = async function () {
  const existing = await this.getDefault();
  if (existing) return existing;

  let theme = {};
  let sections;
  try {
    const KitSettings = require("./KitSettings.model");
    const s = await KitSettings.getOrCreateDefaults();
    const o = s.toObject();
    theme = o.emailDesign || {};
    if (o.emailLayout && Array.isArray(o.emailLayout.sections) && o.emailLayout.sections.length) {
      sections = o.emailLayout.sections;
    }
  } catch {
    /* fall back to schema defaults */
  }
  return this.create({ name: "Default", isDefault: true, theme, layout: { sections } });
};

module.exports = mongoose.model("EmailDesign", emailDesignSchema);
