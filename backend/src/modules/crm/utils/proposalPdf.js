/**
 * Generates a PDF for a proposal using a headless Chromium (Puppeteer).
 *
 * Two entry points:
 *   - generateProposalPdfBuffer(proposal, client) → Buffer
 *     Pure in-memory render. Use for email attachments where Nodemailer can
 *     accept a buffer directly.
 *
 *   - saveProposalPdf(buffer, proposalId) → { absolutePath, publicUrl }
 *     Persists the buffer to backend/public/proposals/ and returns the URL
 *     that WhatsApp providers (Maytapi/Twilio) can fetch as media. We must
 *     persist because providers require a publicly reachable URL — they do
 *     not accept buffers like email does.
 *
 * Layout intentionally mirrors ProposalPreviewModal.jsx so the recipient sees
 * the same document on screen and in the PDF.
 */
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("puppeteer");

// ─── Company branding (env-overridable so legal/marketing can change copy
//     without a code deploy). Falls back to JJ Studio defaults. (#33)
const BRAND = {
  name: process.env.COMPANY_NAME || "JJ Studio",
  tagline: process.env.COMPANY_TAGLINE || "- Reinventing your Interiors",
  addressLine1: process.env.COMPANY_ADDRESS_LINE1 || "Avani Oxford, Laketown",
  addressLine2: process.env.COMPANY_ADDRESS_LINE2 || "Kolkata - 700 055",
  email: process.env.COMPANY_EMAIL || "deepa@jjstudio.in",
  mobile: process.env.COMPANY_MOBILE || "9830015200",
  office: process.env.COMPANY_OFFICE || "033 79697900",
  signoff: process.env.COMPANY_SIGNOFF || "for JJ Studio / Deepa Bagaria",
};

// ─── Output directory ─────────────────────────────────────────────────────────
const PDF_DIR = path.join(__dirname, "..", "..", "..", "..", "public", "proposals");

const ensureDir = async () => {
  try {
    await fs.mkdir(PDF_DIR, { recursive: true });
  } catch (_err) {
    // already exists or permission issue — propagate later if write fails
  }
};

// ─── Small format helpers ─────────────────────────────────────────────────────
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

