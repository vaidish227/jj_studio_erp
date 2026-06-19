const KitSettings = require("../models/KitSettings.model");
const s3 = require("../../pms/services/s3Storage");

// Editable global email-design fields (colours/text are strings; show* are booleans).
const STRING_FIELDS = ["headerColor", "headerTextColor", "brandText", "logoUrl", "logoKey", "footerText", "bodyTextColor", "accentColor", "bgColor"];
const BOOL_FIELDS   = ["showHeader", "showFooter"];

// Re-sign the stored logo key so the editor/preview renders a live URL (7-day max).
const refreshLogo = async (design) => {
  if (design && design.logoKey && s3.isConfigured()) {
    try {
      design.logoUrl = await s3.getSignedDownloadUrl({ key: design.logoKey, expiresIn: 7 * 24 * 3600, disposition: "inline" });
    } catch { /* keep stored url */ }
  }
  return design;
};

/**
 * GET /api/kit/settings — return the singleton KIT settings (global email design),
 * creating defaults on first access.
 */
const getSettings = async (req, res) => {
  try {
    const settings = await KitSettings.getOrCreateDefaults();
    const out = settings.toObject();
    if (out.emailDesign) await refreshLogo(out.emailDesign);
    return res.status(200).json({ success: true, settings: out });
  } catch (err) {
    console.error("[kit.getSettings]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/kit/settings — partial update of the global email design.
 */
const updateSettings = async (req, res) => {
  try {
    const { emailDesign } = req.body;
    const settings = await KitSettings.getOrCreateDefaults();

    if (emailDesign && typeof emailDesign === "object") {
      for (const f of STRING_FIELDS) {
        if (emailDesign[f] !== undefined) settings.emailDesign[f] = String(emailDesign[f] ?? "");
      }
      for (const f of BOOL_FIELDS) {
        if (emailDesign[f] !== undefined) settings.emailDesign[f] = !!emailDesign[f];
      }
      settings.markModified("emailDesign");
    }

    settings.updatedBy = req.user?._id || req.user?.id || settings.updatedBy;
    await settings.save();

    const out = settings.toObject();
    if (out.emailDesign) await refreshLogo(out.emailDesign);
    return res.status(200).json({ success: true, message: "Email branding saved", settings: out });
  } catch (err) {
    console.error("[kit.updateSettings]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getSettings, updateSettings };
