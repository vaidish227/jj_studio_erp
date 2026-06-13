// Shared helpers for building a quotation Template's dynamic-table `structure`
// from an AI-friendly, semantic line-item format. Used by createProposalTemplate
// and addTemplateRows so both map data into the UI's id-keyed shape identically
// (see DynamicTableBuilder.jsx: cells are keyed by column id; a group-header row
// carries its text in the FIRST column's id).
//
// Pure module — no DB access — so it's trivially unit-testable.

const COL_TYPES = ["text", "number", "label"];

// Standard quotation layout used when no columns are specified.
const DEFAULT_COLUMNS = [
  { label: "Sl.No",     type: "label" },
  { label: "Work Item", type: "text" },
  { label: "Qty",       type: "number" },
  { label: "Rate",      type: "number" },
  { label: "Amount",    type: "number" },
];

// Same id style as the UI's generateId().
function shortId() {
  return Math.random().toString(36).substring(2, 9);
}

// Validate friendly column input and assign generated ids. Returns
// { columns } or { error }.
function buildColumns(columnsInput) {
  const raw = columnsInput && columnsInput.length ? columnsInput : DEFAULT_COLUMNS;
  for (const c of raw) {
    if (!c || typeof c.label !== "string" || !c.label.trim()) {
      return { error: "Every column needs a non-empty label." };
    }
  }
  return {
    columns: raw.map((c) => ({
      id: shortId(),
      label: c.label.trim(),
      type: COL_TYPES.includes(c.type) ? c.type : "text",
      width: "auto",
    })),
    usedDefault: !(columnsInput && columnsInput.length),
  };
}

// Map each column to a semantic role by sniffing its label. Order matters:
// more specific roles are matched first so e.g. "Unit Price" → rate, not unit.
function detectColumnRoles(columns) {
  const roles = { slno: null, amount: null, rate: null, unit: null, qty: null, workItem: null };
  for (const col of columns) {
    const l = String(col.label || "").toLowerCase().trim();
    if (roles.slno === null && (l === "#" || /sl\.?\s*no|sr\.?\s*no|s\.?\s*no|serial|^index$/.test(l))) { roles.slno = col.id; continue; }
    if (roles.amount === null && /amount|total|cost|value/.test(l)) { roles.amount = col.id; continue; }
    if (roles.rate === null && /rate|price/.test(l)) { roles.rate = col.id; continue; }
    if (roles.unit === null && (l === "unit" || /uom/.test(l))) { roles.unit = col.id; continue; }
    if (roles.qty === null && /qty|quantity|\bnos\b|\bnumber\b/.test(l)) { roles.qty = col.id; continue; }
    if (roles.workItem === null && /work|item|desc|particular|service|scope|task|name/.test(l)) { roles.workItem = col.id; continue; }
  }
  // Fallback: first unassigned text column becomes the work-item column.
  if (roles.workItem === null) {
    const assigned = new Set(Object.values(roles).filter(Boolean));
    const firstText = columns.find((c) => c.type === "text" && !assigned.has(c.id))
      || columns.find((c) => !assigned.has(c.id));
    if (firstText) roles.workItem = firstText.id;
  }
  return roles;
}

/**
 * Build table rows from semantic line items. Each item is either:
 *   { section: "Bathroom" }                       → a group-header row
 *   { workItem, qty?, rate?, unit? }              → a data row
 * Sl.No auto-increments from `startIndex` across data rows; Amount = qty*rate
 * when both are numeric. Values are written only into columns whose role is
 * detected; everything else is left blank.
 *
 * @returns {{ rows, roles, dataCount, sectionCount, nextIndex, totalAmount } | { error }}
 */
function buildRowsFromLineItems(columns, lineItems, startIndex = 1) {
  if (!columns || !columns.length) return { error: "Template has no columns." };
  const roles = detectColumnRoles(columns);
  const firstColId = columns[0].id;

  const rows = [];
  let n = startIndex;
  let dataCount = 0;
  let sectionCount = 0;
  let totalAmount = 0;

  const items = Array.isArray(lineItems) ? lineItems : [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    const isSection = typeof it.section === "string" && it.section.trim();

    if (isSection) {
      sectionCount += 1;
      rows.push({ id: shortId(), isGroupHeader: true, cells: { [firstColId]: it.section.trim() } });
      continue;
    }

    const workItem = String(it.workItem ?? it.item ?? it.description ?? "").trim();
    const qty = it.qty != null ? Number(it.qty) : null;
    const rate = it.rate != null ? Number(it.rate) : null;
    if (!workItem) {
      return { error: `Line item ${i + 1} needs a workItem (or use 'section' for a header row).` };
    }
    const amount = (qty != null && rate != null && !Number.isNaN(qty) && !Number.isNaN(rate)) ? qty * rate : null;
    if (amount != null) totalAmount += amount;

    const cells = {};
    for (const col of columns) cells[col.id] = "";
    if (roles.slno) cells[roles.slno] = String(n);
    if (roles.workItem) cells[roles.workItem] = workItem;
    if (roles.qty && qty != null && !Number.isNaN(qty)) cells[roles.qty] = String(qty);
    if (roles.rate && rate != null && !Number.isNaN(rate)) cells[roles.rate] = String(rate);
    if (roles.unit && it.unit) cells[roles.unit] = String(it.unit).trim();
    if (roles.amount && amount != null) cells[roles.amount] = String(amount);

    rows.push({ id: shortId(), isGroupHeader: false, cells });
    n += 1;
    dataCount += 1;
  }

  return { rows, roles, dataCount, sectionCount, nextIndex: n, totalAmount };
}

// Count existing data (non group-header) rows — used to continue Sl.No numbering
// when appending to a template.
function countDataRows(structure) {
  return (structure?.rows || []).filter((r) => !r.isGroupHeader).length;
}

module.exports = {
  COL_TYPES,
  DEFAULT_COLUMNS,
  shortId,
  buildColumns,
  detectColumnRoles,
  buildRowsFromLineItems,
  countDataRows,
};
