const KitSettings = require("../models/KitSettings.model");
const { KNOWN_BLOCK_KEYS } = require("../../mail/service/emailLayout");
const s3 = require("../../pms/services/s3Storage");

const SIGN_TTL = 7 * 24 * 3600; // SigV4 max

// Editable global email-design fields (colours/text are strings; show* are booleans).
const STRING_FIELDS = ["headerColor", "headerTextColor", "brandText", "logoUrl", "logoKey", "footerText", "bodyTextColor", "accentColor", "bgColor"];
const BOOL_FIELDS   = ["showHeader", "showFooter"];

// Re-sign the stored logo key so the editor/preview renders a live URL (7-day max).
const refreshLogo = async (design) => {
  if (design && design.logoKey && s3.isConfigured()) {
    try {
      design.logoUrl = await s3.getSignedDownloadUrl({ key: design.logoKey, expiresIn: SIGN_TTL, disposition: "inline" });
    } catch { /* keep stored url */ }
  }
  return design;
};

// Re-sign any S3-backed image blocks so the builder preview shows live URLs.
const refreshLayoutImages = async (layout) => {
  if (!layout || !Array.isArray(layout.sections) || !s3.isConfigured()) return layout;
  for (const s of layout.sections) {
    if (s && s.key === "image" && s.props && s.props.key) {
      try { s.props.url = await s3.getSignedDownloadUrl({ key: s.props.key, expiresIn: SIGN_TTL, disposition: "inline" }); }
      catch { /* keep stored url */ }
    }
  }
  return layout;
};

// Sanitize an incoming layout into the stored shape: known block keys only, a
// boolean `enabled`, and a plain `props` object. Returns null to mean "no custom
// layout" (so the renderer falls back to its default frame).
const sanitizeLayout = (layout) => {
  if (!layout || !Array.isArray(layout.sections)) return undefined;
  const sections = layout.sections
    .filter((s) => s && KNOWN_BLOCK_KEYS.has(s.key))
    .map((s) => ({
      key: s.key,
      enabled: s.enabled !== false,
      props: (s.props && typeof s.props === "object") ? s.props : {},
    }));
  return { sections };
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
    if (out.emailLayout) await refreshLayoutImages(out.emailLayout);
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
    const { emailDesign, emailLayout } = req.body;
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

    if (emailLayout !== undefined) {
      const clean = sanitizeLayout(emailLayout);
      // `null`/empty resets to the built-in default frame; otherwise store sections.
      settings.emailLayout = clean && clean.sections.length ? clean : { sections: undefined };
      settings.markModified("emailLayout");
    }

    settings.updatedBy = req.user?._id || req.user?.id || settings.updatedBy;
    await settings.save();

    const out = settings.toObject();
    if (out.emailDesign) await refreshLogo(out.emailDesign);
    if (out.emailLayout) await refreshLayoutImages(out.emailLayout);
    return res.status(200).json({ success: true, message: "Email branding saved", settings: out });
  } catch (err) {
    console.error("[kit.updateSettings]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getSettings, updateSettings };
