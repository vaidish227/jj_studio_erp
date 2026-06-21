/**
 * emailLayout — the branded HTML email shell, now driven by an EDITABLE layout.
 *
 * Admins (and automations) write the message *body*; this wrapper turns it into a
 * consistent, branded HTML email. Two layers make the frame data-driven (nothing
 * about the look is hardcoded except the last-resort fallback):
 *
 *   • THEME  (colours, brand text/logo, footer text) — resolved by
 *     emailDesignService: EMAIL_DESIGN_DEFAULTS < global KitSettings.emailDesign
 *     < per-template override. Passed in here as the design `opts`.
 *   • LAYOUT (which blocks appear, in what order) — the global
 *     KitSettings.emailLayout.sections, resolved by emailDesignService and handed
 *     to wrapEmailHtml as `opts.layout`. When absent, DEFAULT_LAYOUT reproduces
 *     the classic header → body → footer frame exactly, so existing sends are
 *     visually unchanged.
 *
 * The layout is a brand FRAME, so its block text (button label, signature, social
 * links) is treated as brand-static — only the body carries per-recipient
 * `{{variables}}`. `{{year}}` in the footer is the one token resolved here.
 *
 * `white-space: pre-wrap` is applied only to legacy plain-text bodies so their
 * line breaks survive; rich HTML bodies (from the WYSIWYG editor) render as-is.
 *
 * Used by: KIT dispatchService (campaign/automation emails), thankYouService
 * (post-enquiry thank-yous), kickoffService, and the template editor's live
 * preview — so what the admin previews is exactly what gets sent.
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

/**
 * BLOCK_CATALOG — the blocks the layout builder can place, in a canonical order.
 * `removable: false` blocks can be toggled off but never deleted; `body` is also
 * required (it is where the message renders). `props` documents the per-block
 * settings the renderer understands. The frontend builder keeps its own richer
 * catalog (labels/icons/editors); the backend only needs to render known keys
 * and silently ignores unknown ones.
 */
const BLOCK_CATALOG = [
  { key: "header",    label: "Header / Logo", removable: false, props: { align: "left" } },
  { key: "image",     label: "Image / Banner", props: { url: "", key: "", align: "center", width: "" } },
  { key: "body",      label: "Message Body", required: true, removable: false, props: {} },
  { key: "button",    label: "Button (CTA)", props: { text: "View details", url: "", bgColor: "", textColor: "#ffffff", align: "left" } },
  { key: "divider",   label: "Divider", props: { color: "#eeeeee" } },
  { key: "spacer",    label: "Spacer", props: { height: 16 } },
  { key: "signature", label: "Signature", props: { text: "Warm regards,\nThe Team", color: "" } },
  { key: "social",    label: "Social Links", props: { links: [], align: "left" } },
  { key: "footer",    label: "Footer", removable: false, props: {} },
];
const KNOWN_BLOCK_KEYS = new Set(BLOCK_CATALOG.map((b) => b.key));

// TipTap always outputs block-level HTML tags; legacy plain-text bodies never start with one.
const isRichHtml = (content) =>
  /^\s*<(p|h[1-6]|ul|ol|li|blockquote|div|table|br)[\s>]/i.test(String(content || ''));

const escapeHtml = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const safeAlign = (a) => (a === "center" || a === "right" ? a : "left");

// Social platforms for the `social` block. Email clients block SVG/icon-fonts, so
// each link renders as a brand-coloured circular badge with a short label (always
// renders), or the user's uploaded icon image when one is provided.
const SOCIAL_PLATFORMS = {
  instagram: { label: "Instagram", color: "#E4405F", initial: "Ig" },
  facebook:  { label: "Facebook",  color: "#1877F2", initial: "f" },
  linkedin:  { label: "LinkedIn",  color: "#0A66C2", initial: "in" },
  x:         { label: "X",         color: "#000000", initial: "X" },
  youtube:   { label: "YouTube",   color: "#FF0000", initial: "Yt" },
  whatsapp:  { label: "WhatsApp",  color: "#25D366", initial: "Wa" },
  website:   { label: "Website",   color: "#6B7280", initial: "W" },
};

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
 * resolveSections — the ordered block list to render. A saved, non-empty layout
 * wins; otherwise the classic header → body → footer frame, honouring the
 * design's showHeader / showFooter toggles for backward compatibility.
 */
const resolveSections = (d, layout) => {
  const sections = Array.isArray(layout) ? layout : (layout && Array.isArray(layout.sections) ? layout.sections : null);
  if (sections && sections.length) {
    return sections.filter((s) => s && KNOWN_BLOCK_KEYS.has(s.key));
  }
  return [
    { key: "header", enabled: d.showHeader !== false, props: {} },
    { key: "body",   enabled: true, props: {} },
    { key: "footer", enabled: d.showFooter !== false, props: {} },
  ];
};

// ─── Per-block renderers (div-based, inline-styled to match the existing card) ──
const renderHeader = (d, props = {}) => {
  const align = safeAlign(props.align);
  const inner = d.logoUrl
    ? `<img src="${escapeHtml(d.logoUrl)}" alt="${escapeHtml(d.brandText)}" style="max-height:42px;max-width:220px;display:inline-block;border:0;" />`
    : `<span style="color:${d.headerTextColor};font-size:18px;font-weight:bold;letter-spacing:.3px;">${escapeHtml(d.brandText)}</span>`;
  return `\n  <div style="background:${d.headerColor};padding:20px 28px;text-align:${align};">
    ${inner}
  </div>`;
};