// parseNum tolerates strings like "5,000", "₹1,200.50" → numeric.
// Anything fully non-numeric returns null so callers can render the raw text.
const parseNum = (n) => {
  if (n === null || n === undefined || n === "") return null;
  if (typeof n === "number") return Number.isFinite(n) ? n : null;
  const cleaned = String(n).replace(/[₹,\s]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

const inr = (n) => {
  const num = parseNum(n);
  return num === null ? esc(String(n ?? "")) : `₹${num.toLocaleString("en-IN")}`;
};

// ─── HTML template ────────────────────────────────────────────────────────────
// Self-contained — no external CSS, no external images. Puppeteer can render
// this offline without network. Visual style follows ProposalPreviewModal.
const buildHtml = (proposal, client) => {
  const sections = proposal.content?.sections || [];
  const subtotal = proposal.subtotal || 0;
  const gst = proposal.gst || 0;
  const finalAmount = proposal.finalAmount || 0;

  // Render each section using whatever columns the template actually has —
  // no hard-coded Item/Qty/Rate/Amount lookup so dynamic templates render correctly.
  const sectionsHtml = sections
    .map((section) => {
      const cols = section.structure?.columns || [];
      const colCount = cols.length || 1;

      // Column types: 'number' cells use INR formatting + right alignment.
      const headerCells = cols
        .map((c) => `<th class="${c.type === "number" ? "right" : ""}">${esc(c.label || "")}</th>`)
        .join("");

      const rows = (section.structure?.rows || [])
        .map((row) => {
          if (row.isGroupHeader) {
            const label = cols[0] ? row.cells?.[cols[0].id] : "";
            return `<tr><td colspan="${colCount}" class="row-group">${esc(label || "")}</td></tr>`;
          }
          const cells = cols
            .map((c) => {
              const raw = row.cells?.[c.id];
              if (c.type === "number") {
                return `<td class="right">${inr(raw)}</td>`;
              }
              return `<td>${esc(raw ?? "")}</td>`;
            })
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("");

      return `
        <h3 class="section-title">${esc(section.title || "Section")}</h3>
        <table class="items">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${rows || `<tr><td colspan="${colCount}"><em>No rows.</em></td></tr>`}</tbody>
        </table>`;
    })
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(proposal.title || "Proposal")}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #111; margin: 0; padding: 32px; font-size: 12px; line-height: 1.45; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
  .brand h1 { font-family: Georgia, serif; color: #c1272d; font-size: 32px; margin: 0; font-style: italic; }
  .brand .tag { font-style: italic; font-weight: 600; margin: 2px 0 8px 0; }
  .brand .addr { font-size: 11px; }
  .contact { text-align: right; font-size: 11px; }
  .meta { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #d4d4d4; padding-top: 16px; margin-bottom: 24px; }
  .meta .client p { margin: 2px 0; font-size: 11px; }
  .meta .client .name { font-weight: 700; font-size: 14px; }
  .meta .ref { text-align: right; font-size: 11px; }
  .meta .ref strong { display: block; font-size: 14px; margin-bottom: 4px; }
  h2.title { font-size: 18px; margin: 0 0 20px 0; padding-bottom: 8px; border-bottom: 2px solid #c1272d; }
  .description { font-size: 12px; color: #444; margin-bottom: 18px; white-space: pre-wrap; }
  .section-title { font-size: 13px; margin: 18px 0 6px 0; color: #c1272d; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  table.items th, table.items td { border: 1px solid #e0e0e0; padding: 6px 8px; font-size: 11px; vertical-align: top; }
  table.items th { background: #fafafa; text-align: left; font-weight: 700; }
  table.items td.right, table.items th.right { text-align: right; }
  table.items tr.row-group td, .row-group { background: #f3f4f6; font-weight: 700; }
  .totals { width: 280px; margin-left: auto; margin-top: 20px; border-top: 2px solid #111; padding-top: 10px; }
  .totals .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  .totals .row.grand { border-top: 1px solid #d4d4d4; margin-top: 6px; padding-top: 8px; font-size: 14px; font-weight: 700; }
  .footer { margin-top: 36px; font-size: 10px; color: #666; border-top: 1px solid #e0e0e0; padding-top: 10px; }
</style></head>
<body>
  <div class="header">
    <div class="brand">
      <h1>${esc(BRAND.name)}</h1>
      <div class="tag">${esc(BRAND.tagline)}</div>
      <div class="addr">${esc(BRAND.addressLine1)}</div>
      <div class="addr">${esc(BRAND.addressLine2)}</div>
    </div>
    <div class="contact">
      <div>Email: ${esc(BRAND.email)}</div>
      <div>(M): ${esc(BRAND.mobile)}</div>
      <div>(O): ${esc(BRAND.office)}</div>
    </div>
  </div>

  <div class="meta">
    <div class="client">
      <p class="name">${esc(client?.name || "Client")}</p>
      ${client?.email ? `<p>${esc(client.email)}</p>` : ""}
      ${client?.phone ? `<p>${esc(client.phone)}</p>` : ""}
      ${client?.siteAddress?.fullAddress ? `<p>${esc(client.siteAddress.fullAddress)}</p>` : ""}
    </div>
    <div class="ref">
      ${client?.trackingId ? `<strong>${esc(client.trackingId)}</strong>` : ""}
      <div>Date: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
      ${proposal._id ? `<div>Ref: ${esc(String(proposal._id).slice(-8).toUpperCase())}</div>` : ""}
    </div>
  </div>

  <h2 class="title">${esc(proposal.title || "Proposal")}</h2>
  ${proposal.description ? `<div class="description">${esc(proposal.description)}</div>` : ""}

  ${sectionsHtml || "<p><em>No line items.</em></p>"}

  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${inr(subtotal)}</span></div>
    <div class="row"><span>GST</span><span>${inr(gst)}</span></div>
    <div class="row grand"><span>Final Amount</span><span>${inr(finalAmount)}</span></div>
  </div>

  <div class="footer">
    Generated by JJ Studio ERP on ${new Date().toLocaleString("en-IN")}. This is an automatically generated document.
  </div>
</body></html>`;
};

// ─── Shared Puppeteer browser ─────────────────────────────────────────────────
// Launching a fresh Chromium per request costs ~3s + ~300MB. We keep one
// instance alive across requests and re-create it on disconnect. Pages are
// always closed after use so memory doesn't grow unbounded. (#25)
let _browserPromise = null;

const launchBrowser = () =>
  puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

const getBrowser = async () => {
  if (!_browserPromise) {
    _browserPromise = launchBrowser().then((browser) => {
      // If Chromium crashes or is killed, drop the cached promise so the next
      // call relaunches instead of hanging on a dead connection.
      browser.on("disconnected", () => {
        if (_browserPromise) {
          _browserPromise = null;
        }
      });
      return browser;
    }).catch((err) => {
      _browserPromise = null;
      throw err;
    });
  }
  return _browserPromise;
};

const closeBrowser = async () => {
  if (!_browserPromise) return;
  try {
    const browser = await _browserPromise;
    _browserPromise = null;
    await browser.close();
  } catch {
    _browserPromise = null;
  }
};

// Best-effort shutdown so leftover Chromium processes don't linger.
process.once("SIGINT", closeBrowser);
process.once("SIGTERM", closeBrowser);

// ─── PDF generation ───────────────────────────────────────────────────────────
const generateProposalPdfBuffer = async (proposal, client) => {
  const html = buildHtml(proposal, client);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
    });
  } finally {
    await page.close().catch(() => {});
  }
};

// ─── Persist to disk + build public URL ──────────────────────────────────────
// Filenames embed a 128-bit random token so the URL is not enumerable from a
// known proposalId — WhatsApp/email providers still get a fetchable URL, but
// nobody can guess `proposal-{id}-{timestamp}.pdf` to download it. (NEW-2)
const saveProposalPdf = async (buffer, proposalId) => {
  await ensureDir();
  const token = crypto.randomBytes(16).toString("hex");
  const filename = `proposal-${proposalId}-${token}.pdf`;
  const absolutePath = path.join(PDF_DIR, filename);
  await fs.writeFile(absolutePath, buffer);

  const baseUrl = (process.env.PUBLIC_BASE_URL || process.env.BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");
  const publicUrl = `${baseUrl}/static/proposals/${filename}`;

  return { absolutePath, publicUrl, filename };
};

module.exports = { generateProposalPdfBuffer, saveProposalPdf, closeBrowser };
