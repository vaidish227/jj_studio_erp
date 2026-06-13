// Write tool: author a NEW Proposal as a DRAFT (or submit it for approval) WITHOUT
// sending anything to the client. This is the AI equivalent of the dashboard's
// "Save Draft" / "Save & Send for Approval" on CreateProposalPage — distinct from
// createAndSendProposal, which jumps straight to manager_approved → sent.
//
// Three authoring paths (pick one):
//   • Multi-section: pass `sections` = [{ title, lineItems:[{description, amount}] }]
//   • Single custom: pass `customTitle` + `customLineItems` = [{description, amount}]
//   • Template lump-sum: pass `templateName`/`templateId` + `totalAmount`
//
// On apply the proposal is created at status "draft" (default) or "pending_approval"
// (submitForApproval=true), linked to the CRMClient, and — when submitting — the
// lead's stage is set to "interested" (mirrors Proposal.controller.js createProposal).

const mongoose = require("mongoose");
const Proposal = require("../../crm/models/Proposal.model");
const Template = require("../../proposal/models/Template.model");
const CRMClient = require("../../crm/models/CRMClient.model");
const { dispatch: notify } = require("../../notifications/services/notificationDispatcher");
const { resolveLead } = require("../utils/resolveCrm");

const WIDER_PERMS = ["*", "crm.update"];
const DEFAULT_GST_PERCENT = 18;
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// Same 3-column section shape as createAndSendProposal / updateProposal so the
// labels carry the "work item" / "amount" keywords the email/PDF renderer sniffs.
const SECTION_COLUMNS = [
  { id: "c_slno", label: "Sl.No",      type: "label",  width: "50px" },
  { id: "c_desc", label: "Work Item",  type: "text",   width: "70%" },
  { id: "c_amt",  label: "Amount (₹)", type: "number", width: "30%" },
];

function buildSection(title, lineItems) {
  return {
    title,
    structure: {
      columns: SECTION_COLUMNS,
      rows: lineItems.map((it, i) => ({
        id: `r_${i + 1}`,
        isGroupHeader: false,
        cells: { c_slno: i + 1, c_desc: it.description, c_amt: Number(it.amount) || 0 },
      })),
    },
  };
}

// Normalize + validate a [{description, amount}] list. Returns { items } | { error }.
function normalizeLineItems(raw, label) {
  const items = (raw || []).map((it) => ({
    description: String(it.description || it.name || it.workItem || "").trim(),
    amount: Number(it.amount) || 0,
  }));
  if (items.length === 0) return { error: `${label} needs at least one line item.` };
  if (items.some((it) => !it.description || it.amount <= 0)) {
    return { error: `Every line item in ${label} needs a non-empty description and a positive amount.` };
  }
  return { items };
}

async function resolveTemplate({ templateId, templateName }) {
  if (templateId) {
    if (!mongoose.isValidObjectId(templateId)) return { error: `Invalid templateId: ${templateId}` };
    const doc = await Template.findById(templateId).lean();
    return doc ? { doc } : { error: `No template with id ${templateId}.` };
  }
  if (templateName) {
    const exact = await Template.findOne({ name: new RegExp(`^${escapeRegex(templateName)}$`, "i") }).lean();
    if (exact) return { doc: exact };
    const candidates = await Template.find({ name: new RegExp(escapeRegex(templateName), "i") }).select("name").lean();
    if (candidates.length === 1) return { doc: await Template.findById(candidates[0]._id).lean() };
    if (candidates.length > 1) {
      return { error: `Ambiguous template "${templateName}". Matches: ${candidates.map((c) => c.name).join(", ")}.` };
    }
    return { error: `No template matches "${templateName}". Use listProposalTemplates to see options.` };
  }
  return { error: "No templateId or templateName provided." };
}

