/**
 * emailLayout — the single branded HTML email template that lives on the backend.
 *
 * Admins (and automations) write the message *body*; this wrapper turns it into a
 * consistent, branded HTML email — header, body, footer. The look of that frame
 * (colours, brand text/logo, footer) is configurable: a global default lives in
 * the KitSettings singleton and individual templates may override any field. The
 * effective design is resolved by emailDesignService and passed in here as `opts`.
 *
 * `white-space: pre-wrap` is applied only to legacy plain-text bodies so their
 * line breaks survive; rich HTML bodies (from the WYSIWYG editor) render as-is.
 *
 * Used by: KIT dispatchService (campaign/automation emails), thankYouService
 * (post-enquiry thank-yous), and the template editor's live preview — so what
 * the admin previews is exactly what gets sent.
 */
const COMPANY_NAME = process.env.COMPANY_NAME || "JJ Studio";
const BRAND_COLOR  = process.env.EMAIL_BRAND_COLOR || "#1f2937";

// The full design shape with sensible defaults. Every email send merges this with
// the global KitSettings design and any per-template override (empty = inherit).
const EMAIL_DESIGN_DEFAULTS = {
  headerColor:     BRAND_COLOR,   // header bar background
  headerTextColor: "#ffffff",     // brand text colour in the header
  brandText:       COMPANY_NAME,  // company name shown in header (ignored when a logo is set)
  logoUrl:         "",            // optional header logo image (re-signed at send time)
  logoKey:         "",            // S3 object key behind the logo
  showHeader:      true,
  footerText:      `© {{year}} ${COMPANY_NAME}. All rights reserved.`,
  showFooter:      true,
  bodyTextColor:   "#333333",     // default body text colour
  accentColor:     BRAND_COLOR,   // link / accent colour inside the body
  bgColor:         "#ffffff",     // card background
};

// TipTap always outputs block-level HTML tags; legacy plain-text bodies never start with one.
const isRichHtml = (content) =>
  /^\s*<(p|h[1-6]|ul|ol|li|blockquote|div|table|br)[\s>]/i.test(String(content || ''));

const escapeHtml = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * mergeDesign — layer partial designs over the defaults. Later layers win, but an
 * empty string means "inherit" (so a template leaves a field blank to fall back to
 * the global setting). Booleans pass through, including an explicit `false`.
 */
const mergeDesign = (...layers) => {
  const out = { ...EMAIL_DESIGN_DEFAULTS };
  for (const layer of layers) {
    if (!layer || typeof layer !== "object") continue;
    const src = typeof layer.toObject === "function" ? layer.toObject() : layer;
    // companyName is a back-compat alias for brandText.
    if (src.companyName && !src.brandText) out.brandText = src.companyName;
    for (const [k, v] of Object.entries(src)) {
      if (!(k in EMAIL_DESIGN_DEFAULTS)) continue;
      if (v === undefined || v === null) continue;
      if (typeof v === "string" && v.trim() === "") continue; // empty = inherit
      out[k] = v;
    }
  }
  return out;
};

/**
 * wrapEmailHtml — wrap a rendered message in the branded email shell.
 * @param {string} content  the message (plain text or rich HTML), variables already resolved
 * @param {Object} [opts]   a (partial) email design object, or legacy { companyName }
 * @returns {string} self-contained HTML (a card div) — valid both as an email
 *                   body and when injected into the editor preview.
 */
const wrapEmailHtml = (content = "", opts = {}) => {
  const d = mergeDesign(opts);
  const year = new Date().getFullYear();
  const body = String(content == null ? "" : content);
  const footer = String(d.footerText || "").replace(/\{\{\s*year\s*\}\}/gi, year);

  // Apply the accent colour to any anchor that doesn't already carry an inline style.
  const styledBody = body.replace(/<a\b(?![^>]*\bstyle=)/gi,
    `<a style="color:${d.accentColor};text-decoration:underline;"`);

  const bodyStyle = isRichHtml(body)
    ? `padding:28px;color:${d.bodyTextColor};font-size:14px;line-height:1.7;`
    : `padding:28px;color:${d.bodyTextColor};font-size:14px;line-height:1.7;white-space:pre-wrap;`;

  const header = d.showHeader
    ? `\n  <div style="background:${d.headerColor};padding:20px 28px;">
    ${d.logoUrl
        ? `<img src="${escapeHtml(d.logoUrl)}" alt="${escapeHtml(d.brandText)}" style="max-height:42px;max-width:220px;display:block;" />`
        : `<span style="color:${d.headerTextColor};font-size:18px;font-weight:bold;letter-spacing:.3px;">${escapeHtml(d.brandText)}</span>`}
  </div>`
    : "";

  const footerHtml = d.showFooter
    ? `\n  <div style="padding:16px 28px;border-top:1px solid #eeeeee;color:#9ca3af;font-size:12px;">${escapeHtml(footer)}</div>`
    : "";

  return `<div style="max-width:600px;margin:0 auto;background:${d.bgColor};border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;">${header}
  <div style="${bodyStyle}">${styledBody}</div>${footerHtml}
</div>`;
};

module.exports = { wrapEmailHtml, mergeDesign, EMAIL_DESIGN_DEFAULTS };
