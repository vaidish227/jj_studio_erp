/**
 * Designer Performance Report — PDF "report card" for one designer.
 *
 * Renders the same data the Designer Detail Page shows (computeDesignerDetail
 * payload) as a fixed A4 document: KPI strip, KRA breakdown, 12-week trend,
 * monthly delivery, status distribution, project + recent-task tables.
 *
 * Charts are inline SVG built server-side — no Recharts, no JS in the page —
 * so Puppeteer renders the document offline without network.
 *
 * Entry point: generateDesignerReportPdfBuffer(detail) → Buffer
 */
const { getBrowser } = require("../../crm/utils/proposalPdf");

// ─── Company branding (same env overrides as the proposal PDF) ───────────────
const BRAND = {
  name: process.env.COMPANY_NAME || "JJ Studio",
  tagline: process.env.COMPANY_TAGLINE || "-Reinventing your Interiors",
};

// Mirrors STATUS_LABEL / STATUS_COLOR in DesignerDetailPage.jsx so the PDF
// reads the same as the on-screen page.
const STATUS_LABEL = {
  not_started:             "Not Started",
  in_progress:             "In Progress",
  blocked:                 "Blocked",
  pending_review:          "Submitted",
  revision_requested:      "Revision",
  pending_client_approval: "Pending Client",
  approved:                "Approved",
  released_to_site:        "Released",
  completed:               "Completed",
  on_hold:                 "On Hold",
  unknown:                 "Unknown",
};
const STATUS_COLOR = {
  not_started:             "#94a3b8",
  in_progress:             "#3b82f6",
  blocked:                 "#ef4444",
  pending_review:          "#f59e0b",
  revision_requested:      "#ef4444",
  pending_client_approval: "#f59e0b",
  approved:                "#10b981",
  released_to_site:        "#8b5cf6",
  completed:               "#22c55e",
  on_hold:                 "#64748b",
  unknown:                 "#cbd5e1",
};

const PERIOD_LABEL = {
  week:    "Last 7 Days",
  month:   "Last 30 Days",
  quarter: "Last 90 Days",
  all:     "All Time",
};

const COLOR = {
  gold:    "#b3923f",
  green:   "#16a34a",
  blue:    "#2563eb",
  amber:   "#d97706",
  red:     "#dc2626",
  text:    "#0f172a",
  muted:   "#64748b",
  border:  "#e2e8f0",
  grid:    "#eef2f7",
  surface: "#f8fafc",
};

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const kraColor = (score) =>
  score >= 4 ? COLOR.green : score >= 2.5 ? COLOR.amber : COLOR.red;

// ─── SVG charts ───────────────────────────────────────────────────────────────

/**
 * Two-series percentage line chart over the 12-week trend (On-Time %, First-
 * Pass %). Weeks with no completions are null — like the on-screen chart
 * (connectNulls) the line joins the surrounding non-null points.
 */
const weeklyTrendSvg = (weekly) => {
  const W = 700, H = 220, L = 36, R = 8, T = 12, B = 28;
  const plotW = W - L - R, plotH = H - T - B;
  const n = weekly.length;
  if (n === 0) return "";

  const x = (i) => L + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v) => T + (1 - v / 100) * plotH;

  const grid = [0, 25, 50, 75, 100].map((v) => `
    <line x1="${L}" y1="${y(v)}" x2="${W - R}" y2="${y(v)}" stroke="${COLOR.grid}" stroke-width="1"/>
    <text x="${L - 5}" y="${y(v) + 3}" text-anchor="end" font-size="8" fill="${COLOR.muted}">${v}</text>`).join("");

  const labels = weekly.map((w, i) => (i % 2 === 0 ? `
    <text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="8" fill="${COLOR.muted}">${esc(
      new Date(w.weekStart).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    )}</text>` : "")).join("");

  const series = (key, color) => {
    const pts = weekly
      .map((w, i) => (w[key] == null ? null : `${x(i)},${y(w[key])}`))
      .filter(Boolean);
    if (pts.length === 0) return "";
    const dots = weekly
      .map((w, i) => (w[key] == null ? "" : `<circle cx="${x(i)}" cy="${y(w[key])}" r="2.5" fill="${color}"/>`))
      .join("");
    return `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2"/>${dots}`;
  };

  const onTime = series("onTimePct", COLOR.green);
  const firstPass = series("firstPassPct", COLOR.blue);
  const empty = !onTime && !firstPass
    ? `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="10" fill="${COLOR.muted}">No completions in the last 12 weeks</text>`
    : "";

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg">
    ${grid}${labels}${onTime}${firstPass}${empty}
  </svg>`;
};

/** Monthly delivery bar chart — last 6 calendar months. */
const monthlyBarsSvg = (monthly) => {
  const W = 700, H = 190, L = 24, R = 8, T = 18, B = 26;
  const plotW = W - L - R, plotH = H - T - B;
  const n = monthly.length;
  if (n === 0) return "";
  const max = Math.max(1, ...monthly.map((m) => m.done));
  const slot = plotW / n;
  const barW = Math.min(56, slot * 0.5);

  const bars = monthly.map((m, i) => {
    const h = (m.done / max) * plotH;
    const bx = L + i * slot + (slot - barW) / 2;
    const by = T + plotH - h;
    return `
      <rect x="${bx}" y="${by}" width="${barW}" height="${Math.max(h, 1)}" rx="3" fill="${COLOR.gold}"/>
      <text x="${bx + barW / 2}" y="${by - 4}" text-anchor="middle" font-size="9" font-weight="700" fill="${COLOR.text}">${m.done}</text>
      <text x="${bx + barW / 2}" y="${H - 8}" text-anchor="middle" font-size="8" fill="${COLOR.muted}">${esc(m.label)}</text>`;
  }).join("");

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg">
    <line x1="${L}" y1="${T + plotH}" x2="${W - R}" y2="${T + plotH}" stroke="${COLOR.border}" stroke-width="1"/>
    ${bars}
  </svg>`;
};