// Resolve the lead, authorize, pick the authoring path, and compute the
// sections + pricing. Returns { lead, title, sections, subtotal, gst, gstPercent,
// finalAmount, templateId } | { error }.
async function loadAndAuthorize(args, ctx) {
  const r = await resolveLead(args.leadId);
  if (r.error) {
    return { error: { ok: false, error: r.candidates ? "ambiguous" : "not_found", uiHint: "error", summaryText: r.error } };
  }
  const lead = r.doc;
  const isOwner = String(lead.assignedTo || "") === String(ctx.userId);
  const elevated = (ctx.permissions || []).some((p) => WIDER_PERMS.includes(p));
  if (!isOwner && !elevated) {
    return { error: { ok: false, error: "denied", uiHint: "error",
      summaryText: "Only the assigned salesperson (or admin) can create proposals for this lead." } };
  }

  const hasSections = Array.isArray(args.sections) && args.sections.length > 0;
  const hasCustom = !!(args.customTitle && Array.isArray(args.customLineItems) && args.customLineItems.length > 0);
  const hasTemplate = !!(args.templateId || args.templateName);
  // Plain lump-sum: a single total amount (+ optional title), no breakdown — only
  // when no richer content path was supplied. Lets "a proposal for ₹5L advisory"
  // work directly as a one-line quotation.
  const hasLumpSum = !hasSections && !hasCustom && !hasTemplate
    && typeof args.totalAmount === "number" && args.totalAmount > 0;
  const pathCount = [hasSections, hasCustom, hasTemplate, hasLumpSum].filter(Boolean).length;

  if (pathCount === 0) {
    return { error: { ok: false, error: "invalid_args", uiHint: "error",
      summaryText: "I need to know what this proposal should quote. Tell me the line items and their amounts (e.g. \"Advisory Services — ₹5,00,000\"), or a single total amount with a short title, or the name of an existing template to use." } };
  }
  if (pathCount > 1) {
    return { error: { ok: false, error: "invalid_args", uiHint: "error",
      summaryText: "Please give the proposal content in just one form — line items, a single total amount, or a template — not several at once." } };
  }

  let title;
  let sections = [];
  let subtotal = 0;
  let templateId;

  if (hasSections) {
    for (let i = 0; i < args.sections.length; i++) {
      const sec = args.sections[i] || {};
      const secTitle = String(sec.title || "").trim();
      if (!secTitle) {
        return { error: { ok: false, error: "invalid_args", uiHint: "error", summaryText: `Section ${i + 1} needs a title.` } };
      }
      const norm = normalizeLineItems(sec.lineItems, `section "${secTitle}"`);
      if (norm.error) return { error: { ok: false, error: "invalid_args", uiHint: "error", summaryText: norm.error } };
      sections.push(buildSection(secTitle, norm.items));
      subtotal += norm.items.reduce((s, it) => s + it.amount, 0);
    }
    title = (args.title || "").trim() || `Proposal — ${lead.name}`;
  } else if (hasCustom) {
    const norm = normalizeLineItems(args.customLineItems, "the line items");
    if (norm.error) return { error: { ok: false, error: "invalid_args", uiHint: "error", summaryText: norm.error } };
    title = args.customTitle.trim();
    sections = [buildSection(title, norm.items)];
    subtotal = norm.items.reduce((s, it) => s + it.amount, 0);
  } else if (hasTemplate) {
    // Template lump-sum path.
    const t = await resolveTemplate(args);
    if (t.error) return { error: { ok: false, error: "not_found", uiHint: "error", summaryText: t.error } };
    if (typeof args.totalAmount !== "number" || args.totalAmount <= 0) {
      return { error: { ok: false, error: "invalid_args", uiHint: "error",
        summaryText: "I need the amount for this proposal — what's the total value (before GST)?" } };
    }
    templateId = t.doc._id;
    title = (args.title || "").trim() || `${t.doc.name} — ${lead.name}`;
    sections = [buildSection(title, [{ description: t.doc.name, amount: args.totalAmount }])];
    subtotal = args.totalAmount;
  } else {
    // Plain lump-sum path — one line item, no template, no breakdown.
    const label = (args.title || "").trim() || "Professional Services";
    title = label;
    sections = [buildSection(label, [{ description: label, amount: args.totalAmount }])];
    subtotal = args.totalAmount;
  }

  const gstPercent = typeof args.gstPercent === "number" ? args.gstPercent : DEFAULT_GST_PERCENT;
  const gst = Math.round(subtotal * gstPercent) / 100;
  const finalAmount = subtotal + gst;

  return { lead, title, sections, subtotal, gst, gstPercent, finalAmount, templateId };
}

