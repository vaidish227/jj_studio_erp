/**
 * emailDesignService — resolves the EFFECTIVE email design for a send.
 *
 * Layers, in increasing precedence:
 *   1. EMAIL_DESIGN_DEFAULTS (in emailLayout)
 *   2. the global KitSettings.emailDesign
 *   3. an optional per-template override (empty fields inherit from above)
 *
 * The header logo is stored as an S3 key and re-signed fresh here (7-day URL —
 * the SigV4 maximum) so it stays loadable when the recipient opens the mail
 * later, mirroring how dispatchService re-signs WhatsApp attachments.
 */
const KitSettings = require("../models/KitSettings.model");
const { mergeDesign } = require("../../mail/service/emailLayout");
const s3 = require("../../pms/services/s3Storage");

const LOGO_URL_TTL = 7 * 24 * 3600; // seconds (SigV4 max)

/**
 * resolveEmailDesign — global design merged with an optional per-template override,
 * with the effective logo re-signed for delivery/preview.
 * @param {Object} [override]  a KitTemplate.emailDesign sub-doc (or plain object)
 * @returns {Promise<Object>}  a full design object ready for wrapEmailHtml
 */
const resolveEmailDesign = async (override = {}) => {
  let global = {};
  try {
    const doc = await KitSettings.getOrCreateDefaults();
    global = doc.emailDesign
      ? (typeof doc.emailDesign.toObject === "function" ? doc.emailDesign.toObject() : doc.emailDesign)
      : {};
  } catch (err) {
    console.error("[emailDesign] could not load global settings:", err?.message);
  }

  const ov = override && typeof override.toObject === "function" ? override.toObject() : (override || {});
  const design = mergeDesign(global, ov);
  // design.logoUrl is now the effective stored URL (override's, else global's). If a
  // key is available we re-sign it fresh for delivery; otherwise we keep whatever
  // URL the merge produced (never blank a logo the caller explicitly supplied).

  const logoKey = (ov.logoKey && ov.logoKey.trim()) || (global.logoKey && global.logoKey.trim()) || "";
  if (logoKey && s3.isConfigured()) {
    try {
      design.logoUrl = await s3.getSignedDownloadUrl({ key: logoKey, expiresIn: LOGO_URL_TTL, disposition: "inline" });
    } catch (err) {
      console.error("[emailDesign] logo sign failed:", err?.message);
      // keep the merged logoUrl as a fallback rather than dropping the logo
    }
  }

  return design;
};

module.exports = { resolveEmailDesign };