/** Status distribution donut + HTML legend (counts all tasks in the window). */
const statusDonutHtml = (statusDistribution) => {
  const total = statusDistribution.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return `<p class="empty-note">No tasks in this window.</p>`;
  }
  const R0 = 52, CX = 70, CY = 70, SW = 24;
  const C = 2 * Math.PI * R0;
  let offset = 0;
  const segs = statusDistribution.map((d) => {
    const len = (d.count / total) * C;
    const color = STATUS_COLOR[d.status] || STATUS_COLOR.unknown;
    const seg = `<circle cx="${CX}" cy="${CY}" r="${R0}" fill="none" stroke="${color}" stroke-width="${SW}"
      stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${CX} ${CY})"/>`;
    offset += len;
    return seg;
  }).join("");

  const legend = statusDistribution.map((d) => `
    <div class="legend-row">
      <span class="legend-dot" style="background:${STATUS_COLOR[d.status] || STATUS_COLOR.unknown}"></span>
      <span class="legend-label">${esc(STATUS_LABEL[d.status] || d.status)}</span>
      <span class="legend-count">${d.count}</span>
    </div>`).join("");

  return `
    <div class="donut-wrap">
      <svg viewBox="0 0 140 140" width="130" xmlns="http://www.w3.org/2000/svg">
        ${segs}
        <text x="${CX}" y="${CY - 2}" text-anchor="middle" font-size="20" font-weight="800" fill="${COLOR.text}">${total}</text>
        <text x="${CX}" y="${CY + 14}" text-anchor="middle" font-size="8" fill="${COLOR.muted}">tasks</text>
      </svg>
      <div class="legend">${legend}</div>
    </div>`;
};

/** KRA component bars — the three weighted inputs behind the 0–5 score. */
const kraBarsHtml = (kraBreakdown) => {
  const rows = [
    { label: "On-Time Delivery", weight: "45%", value: kraBreakdown.onTime ?? 0,     color: COLOR.green },
    { label: "First-Pass Approval", weight: "35%", value: kraBreakdown.firstPass ?? 0, color: COLOR.blue },
    { label: "Throughput", weight: "20%", value: kraBreakdown.throughput ?? 0,        color: COLOR.gold },
  ];
  return rows.map((r) => `
    <div class="kra-row">
      <span class="kra-label">${r.label} <span class="kra-weight">(weight ${r.weight})</span></span>
      <span class="kra-track"><span class="kra-fill" style="width:${Math.min(100, Math.max(0, r.value))}%;background:${r.color}"></span></span>
      <span class="kra-pct">${r.value}%</span>
    </div>`).join("");
};

