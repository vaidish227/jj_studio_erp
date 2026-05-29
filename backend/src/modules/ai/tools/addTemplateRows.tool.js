// Write tool: add (or replace) rows on an EXISTING quotation Template — fills
// the line items into a template's current columns. Complements
// createProposalTemplate (which creates the layout). Uses the same semantic
// line-item format and auto Sl.No + Amount; maps into whatever columns the
// template already has.

const mongoose = require("mongoose");
const Template = require("../../proposal/models/Template.model");
const { buildRowsFromLineItems, countDataRows } = require("../utils/quotationTemplate");

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// Resolve a template by ObjectId or (case-insensitive) name. Returns
// { doc } | { error, candidates? }.
async function resolveTemplate({ templateId, templateName }) {
  if (templateId) {
    const s = String(templateId).trim();
    if (!mongoose.isValidObjectId(s) || s.length !== 24) return { error: `"${s}" is not a valid template id.` };
    const doc = await Template.findById(s);
    return doc ? { doc } : { error: `No template with id ${s}.` };
  }
  if (templateName) {
    const exact = await Template.findOne({ name: new RegExp(`^${escapeRegex(templateName.trim())}$`, "i") });
    if (exact) return { doc: exact };
    const fuzzy = await Template.find({ name: new RegExp(escapeRegex(templateName.trim()), "i") }).select("name").lean();
    if (fuzzy.length === 1) return { doc: await Template.findById(fuzzy[0]._id) };
    if (fuzzy.length > 1) {
      return { error: `Ambiguous template "${templateName}". Matches: ${fuzzy.map((t) => t.name).join(", ")}. Be more specific.`, candidates: fuzzy };
    }
    return { error: `No template matches "${templateName}". Use listProposalTemplates to see options.` };
  }
  return { error: "Provide a templateId or templateName." };
}

async function loadAndBuild(args) {
  if (!args.templateId && !args.templateName) {
    return { error: { ok: false, error: "invalid_args", uiHint: "error", summaryText: "Provide a templateId or templateName." } };
  }
  const r = await resolveTemplate(args);
  if (r.error) {
    return { error: { ok: false, error: r.candidates ? "ambiguous" : "not_found", uiHint: "error", summaryText: r.error } };
  }
  const tpl = r.doc;
  const columns = tpl.structure?.columns || [];
  if (!columns.length) {
    return { error: { ok: false, error: "invalid_state", uiHint: "error",
      summaryText: `Template "${tpl.name}" has no columns yet — recreate it with createProposalTemplate (columns are required before rows).` } };
  }
  if (!Array.isArray(args.lineItems) || args.lineItems.length === 0) {
    return { error: { ok: false, error: "invalid_args", uiHint: "error", summaryText: "Provide at least one lineItem to add." } };
  }

  const replace = args.mode === "replace";
  const existingDataRows = replace ? 0 : countDataRows(tpl.structure);
  const built = buildRowsFromLineItems(columns, args.lineItems, existingDataRows + 1);
  if (built.error) {
    return { error: { ok: false, error: "invalid_args", uiHint: "error", summaryText: built.error } };
  }

  const existingRows = replace ? [] : (tpl.structure?.rows || []);
  const nextRows = [...existingRows, ...built.rows];
  return { tpl, columns, built, replace, nextRows };
}

module.exports = {
  name: "addTemplateRows",
  permission: "proposal.update",
  isWrite: true,
  description:
    "Add line items (rows) to an EXISTING quotation template, or replace all its rows. Use for 'add these items to the Plumbing Quotation template', 'fill the rows in template X', 'replace the items in the Civil template'. Identify the template by templateId or templateName. lineItems use the same format as createProposalTemplate: data rows {workItem, qty, rate, unit} or section headers {section:'Bathroom'}; Sl.No continues from the existing rows and Amount (=qty×rate) is computed for you. mode='append' (default) keeps existing rows; mode='replace' overwrites all rows. To create a brand-new template use createProposalTemplate instead.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      templateId: { type: "string", description: "Template ObjectId (24 hex). Preferred when known.", minLength: 24, maxLength: 24 },
      templateName: { type: "string", description: "Template name (case-insensitive), e.g. 'Plumbing Quotation'. Used if templateId is omitted.", minLength: 2, maxLength: 120 },
      lineItems: {
        type: "array",
        description: "Rows to add. Each entry is EITHER a section header {section:'Bathroom'} OR a data row {workItem:'Sink fitting', qty:2, rate:5000, unit:'nos'}. Sl.No and Amount are computed for you.",
        minItems: 1,
        maxItems: 100,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            section: { type: "string", maxLength: 120, description: "Makes this entry a SECTION HEADER row." },
            workItem: { type: "string", maxLength: 300, description: "Description of the work/item (for a data row)." },
            qty: { type: "number", minimum: 0 },
            rate: { type: "number", minimum: 0, description: "Unit rate in rupees." },
            unit: { type: "string", maxLength: 20, description: "Unit of measure, e.g. nos, sqft, rft." },
          },
        },
      },
      mode: { type: "string", enum: ["append", "replace"], description: "append (default) adds to existing rows; replace overwrites ALL rows." },
    },
    required: ["lineItems"],
  },

  async dryRun(args, ctx) { // eslint-disable-line no-unused-vars
    const r = await loadAndBuild(args);
    if (r.error) return r.error;

    const action = r.replace ? "Replace all rows of" : "Add to";
    const totalNote = r.built.totalAmount ? `, total ${inr(r.built.totalAmount)}` : "";
    const secNote = r.built.sectionCount ? ` + ${r.built.sectionCount} section header${r.built.sectionCount === 1 ? "" : "s"}` : "";

    return {
      ok: true,
      proposalDescription:
        `${action} template "${r.tpl.name}": ${r.built.dataCount} line item${r.built.dataCount === 1 ? "" : "s"}${secNote}${totalNote}.`,
      args,
      preview: {
        templateId: String(r.tpl._id),
        templateName: r.tpl.name,
        mode: r.replace ? "replace" : "append",
        addedDataRows: r.built.dataCount,
        addedSections: r.built.sectionCount,
        totalAmount: r.built.totalAmount,
        resultingRowCount: r.nextRows.length,
      },
    };
  },

  async apply(args, ctx) { // eslint-disable-line no-unused-vars
    const r = await loadAndBuild(args);
    if (r.error) return r.error;

    await Template.findByIdAndUpdate(r.tpl._id, {
      $set: { "structure.rows": r.nextRows },
    });

    return {
      ok: true,
      summaryText:
        `${r.replace ? "Replaced rows on" : "Added"} ${r.built.dataCount} line item${r.built.dataCount === 1 ? "" : "s"} ` +
        `${r.replace ? "in" : "to"} template "${r.tpl.name}"` +
        (r.built.totalAmount ? ` (total ${inr(r.built.totalAmount)})` : "") + ".",
      uiHint: "actionDone",
      data: {
        templateId: String(r.tpl._id),
        name: r.tpl.name,
        addedDataRows: r.built.dataCount,
        rowCount: r.nextRows.length,
        totalAmount: r.built.totalAmount,
        url: "/proposal/templates",
      },
    };
  },
};
