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
const puppeteer = require("puppeteer");

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
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

// ─── HTML template ────────────────────────────────────────────────────────────
// Self-contained — no external CSS, no external images. Puppeteer can render
// this offline without network. Visual style follows ProposalPreviewModal.
const buildHtml = (proposal, client) => {
  const sections = proposal.content?.sections || [];
  const subtotal = proposal.subtotal || 0;
  const gst = proposal.gst || 0;
  const finalAmount = proposal.finalAmount || 0;

  const sectionsHtml = sections
    .map((section) => {
      const cols = section.structure?.columns || [];
      const nameCol = cols.find(
        (c) => c.label?.toLowerCase().includes("item") || c.label?.toLowerCase().includes("work")
      );
      const amtCol = cols.find(
        (c) => c.label?.toLowerCase().includes("amount") || c.label?.toLowerCase().includes("total")
      );
      const qtyCol = cols.find((c) => c.label?.toLowerCase().includes("qty") || c.label?.toLowerCase().includes("quantity"));
      const rateCol = cols.find((c) => c.label?.toLowerCase().includes("rate") || c.label?.toLowerCase().includes("price"));

      const rows = (section.structure?.rows || [])
        .map((row) => {
          if (row.isGroupHeader) {
            return `<tr><td colspan="4" class="row-group">${esc(row.label || "")}</td></tr>`;
          }
          const name = row.cells?.[nameCol?.id] || "Item";
          const qty = row.cells?.[qtyCol?.id] || "";
          const rate = row.cells?.[rateCol?.id] || "";
          const amount = row.cells?.[amtCol?.id] || "0";
          return `<tr>
            <td>${esc(name)}</td>
            <td class="right">${esc(qty)}</td>
            <td class="right">${esc(rate)}</td>
            <td class="right">${inr(amount)}</td>
          </tr>`;
        })
        .join("");

      return `
        <h3 class="section-title">${esc(section.title || "Section")}</h3>
        <table class="items">
          <thead>
            <tr>
              <th>Item / Work</th>
              <th class="right">Qty</th>
              <th class="right">Rate</th>
              <th class="right">Amount</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
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
      <h1>JJ Studio</h1>
      <div class="tag">- Reinventing your Interiors</div>
      <div class="addr">Avani Oxford, Laketwon</div>
      <div class="addr">Kolkata - 700 055</div>
    </div>
    <div class="contact">
      <div>Email: deepa@jjstudio.in</div>
      <div>(M): 9830015200</div>
      <div>(O): 033 79697900</div>
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

// ─── PDF generation ───────────────────────────────────────────────────────────
const generateProposalPdfBuffer = async (proposal, client) => {
  const html = buildHtml(proposal, client);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
    });
    return buffer;
  } finally {
    await browser.close();
  }
};

// ─── Persist to disk + build public URL ──────────────────────────────────────
const saveProposalPdf = async (buffer, proposalId) => {
  await ensureDir();
  const filename = `proposal-${proposalId}-${Date.now()}.pdf`;
  const absolutePath = path.join(PDF_DIR, filename);
  await fs.writeFile(absolutePath, buffer);

  const baseUrl = (process.env.PUBLIC_BASE_URL || process.env.BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");
  const publicUrl = `${baseUrl}/static/proposals/${filename}`;

  return { absolutePath, publicUrl, filename };
};

module.exports = { generateProposalPdfBuffer, saveProposalPdf };