// ─── HTML template ────────────────────────────────────────────────────────────
const buildHtml = (detail) => {
  const { user, period, currentStats, kraBreakdown, trend, statusDistribution, projects, recentTasks } = detail;
  const periodLabel = PERIOD_LABEL[period] || period;
  const generated = fmtDate(new Date());
  const kraTone = kraColor(currentStats.kraScore);

  const projectRows = (projects || []).map((p) => `
    <tr>
      <td><strong>${esc(p.name)}</strong>${p.trackingId ? `<div class="mono">${esc(p.trackingId)}</div>` : ""}</td>
      <td class="cap">${esc(p.phase || "—")}</td>
      <td class="cap">${esc(String(p.status || "—").replace(/_/g, " "))}</td>
      <td class="num">${p.tasks?.active ?? 0}</td>
      <td class="num good">${p.tasks?.done ?? 0}</td>
    </tr>`).join("");

  const taskRows = (recentTasks || []).map((t) => {
    const color = STATUS_COLOR[t.status] || STATUS_COLOR.unknown;
    return `
    <tr>
      <td><strong>${esc(t.title)}</strong><div class="sub">${esc(t.projectName || "—")}</div></td>
      <td><span class="chip" style="color:${color};border-color:${color}55;background:${color}14">${esc(STATUS_LABEL[t.status] || t.status)}</span></td>
      <td class="num${t.isDelayed ? " bad" : ""}">${fmtDate(t.dueDate)}</td>
    </tr>`;
  }).join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Designer Performance Report — ${esc(user.name || "")}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: ${COLOR.text}; margin: 0; font-size: 11px; line-height: 1.45; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid ${COLOR.gold}; padding-bottom: 10px; margin-bottom: 16px; }
  .brand h1 { font-family: Georgia, "Times New Roman", serif; color: #dc2626; font-size: 24px; font-weight: 700; font-style: italic; margin: 0; }
  .brand .tag { font-size: 10px; font-style: italic; font-weight: 600; margin: 2px 0 0; color: ${COLOR.muted}; }
  .report-meta { text-align: right; }
  .report-meta h2 { font-size: 15px; margin: 0 0 2px; }
  .report-meta p { margin: 0; color: ${COLOR.muted}; font-size: 10px; }

  .identity { display: flex; align-items: center; gap: 12px; background: ${COLOR.surface}; border: 1px solid ${COLOR.border}; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; }
  .avatar { width: 42px; height: 42px; border-radius: 50%; background: ${COLOR.gold}22; color: ${COLOR.gold}; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 800; text-transform: uppercase; }
  .identity .who h3 { margin: 0; font-size: 14px; }
  .identity .who p { margin: 2px 0 0; color: ${COLOR.muted}; font-size: 10px; }
  .identity .role { margin-left: auto; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; border: 1px solid ${COLOR.border}; border-radius: 5px; padding: 3px 8px; background: #fff; }

  .kpis { display: flex; gap: 8px; margin-bottom: 14px; }
  .kpi { flex: 1; border: 1px solid ${COLOR.border}; border-radius: 10px; padding: 9px 10px; }
  .kpi .k-label { font-size: 7.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: ${COLOR.muted}; margin-bottom: 3px; }
  .kpi .k-value { font-size: 19px; font-weight: 800; }
  .kpi .k-value small { font-size: 10px; font-weight: 700; color: ${COLOR.muted}; }
  .kpi .k-sub { font-size: 8px; color: ${COLOR.muted}; margin-top: 2px; }

  .card { border: 1px solid ${COLOR.border}; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; page-break-inside: avoid; }
  .card h4 { margin: 0 0 8px; font-size: 11px; }
  .card h4 .hint { font-weight: 400; color: ${COLOR.muted}; font-size: 9px; }
  .two-col { display: flex; gap: 12px; }
  .two-col .card { flex: 1; min-width: 0; }

  .kra-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
  .kra-label { width: 215px; font-size: 10px; font-weight: 600; }
  .kra-weight { color: ${COLOR.muted}; font-weight: 400; font-size: 9px; }
  .kra-track { flex: 1; height: 9px; background: ${COLOR.grid}; border-radius: 5px; overflow: hidden; display: block; }
  .kra-fill { display: block; height: 100%; border-radius: 5px; }
  .kra-pct { width: 36px; text-align: right; font-weight: 800; font-size: 10px; }

  .legend-series { display: flex; gap: 14px; margin-bottom: 6px; }
  .legend-series span { font-size: 9px; color: ${COLOR.muted}; font-weight: 600; }
  .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 4px; }

  .donut-wrap { display: flex; align-items: center; gap: 16px; }
  .legend { flex: 1; }
  .legend-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .legend-label { font-size: 9.5px; flex: 1; }
  .legend-count { font-size: 9.5px; font-weight: 800; }
  .empty-note { color: ${COLOR.muted}; font-size: 10px; text-align: center; padding: 20px 0; }

  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: ${COLOR.muted}; border-bottom: 1px solid ${COLOR.border}; padding: 4px 6px; }
  td { border-bottom: 1px solid ${COLOR.grid}; padding: 5px 6px; vertical-align: top; font-size: 10px; }
  tr:last-child td { border-bottom: none; }
  tr { page-break-inside: avoid; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  td.cap { text-transform: capitalize; }
  td .sub, td .mono { font-size: 8.5px; color: ${COLOR.muted}; }
  td .mono { font-family: "Courier New", monospace; }
  .good { color: ${COLOR.green}; font-weight: 800; }
  .bad { color: ${COLOR.red}; font-weight: 800; }
  .chip { display: inline-block; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid; border-radius: 4px; padding: 1.5px 6px; }

  .footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid ${COLOR.border}; display: flex; justify-content: space-between; color: ${COLOR.muted}; font-size: 8.5px; }
