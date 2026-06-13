// Write tool: create a reusable quotation/proposal Template. Mirrors the
// "Create New Template" screen (TemplateEditorPage + DynamicTableBuilder).
//
// The DB stores a dynamic table whose cells are keyed by generated column ids.
// The model can't be trusted to author that id-keyed shape, so this tool accepts
// a FRIENDLY format and builds the real structure via utils/quotationTemplate:
//   columns:   [{ label, type }]                       (optional; default layout if omitted)
//   lineItems: [{ workItem, qty, rate, unit }]         data rows (Sl.No + Amount auto-filled)
//              | [{ section: "Bathroom" }]             section-header rows
// Amount = qty * rate, Sl.No auto-increments — the model never computes them.

const Template = require("../../proposal/models/Template.model");
const { buildColumns, buildRowsFromLineItems } = require("../utils/quotationTemplate");

const TYPES = ["residential", "commercial"];
const COL_TYPES = ["text", "number", "label"];
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

module.exports = {
  name: "createProposalTemplate",
  permission: "proposal.create",
  isWrite: true,
  description:
    "Create a reusable quotation/proposal TEMPLATE (the table layout used when authoring proposals), optionally pre-filled with line items. Use for 'create a quotation template', 'make a plumbing template with these items'. Provide name + type (residential/commercial). Optionally define columns ([{label,type}], type=text/number/label) — omit for the standard layout: Sl.No, Work Item, Qty, Rate, Amount. Optionally provide lineItems: each is a data row {workItem, qty, rate, unit} OR a section header {section:'Bathroom'}. Sl.No and Amount (=qty×rate) are filled automatically — do NOT compute them yourself. This creates a TEMPLATE, not a client proposal (use createAndSendProposal for that). To add rows to an EXISTING template, use addTemplateRows.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 2, maxLength: 120, description: "Template name, e.g. 'Plumbing Quotation'. Only use what the user stated." },
      type: { type: "string", enum: TYPES, description: "Project type this template is for." },
      description: { type: "string", maxLength: 500, description: "Optional description of what the template is used for." },
      columns: {
        type: "array",
        description: "Optional column definitions. Each: {label, type} where type is text/number/label (default text; use 'label' for Sl.No, 'number' for Qty/Rate/Amount). Omit to use the standard Sl.No/Work Item/Qty/Rate/Amount layout.",
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: { type: "string", minLength: 1, maxLength: 60 },
            type: { type: "string", enum: COL_TYPES },
          },
          required: ["label"],
        },
      },
      lineItems: {
        type: "array",
        description: "Optional rows. Each entry is EITHER a section header {section:'Bathroom'} OR a data row {workItem:'Sink fitting', qty:2, rate:5000, unit:'nos'}. Sl.No and Amount (qty×rate) are computed for you. A template may have no rows.",
        maxItems: 100,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            section: { type: "string", maxLength: 120, description: "Makes this entry a SECTION HEADER row, not a line item." },
            workItem: { type: "string", maxLength: 300, description: "Description of the work/item (for a data row)." },
            qty: { type: "number", minimum: 0, description: "Quantity." },
            rate: { type: "number", minimum: 0, description: "Unit rate in rupees." },
            unit: { type: "string", maxLength: 20, description: "Unit of measure, e.g. nos, sqft, rft." },
          },
        },
      },
    },
    required: ["name", "type"],
  },

  async dryRun(args, ctx) { // eslint-disable-line no-unused-vars
    const colsBuilt = buildColumns(args.columns);
    if (colsBuilt.error) return { ok: false, error: "invalid_args", uiHint: "error", summaryText: colsBuilt.error };

    const rowsBuilt = buildRowsFromLineItems(colsBuilt.columns, args.lineItems, 1);
    if (rowsBuilt.error) return { ok: false, error: "invalid_args", uiHint: "error", summaryText: rowsBuilt.error };

    const existing = await Template.findOne({
      name: new RegExp(`^${escapeRegex(args.name.trim())}$`, "i"),
    }).select("_id").lean();
    const dupNote = existing ? " (NOTE: a template with this name already exists — this creates another.)" : "";

    const colsDesc = colsBuilt.columns.map((c) => c.label).join(", ") + (colsBuilt.usedDefault ? " (default layout)" : "");
    const rowDesc = rowsBuilt.dataCount
      ? `${rowsBuilt.dataCount} line item${rowsBuilt.dataCount === 1 ? "" : "s"}` +
        (rowsBuilt.sectionCount ? ` in ${rowsBuilt.sectionCount} section${rowsBuilt.sectionCount === 1 ? "" : "s"}` : "") +
        (rowsBuilt.totalAmount ? `, total ${inr(rowsBuilt.totalAmount)}` : "")
      : "no rows";

    return {
      ok: true,
      proposalDescription:
        `Create ${args.type} template "${args.name.trim()}" — columns: ${colsDesc}; ${rowDesc}.${dupNote}`,
      args,
      preview: {
        name: args.name.trim(),
        type: args.type,
        description: args.description || null,
        columns: colsBuilt.columns.map((c) => c.label),
        dataRows: rowsBuilt.dataCount,
        sections: rowsBuilt.sectionCount,
        totalAmount: rowsBuilt.totalAmount,
        duplicateName: !!existing,
      },
    };
  },

  async apply(args, ctx) {
    const colsBuilt = buildColumns(args.columns);
    if (colsBuilt.error) return { ok: false, error: "invalid_args", uiHint: "error", summaryText: colsBuilt.error };

    const rowsBuilt = buildRowsFromLineItems(colsBuilt.columns, args.lineItems, 1);
    if (rowsBuilt.error) return { ok: false, error: "invalid_args", uiHint: "error", summaryText: rowsBuilt.error };

    const template = await Template.create({
      name: args.name.trim(),
      type: args.type,
      description: args.description || "",
      structure: { columns: colsBuilt.columns, rows: rowsBuilt.rows },
      createdBy: ctx.userId || null,
    });

    return {
      ok: true,
      summaryText:
        `Created ${args.type} template "${template.name}" with ${colsBuilt.columns.length} columns` +
        (rowsBuilt.dataCount ? ` and ${rowsBuilt.dataCount} line item${rowsBuilt.dataCount === 1 ? "" : "s"}` : " (no rows yet)") + ".",
      uiHint: "actionDone",
      data: {
        templateId: String(template._id),
        name: template.name,
        type: template.type,
        columns: colsBuilt.columns.map((c) => c.label),
        dataRows: rowsBuilt.dataCount,
        totalAmount: rowsBuilt.totalAmount,
        url: "/proposal/templates",
      },
    };
  },
};