function sectionSummary(sections) {
  const dataRows = sections.reduce((n, s) => n + (s.structure?.rows || []).filter((r) => !r.isGroupHeader).length, 0);
  return sections.length > 1
    ? `${sections.length} sections, ${dataRows} line item${dataRows === 1 ? "" : "s"}`
    : `${dataRows} line item${dataRows === 1 ? "" : "s"}`;
}

module.exports = {
  name: "createProposalDraft",
  permission: "crm.update",
  isWrite: true,
  description:
    "Create a NEW proposal as a DRAFT (or submit it for manager approval) WITHOUT sending anything to the client. Use for 'draft a proposal for X', 'create a proposal but don't send it yet', 'prepare a quotation for approval'. This is the SAVE-DRAFT path — to create AND immediately send to the client, use createAndSendProposal instead. Four content paths (pick one): (1) sections — multi-section quotation, each {title, lineItems:[{description, amount}]}; (2) customTitle + customLineItems — single-section quotation; (3) templateName/templateId + totalAmount — single lump-sum from a template; (4) title + totalAmount with NO template — a plain one-line proposal (use this when the user gives just an amount and a label, e.g. 'a proposal for ₹5,00,000 advisory' → title 'Advisory Services', totalAmount 500000). Default GST is 18%. By default the proposal is saved as 'draft'; pass submitForApproval=true to save it as 'pending_approval' (which also marks the lead 'interested'). Pass leadId as ObjectId, trackingId, or name fragment.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      leadId: {
        type: "string",
        description: "Lead/client identifier — ObjectId, trackingId (CLI-YYYY-NNNN), or an unambiguous name fragment.",
        minLength: 2,
        maxLength: 100,
      },
      title: {
        type: "string",
        description: "Proposal title. Optional for the sections/template paths (a sensible default is built); ignored for the custom path where customTitle is the title.",
        minLength: 2,
        maxLength: 200,
      },
      // Path 1 — multi-section
      sections: {
        type: "array",
        description: "Multi-section quotation content. Each entry: {title, lineItems:[{description, amount}]} where amount is in rupees before GST. Subtotal = sum of all line items across all sections.",
        minItems: 1,
        maxItems: 20,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string", minLength: 1, maxLength: 200, description: "Section heading, e.g. 'Civil Work', 'Electrical'." },
            lineItems: {
              type: "array",
              minItems: 1,
              maxItems: 50,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  description: { type: "string", minLength: 1, maxLength: 300 },
                  amount: { type: "number", exclusiveMinimum: 0 },
                },
                required: ["description", "amount"],
              },
            },
          },
          required: ["title", "lineItems"],
        },
      },
      // Path 2 — single custom section
      customTitle: {
        type: "string",
        description: "Title for a single-section custom quotation. Required if using customLineItems.",
        minLength: 2,
        maxLength: 200,
      },
      customLineItems: {
        type: "array",
        description: "Line items for a single-section custom quotation. Each: {description, amount}. Subtotal = sum of amounts.",
        minItems: 1,
        maxItems: 50,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            description: { type: "string", minLength: 1, maxLength: 300 },
            amount: { type: "number", exclusiveMinimum: 0 },
          },
          required: ["description", "amount"],
        },
      },
      // Path 3 — template lump-sum
      templateId: { type: "string", description: "Template ObjectId for the lump-sum path. Alternative: templateName.", minLength: 24, maxLength: 24 },
      templateName: { type: "string", description: "Template name (case-insensitive) for the lump-sum path, e.g. 'Civil Work'.", minLength: 2, maxLength: 100 },
      totalAmount: { type: "number", description: "Single lump-sum amount in rupees, before GST. Use WITH a template, OR on its own (with an optional title) to create a plain one-line proposal — e.g. totalAmount 500000 + title 'Advisory Services'.", exclusiveMinimum: 0 },
      // Common
      gstPercent: { type: "number", minimum: 0, maximum: 100, description: "GST % on the subtotal. Defaults to 18." },
      submitForApproval: { type: "boolean", description: "If true, save as 'pending_approval' (submitted for manager review) and mark the lead 'interested'. If false/omitted, save as 'draft'." },
    },
    required: ["leadId"],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;

    const targetStatus = args.submitForApproval ? "pending_approval" : "draft";
    const verb = args.submitForApproval ? "Create + submit for approval" : "Save draft";

    return {
      ok: true,
      proposalDescription:
        `${verb}: proposal "${r.title}" for "${r.lead.name}" (${r.lead.trackingId}) — ${sectionSummary(r.sections)}, ` +
        `subtotal ${inr(r.subtotal)}, GST ${r.gstPercent}% ${inr(r.gst)}, final ${inr(r.finalAmount)}. ` +
        `Saved as "${targetStatus}" — the client is NOT contacted.`,
      args,
      preview: {
        leadName: r.lead.name,
        leadTrackingId: r.lead.trackingId,
        title: r.title,
        targetStatus,
        sectionCount: r.sections.length,
        sections: r.sections.map((s) => ({
          title: s.title,
          lineItems: (s.structure.rows || [])
            .filter((row) => !row.isGroupHeader)
            .map((row) => ({ description: row.cells.c_desc, amount: row.cells.c_amt })),
        })),
        subtotal: r.subtotal,
        gstPercent: r.gstPercent,
        gst: r.gst,
        finalAmount: r.finalAmount,
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;

    const targetStatus = args.submitForApproval ? "pending_approval" : "draft";
    const now = new Date();

    const proposal = await Proposal.create({
      leadId: r.lead._id,
      templateId: r.templateId || undefined,
      title: r.title,
      content: { sections: r.sections },
      subtotal: r.subtotal,
      gst: r.gst,
      totalAmount: r.subtotal,
      finalAmount: r.finalAmount,
      status: targetStatus,
      createdBy: ctx.userId,
      approvalHistory: [
        { action: "created", performedBy: ctx.userId, remarks: "Drafted via AI assistant", timestamp: now },
        ...(args.submitForApproval
          ? [{ action: "pending_approval", performedBy: ctx.userId, remarks: "Submitted for approval via AI assistant", timestamp: now }]
          : []),
      ],
    });

    // Link to the CRMClient (mirrors createProposal controller).
    await CRMClient.findByIdAndUpdate(r.lead._id, { $addToSet: { linkedProposals: proposal._id } });

    // Submitting for approval marks the lead interested (mirrors controller).
    if (args.submitForApproval) {
      await CRMClient.findByIdAndUpdate(r.lead._id, { status: "interested", lifecycleStage: "interested" });
    }

    if (args.submitForApproval) {
      notify({
        type: "proposal.created",
        module: "proposal",
        priority: "normal",
        title: `Proposal submitted for approval: ${r.title}`,
        message: `For ${r.lead.name} — ${inr(r.finalAmount)} (via AI assistant).`,
        link: `/proposal/review/${proposal._id}`,
        actor: { _id: ctx.userId, name: ctx.userName || "AI Assistant" },
        notifyActor: true,
        relatedTo: { module: "proposal", recordId: proposal._id },
        metadata: { leadName: r.lead.name, finalAmount: r.finalAmount, viaAI: true },
      });
    }

    return {
      ok: true,
      summaryText:
        `${args.submitForApproval ? "Submitted" : "Saved draft"} proposal "${r.title}" for ${r.lead.name} ` +
        `(${inr(r.finalAmount)}, status "${targetStatus}"). The client has NOT been contacted` +
        `${args.submitForApproval ? " — it's now awaiting manager approval." : " — edit or submit it when ready."}`,
      uiHint: "actionDone",
      data: {
        proposalId: String(proposal._id),
        leadId: String(r.lead._id),
        leadName: r.lead.name,
        title: r.title,
        status: targetStatus,
        subtotal: r.subtotal,
        gst: r.gst,
        finalAmount: r.finalAmount,
        url: `/proposal/review/${proposal._id}`,
      },
    };
  },
};