</style></head>
<body>
  <div class="header">
    <div class="brand">
      <h1>${esc(BRAND.name)}</h1>
      <p class="tag">${esc(BRAND.tagline)}</p>
    </div>
    <div class="report-meta">
      <h2>Designer Performance Report</h2>
      <p>Period: ${esc(periodLabel)} &nbsp;•&nbsp; Generated: ${esc(generated)}</p>
    </div>
  </div>

  <div class="identity">
    <div class="avatar">${esc((user.name || "?").slice(0, 2))}</div>
    <div class="who">
      <h3>${esc(user.name || "—")}</h3>
      <p>${esc(user.email || "")}${user.email && user.phone ? " &nbsp;•&nbsp; " : ""}${esc(user.phone || "")}</p>
    </div>
    <div class="role">${esc(user.role || "—")}</div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="k-label">KRA Score</div><div class="k-value" style="color:${kraTone}">${currentStats.kraScore}<small> /5</small></div><div class="k-sub">0–5 composite</div></div>
    <div class="kpi"><div class="k-label">On-Time</div><div class="k-value" style="color:${COLOR.green}">${currentStats.onTimePct}<small>%</small></div><div class="k-sub">of completed</div></div>
    <div class="kpi"><div class="k-label">First-Pass</div><div class="k-value" style="color:${COLOR.blue}">${currentStats.firstPassPct}<small>%</small></div><div class="k-sub">approved w/o revision</div></div>
    <div class="kpi"><div class="k-label">Delivered</div><div class="k-value" style="color:${COLOR.gold}">${currentStats.throughput}</div><div class="k-sub">in period</div></div>
    <div class="kpi"><div class="k-label">Active Tasks</div><div class="k-value">${currentStats.active}</div><div class="k-sub">currently open</div></div>
    <div class="kpi"><div class="k-label">Overdue</div><div class="k-value" style="color:${COLOR.red}">${currentStats.delayedActive}</div><div class="k-sub">past due date</div></div>
  </div>

  <div class="card">
    <h4>KRA Breakdown <span class="hint">— weighted components of the composite score</span></h4>
    ${kraBarsHtml(kraBreakdown || {})}
  </div>

  <div class="card">
    <h4>Delivery Quality — Last 12 Weeks</h4>
    <div class="legend-series">
      <span><span class="dot" style="background:${COLOR.green}"></span>On-Time %</span>
      <span><span class="dot" style="background:${COLOR.blue}"></span>First-Pass %</span>
    </div>
    ${weeklyTrendSvg(trend?.weekly || [])}
  </div>

  <div class="two-col">
    <div class="card">
      <h4>Monthly Delivery — Last 6 Months</h4>
      ${monthlyBarsSvg(trend?.monthly || [])}
    </div>
    <div class="card">
      <h4>Task Status Distribution</h4>
      ${statusDonutHtml(statusDistribution || [])}
    </div>
  </div>

  <div class="card">
    <h4>Projects Assigned <span class="hint">— ${(projects || []).length} in window</span></h4>
    ${(projects || []).length === 0 ? `<p class="empty-note">No projects assigned in this window.</p>` : `
    <table>
      <thead><tr><th>Project</th><th>Phase</th><th>Status</th><th class="num">Active</th><th class="num">Done</th></tr></thead>
      <tbody>${projectRows}</tbody>
    </table>`}
  </div>

  <div class="card">
    <h4>Recent Tasks <span class="hint">— last ${(recentTasks || []).length} by activity</span></h4>
    ${(recentTasks || []).length === 0 ? `<p class="empty-note">No recent activity.</p>` : `
    <table>
      <thead><tr><th>Task</th><th>Status</th><th class="num">Due</th></tr></thead>
      <tbody>${taskRows}</tbody>
    </table>`}
  </div>

  <div class="footer">
    <span>Generated by ${esc(BRAND.name)} ERP</span>
    <span>${esc(user.name || "")} • ${esc(periodLabel)} • ${esc(generated)}</span>
  </div>
</body></html>`;
};

// ─── PDF generation ───────────────────────────────────────────────────────────
const generateDesignerReportPdfBuffer = async (detail) => {
  const html = buildHtml(detail);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", right: "12mm", bottom: "14mm", left: "12mm" },
    });
  } finally {
    await page.close().catch(() => {});
  }
};

module.exports = { generateDesignerReportPdfBuffer };
