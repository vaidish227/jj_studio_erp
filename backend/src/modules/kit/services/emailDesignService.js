/**
 * emailDesignService — resolves the EFFECTIVE email frame for a send.
 *
 * A send picks a NAMED EmailDesign (by `designId`, e.g. the one a Mail Template
 * chose) or falls back to the default design (used by automations). The design's
 * theme is layered over EMAIL_DESIGN_DEFAULTS, and its layout (block stack) is
 * attached as `design.layout` for wrapEmailHtml. Optional `themeOverride` /
 * `layoutOverride` let the live builder preview an unsaved draft.
 *
 * S3-backed images (header logo, `image` blocks, `social` icons) are stored as
 * keys and re-signed fresh here (7-day URL — the SigV4 maximum) so they stay
 * loadable when the recipient opens the mail later.
 */
const EmailDesign = require("../models/EmailDesign.model");
const { mergeDesign } = require("../../mail/service/emailLayout");
const s3 = require("../../pms/services/s3Storage");

const LOGO_URL_TTL = 7 * 24 * 3600; // seconds (SigV4 max)

const signKey = async (key) => {
  if (!key || !s3.isConfigured()) return null;
  try { return await s3.getSignedDownloadUrl({ key, expiresIn: LOGO_URL_TTL, disposition: "inline" }); }
  catch (err) { console.error("[emailDesign] sign failed:", err?.message); return null; }
};

// Re-sign image blocks + social icons in the layout (never mutates the stored doc).
const resignLayoutImages = async (sections) => {
  if (!Array.isArray(sections)) return sections;
  return Promise.all(sections.map(async (s) => {
    if (s && s.key === "image" && s.props && s.props.key) {
      const url = await signKey(s.props.key);
      if (url) return { ...s, props: { ...s.props, url } };
    }
    if (s && s.key === "social" && s.props && Array.isArray(s.props.links)) {
      const links = await Promise.all(s.props.links.map(async (l) => {
        if (l && l.iconKey) { const u = await signKey(l.iconKey); if (u) return { ...l, iconUrl: u }; }
        return l;
      }));
      return { ...s, props: { ...s.props, links } };
    }
    return s;
  }));
};

/**
 * resolveEmailDesign — the full, ready-to-render design for a send.
 * @param {Object} [opts]
 * @param {String|ObjectId} [opts.designId]      which named design to use (else default)
 * @param {Object} [opts.themeOverride]          draft theme tokens (builder preview)
 * @param {Array}  [opts.layoutOverride]         draft layout sections (builder preview)
 * @returns {Promise<Object>}  theme tokens + `.layout` (sections | null), ready for wrapEmailHtml
 */
const resolveEmailDesign = async (opts = {}) => {
  const { designId, themeOverride, layoutOverride } = opts || {};

  let base = null;
  try {
    if (designId) base = await EmailDesign.findById(designId).lean();
    if (!base) {
      const def = await EmailDesign.getOrSeedDefault();
      base = typeof def.toObject === "function" ? def.toObject() : def;
    }
  } catch (err) {
    console.error("[emailDesign] could not load design:", err?.message);
  }

  const theme = (base && base.theme) || {};
  const design = mergeDesign(theme, themeOverride);

  // Re-sign the effective logo (override's key wins, else the design's).
  const logoKey = (themeOverride && themeOverride.logoKey && themeOverride.logoKey.trim())
    || (theme.logoKey && theme.logoKey.trim()) || "";
  const signedLogo = await signKey(logoKey);
  if (signedLogo) design.logoUrl = signedLogo;

  // Layout: an explicit draft override wins; otherwise the design's saved sections.
  const sections = layoutOverride !== undefined
    ? layoutOverride
    : (base && base.layout && Array.isArray(base.layout.sections) && base.layout.sections.length ? base.layout.sections : null);
  design.layout = sections ? await resignLayoutImages(sections) : null;

  return design;
};

module.exports = { resolveEmailDesign };