const renderBody = (d, _props, bodyHtml) => {
  const body = String(bodyHtml == null ? "" : bodyHtml);
  // Apply the accent colour to any anchor that doesn't already carry an inline style.
  const styledBody = body.replace(/<a\b(?![^>]*\bstyle=)/gi,
    `<a style="color:${d.accentColor};text-decoration:underline;"`);
  const bodyStyle = isRichHtml(body)
    ? `padding:28px;color:${d.bodyTextColor};font-size:14px;line-height:1.7;`
    : `padding:28px;color:${d.bodyTextColor};font-size:14px;line-height:1.7;white-space:pre-wrap;`;
  return `\n  <div style="${bodyStyle}">${styledBody}</div>`;
};

const renderFooter = (d, _props, _body, year) => {
  const footer = String(d.footerText || "").replace(/\{\{\s*year\s*\}\}/gi, year);
  return `\n  <div style="padding:16px 28px;border-top:1px solid #eeeeee;color:#9ca3af;font-size:12px;">${escapeHtml(footer)}</div>`;
};

const renderButton = (d, props = {}) => {
  const text = (props.text || "").trim();
  if (!text) return "";
  const href = props.url ? escapeHtml(props.url) : "#";
  const bg = props.bgColor || d.accentColor;
  const color = props.textColor || "#ffffff";
  return `\n  <div style="padding:4px 28px 20px;text-align:${safeAlign(props.align)};">
    <a href="${href}" style="display:inline-block;background:${bg};color:${color};text-decoration:none;padding:12px 26px;border-radius:8px;font-size:14px;font-weight:bold;">${escapeHtml(text)}</a>
  </div>`;
};

const renderDivider = (_d, props = {}) =>
  `\n  <div style="padding:0 28px;"><div style="border-top:1px solid ${props.color || "#eeeeee"};font-size:0;line-height:0;">&nbsp;</div></div>`;

const renderSpacer = (_d, props = {}) => {
  const h = Math.max(0, Math.min(120, Number(props.height) || 16));
  return `\n  <div style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</div>`;
};

const renderSignature = (d, props = {}) => {
  const text = (props.text || "").trim();
  if (!text) return "";
  const html = escapeHtml(text).replace(/\n/g, "<br>");
  return `\n  <div style="padding:4px 28px 20px;color:${props.color || d.bodyTextColor};font-size:14px;line-height:1.6;">${html}</div>`;
};

const renderSocial = (d, props = {}) => {
  const links = Array.isArray(props.links) ? props.links.filter((l) => l && l.url) : [];
  if (!links.length) return "";
  const size = 34;
  const items = links.map((l) => {
    const plat = SOCIAL_PLATFORMS[l.platform] || { label: l.platform || "Link", color: d.accentColor, initial: "•" };
    const inner = l.iconUrl
      ? `<img src="${escapeHtml(l.iconUrl)}" alt="${escapeHtml(plat.label)}" width="${size}" height="${size}" style="width:${size}px;height:${size}px;border-radius:50%;border:0;object-fit:cover;vertical-align:middle;" />`
      : `<span style="display:inline-block;width:${size}px;height:${size}px;line-height:${size}px;border-radius:50%;background:${plat.color};color:#ffffff;font-size:12px;font-weight:bold;text-align:center;vertical-align:middle;">${escapeHtml(plat.initial)}</span>`;
    return `<a href="${escapeHtml(l.url)}" title="${escapeHtml(plat.label)}" style="text-decoration:none;display:inline-block;vertical-align:middle;margin:0 5px;">${inner}</a>`;
  }).join("");
  return `\n  <div style="padding:4px 28px 20px;text-align:${safeAlign(props.align)};">${items}</div>`;
};

const renderImage = (_d, props = {}) => {
  if (!props.url) return "";
  const width = props.width ? `width:${escapeHtml(String(props.width))};max-width:100%;` : "max-width:100%;";
  const align = safeAlign(props.align);
  return `\n  <div style="text-align:${align};"><img src="${escapeHtml(props.url)}" alt="" style="${width}display:inline-block;border:0;" /></div>`;
};

const BLOCK_RENDERERS = {
  header:    renderHeader,
  body:      renderBody,
  footer:    renderFooter,
  button:    renderButton,
  divider:   renderDivider,
  spacer:    renderSpacer,
  signature: renderSignature,
  social:    renderSocial,
  image:     renderImage,
};

/**
 * wrapEmailHtml — wrap a rendered message in the branded email shell.
 * @param {string} content  the message (plain text or rich HTML), variables already resolved
 * @param {Object} [opts]   a (partial) email design object, or legacy { companyName }.
 *                          May carry `opts.layout` (array of sections, or
 *                          { sections }) to drive the editable block stack.
 * @returns {string} self-contained HTML (a card div) — valid both as an email
 *                   body and when injected into the editor preview.
 */
const wrapEmailHtml = (content = "", opts = {}) => {
  const d = mergeDesign(opts);
  const year = new Date().getFullYear();
  const sections = resolveSections(d, opts && opts.layout);

  // The body carries the actual message — it must always render, even if a bad
  // payload disabled it or a custom layout forgot it entirely.
  if (!sections.some((s) => s.key === "body")) sections.push({ key: "body", enabled: true, props: {} });

  const inner = sections
    .filter((s) => s && (s.key === "body" || s.enabled !== false))
    .map((s) => {
      const fn = BLOCK_RENDERERS[s.key];
      return fn ? fn(d, s.props || {}, content, year) : "";
    })
    .join("");

  return `<div style="max-width:600px;margin:0 auto;background:${d.bgColor};border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;">${inner}
</div>`;
};

module.exports = {
  wrapEmailHtml,
  mergeDesign,
  EMAIL_DESIGN_DEFAULTS,
  BLOCK_CATALOG,
  KNOWN_BLOCK_KEYS,
};
