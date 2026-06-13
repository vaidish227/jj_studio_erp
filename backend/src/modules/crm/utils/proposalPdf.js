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
 * Layout intentionally mirrors shared/components/ProposalViewer/ProposalViewer.jsx
 * (the letter-format document shown on the review screen) so the recipient sees
 * the same document on screen, in the downloaded PDF, in the email attachment,
 * and in the project Document Repository.
 */
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const puppeteer = require("puppeteer");

// ─── Company branding (env-overridable so legal/marketing can change copy
//     without a code deploy). Falls back to JJ Studio defaults. (#33)
const BRAND = {
  name: process.env.COMPANY_NAME || "JJ Studio",
  tagline: process.env.COMPANY_TAGLINE || "-Reinventing your Interiors",
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

// Totals are shown like the on-screen viewer: en-IN grouping, 2 decimals, no ₹.
const fmt2 = (n) => {
  const num = parseNum(n);
  return (num === null ? 0 : num).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// ─── HTML template ────────────────────────────────────────────────────────────
// Self-contained — no external CSS, no external images. Puppeteer can render
// this offline without network. Mirrors ProposalViewer.jsx cell-for-cell:
// letter format (To / Dt. / Sub / Dear / numbered intro), S.No. tables with
// a)/b) row letters, raw cell values, totals table, fixed terms, signoff.
const buildHtml = (proposal, client) => {
  const sections = proposal.content?.sections || [];

  const dt = new Date(proposal.createdAt || Date.now())
    .toLocaleDateString("en-GB")
    .replace(/\//g, ".");
  const firstName = (client?.name || "").trim().split(/\s+/)[0] || "Sir/Madam";

  const sectionsHtml = sections
    .map((section, sIdx) => {
      const cols = section.structure?.columns || [];
      const rows = section.structure?.rows || [];

      const headerCells = [`<th class="sno">S.No.</th>`]
        .concat(cols.map((c) => `<th>${esc(c.label || "")}</th>`))
        .join("");

      const bodyRows = rows.length === 0
        ? `<tr><td colspan="${cols.length + 1}" class="empty">Empty section structure</td></tr>`
        : rows
            .map((row, rIdx) => {
              if (row.isGroupHeader) {
                const label = row.cells?.[cols[0]?.id] || "Unnamed Group";
                return `<tr class="group"><td class="sno"></td><td colspan="${cols.length}">${esc(label)}</td></tr>`;
              }
              const cells = cols
                .map((c, idx) => {
                  // Same alignment rule as the viewer: number columns and the
                  // last column right-align; values render raw (no formatting).
                  const right = c.type === "number" || idx === cols.length - 1;
                  return `<td${right ? ' class="right"' : ""}>${esc(row.cells?.[c.id] ?? "")}</td>`;
                })
                .join("");
              return `<tr><td class="sno">${String.fromCharCode(97 + (rIdx % 26))})</td>${cells}</tr>`;
            })
            .join("");

      return `
      <div class="section">
        <h3>${sIdx + 1}. ${esc(section.title || "Section")}</h3>
        <table>
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>`;
    })
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(proposal.title || "Proposal")}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #000; margin: 0; font-size: 12px; line-height: 1.5; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; }
  .brand h1 { font-family: Georgia, "Times New Roman", serif; color: #dc2626; font-size: 32px; font-weight: 700; font-style: italic; margin: 0 0 4px 0; }
  .brand .tag { font-size: 15px; font-style: italic; font-weight: 600; margin: 0 0 8px 0; }
  .brand .addr { font-weight: 500; margin: 0; }
  .contact { text-align: right; font-weight: 500; }
  .contact p { margin: 0 0 2px 0; }
  .meta { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #d1d5db; padding-top: 22px; margin-bottom: 30px; }
  .meta p { margin: 0 0 3px 0; }
  .meta .to, .meta .date { font-weight: 700; text-decoration: underline; }
  .meta .name { font-weight: 700; }
  .meta .address { font-weight: 500; }
  .subject { text-align: center; font-weight: 700; text-decoration: underline; margin: 0 0 30px 0; }
  .intro { font-weight: 500; margin-bottom: 30px; }
  .intro .dear { font-weight: 700; margin: 0 0 14px 0; }
  .intro .point { display: flex; gap: 16px; margin: 0 0 14px 0; }
  .intro .point span { flex-shrink: 0; }
  .intro .point p { margin: 0; }
  .section { margin-bottom: 28px; page-break-inside: avoid; }
  .section h3 { font-size: 14px; font-weight: 700; margin: 0 0 8px 0; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #000; }
  th, td { border: 1px solid #000; padding: 7px 10px; text-align: left; vertical-align: top; font-weight: 500; }
  thead th { background: #f9fafb; font-weight: 700; text-align: center; }
  td.sno, th.sno { width: 44px; text-align: center; }
  td.right { text-align: right; }
  tr.group td { background: #f3f4f6; font-weight: 700; }
  td.empty { text-align: center; font-style: italic; padding: 24px; color: #666; }
  tr { page-break-inside: avoid; }
  .totals { margin-top: 30px; page-break-inside: avoid; }
  .totals td { font-weight: 700; text-align: right; }
  .totals td.label { width: 75%; }
  .totals tr.grand td { background: #f3f4f6; }
  .terms { font-weight: 500; padding-left: 32px; margin-top: 36px; }
  .terms p { margin: 0 0 8px 0; }
  .signoff { font-weight: 700; margin-top: 56px; page-break-inside: avoid; }
  .signoff .for { font-style: italic; margin-top: 32px; }
</style></head>
<body>
  <div class="header">
    <div class="brand">
      <h1>${esc(BRAND.name)}</h1>
      <p class="tag">${esc(BRAND.tagline)}</p>
      <p class="addr">${esc(BRAND.addressLine1)}</p>
      <p class="addr">${esc(BRAND.addressLine2)}</p>
    </div>
    <div class="contact">
      <p>Email: ${esc(BRAND.email)}</p>
      <p>(M) : ${esc(BRAND.mobile)}</p>
      <p>(O) : ${esc(BRAND.office)}</p>
    </div>
  </div>

  <div class="meta">
    <div>
      <p class="to">To</p>
      <p class="name">${esc(client?.name || "Client Name")}</p>
      <p class="address">${esc(client?.address || "Client Address")}</p>
    </div>
    <div>
      <p class="date">Dt. ${dt}</p>
    </div>
  </div>

  <p class="subject">Sub :- ${esc(proposal.title || "Estimate for interior works")}</p>

  <div class="intro">
    <p class="dear">Dear ${esc(firstName)},</p>
    <div class="point"><span>1)</span><p>We will provide all the necessary services and skill to the best of our ability during the designing and execution of the above mentioned property.</p></div>
    <div class="point"><span>2)</span><p>Estimated cost of the project as follows :-</p></div>
  </div>

  ${sectionsHtml}

  <div class="totals">
    <table>
      <tbody>
        <tr><td class="label">Sub Total</td><td>${fmt2(proposal.subtotal)}</td></tr>
        <tr><td class="label">GST (18%)</td><td>${fmt2(proposal.gst)}</td></tr>
        <tr class="grand"><td class="label">Total Project Cost</td><td>${fmt2(proposal.finalAmount)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="terms">
    <p>ii) Any kind of accessories like Chandeliar, Art effects for décor of the handled on the actual Cost basis.</p>
    <p>iii) The above cost is an estimate for your reference, while the project will be handled on the actual Cost basis.</p>
  </div>

  <div class="signoff">
    <p>Regards,</p>
    <p class="for">${esc(BRAND.signoff)}</p>
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

// getBrowser is shared with other modules (e.g. PMS designer report) so the
// whole process keeps exactly one Chromium instance.
module.exports = { generateProposalPdfBuffer, saveProposalPdf, closeBrowser, getBrowser };
