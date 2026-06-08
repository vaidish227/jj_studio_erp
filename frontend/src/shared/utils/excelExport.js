import * as XLSX from 'xlsx';

/**
 * Export a report JSON payload as a multi-sheet Excel workbook.
 *
 * Expected payload shape (matches backend report endpoints):
 *   {
 *     reportName: 'Designer KPI Report',
 *     period: 'month',
 *     generatedAt: ISO string,
 *     rows: [...],
 *     summary: { ... }    // optional — rendered as a second sheet
 *   }
 *
 * @param {Object} payload   — backend response
 * @param {Object} options
 * @param {string} options.fileName  — without extension; date is appended
 * @param {Array}  options.columns   — [{ header, key, width? }] in display order;
 *                                     keys are picked from each `rows` entry
 * @param {Object} [options.summaryLabels] — { key: 'Friendly Label' } for summary sheet
 */
export const exportReportAsExcel = (payload, options) => {
  if (!payload || !options) throw new Error('exportReportAsExcel: payload + options required');
  const {
    fileName = 'report',
    columns = [],
    summaryLabels = {},
  } = options;

  const wb = XLSX.utils.book_new();

  // ── Main rows sheet ───────────────────────────────────────────────────────
  const headers = columns.map((c) => c.header);
  const rows = (payload.rows || []).map((r) => columns.map((c) => r[c.key] ?? ''));
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths — fall back to a sensible default
  ws['!cols'] = columns.map((c) => ({ wch: c.width || Math.max(12, c.header.length + 2) }));

  XLSX.utils.book_append_sheet(wb, ws, 'Data');

  // ── Summary sheet (optional) ──────────────────────────────────────────────
  if (payload.summary && Object.keys(payload.summary).length > 0) {
    const summaryRows = [
      ['Report',       payload.reportName || fileName],
      ['Period',       payload.period || ''],
      ['Generated At', payload.generatedAt ? new Date(payload.generatedAt).toLocaleString('en-IN') : ''],
      [],
      ['Metric', 'Value'],
      ...Object.entries(payload.summary).map(([k, v]) => [summaryLabels[k] || k, v]),
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
    summaryWs['!cols'] = [{ wch: 28 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
  }

  // ── Trigger download ──────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const finalName = `${fileName}_${today}.xlsx`;
  XLSX.writeFile(wb, finalName);
};
