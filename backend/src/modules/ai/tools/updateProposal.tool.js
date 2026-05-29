// Write tool: edit an existing proposal's content — title, description, notes,
// and the quotation line items (which recompute subtotal/GST/final). ONLY
// editable while the proposal is a draft or has revisions requested; an
// already-approved/sent proposal must go through updateProposalStatus or a new
// version in the dashboard. Does NOT change status and does NOT send anything.

const Proposal = require("../../crm/models/Proposal.model");
const { resolveProposal } = require("../utils/resolveCrm");

const WIDER_PERMS = ["*", "crm.update"];
const DEFAULT_GST_PERCENT = 18;
const EDITABLE_STATUSES = new Set(["draft", "revision_requested"]);

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// Same 3-column section shape as createAndSendProposal so the labels carry the
// "work item" / "amount" keywords that the email/PDF renderer sniffs for.
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

async function loadAndAuthorize(args, ctx) {
  if (!args.proposalId && !args.leadId) {
    return { error: { ok: false, error: "invalid_args", uiHint: "error",
      summaryText: "Provide a proposalId or a leadId to identify the proposal." } };
  }
  const r = await resolveProposal({ proposalId: args.proposalId, leadId: args.leadId });
  if (r.error) {
    return { error: { ok: false, error: r.candidates ? "ambiguous" : "not_found", summaryText: r.error, uiHint: "error" } };
  }
  const proposal = r.doc;
  const lead = r.lead || proposal.leadId;

  const isOwner = lead && String(lead.assignedTo || "") === String(ctx.userId);
  const elevated = (ctx.permissions || []).some((p) => WIDER_PERMS.includes(p));
  if (!isOwner && !elevated) {
    return { error: { ok: false, error: "denied", uiHint: "error",
      summaryText: "Only the assigned salesperson (or admin) can edit this proposal." } };
  }

  if (!EDITABLE_STATUSES.has(proposal.status)) {
    return { error: { ok: false, error: "invalid_state", uiHint: "error",
      summaryText: `Proposal "${proposal.title}" is "${proposal.status}" — only draft or revision-requested proposals can be edited here. To change a sent/approved proposal, use updateProposalStatus or create a new version in the proposal dashboard.` } };
  }

  return { proposal, lead };
}

// Build the $set patch + a human description of what changes.
function buildChanges(args, proposal) {
  const set = {};
  const desc = [];

  if (typeof args.title === "string" && args.title.trim() && args.title.trim() !== proposal.title) {
    set.title = args.title.trim();
    desc.push(`title → "${set.title}"`);
  }
  if (typeof args.description === "string" && args.description !== proposal.description) {
    set.description = args.description;
    desc.push("description updated");
  }
  if (typeof args.notes === "string" && args.notes !== proposal.notes) {
    set.notes = args.notes;
    desc.push("notes updated");
  }

  if (Array.isArray(args.lineItems) && args.lineItems.length > 0) {
    const items = args.lineItems.map((it) => ({
      description: String(it.description || it.name || "").trim(),
      amount: Number(it.amount) || 0,
    }));
    if (items.some((it) => !it.description || it.amount <= 0)) {
      return { error: "Every line item needs a non-empty description and a positive amount." };
    }
    const subtotal = items.reduce((s, it) => s + it.amount, 0);
    const gstPercent = typeof args.gstPercent === "number" ? args.gstPercent : DEFAULT_GST_PERCENT;
    const gst = Math.round(subtotal * gstPercent) / 100;
    const finalAmount = subtotal + gst;

    const sectionTitle = set.title || proposal.title || "Quotation";
    set.content = { sections: [buildSection(sectionTitle, items)] };
    set.subtotal = subtotal;
    set.totalAmount = subtotal;
    set.gst = gst;
    set.finalAmount = finalAmount;
    desc.push(
      `${items.length} line item${items.length === 1 ? "" : "s"}, subtotal ${inr(subtotal)}, ` +
      `GST ${gstPercent}% ${inr(gst)}, final ${inr(finalAmount)}`
    );
  }

  return { set, desc };
}

module.exports = {
  name: "updateProposal",
  permission: "crm.update",
  isWrite: true,
  description:
    "Edit an existing proposal's CONTENT — title, description, notes, and/or the quotation line items (which recompute subtotal, GST and final amount). Use for 'change the proposal title', 'update the quotation for Ratan Tata to these items', 'fix the amounts on the draft'. ONLY works while the proposal is a draft or has revisions requested. Does NOT change status (use updateProposalStatus) and does NOT send anything. Pass proposalId, or leadId (name/trackingId) to resolve the lead's proposal.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      proposalId: {
        type: "string",
        description: "Proposal ObjectId (24 hex). Preferred when known.",
        minLength: 24,
        maxLength: 24,
      },
      leadId: {
        type: "string",
        description: "Lead/client identifier (ObjectId, trackingId, or name fragment) to resolve the proposal. Used only if proposalId is omitted.",
        minLength: 2,
        maxLength: 100,
      },
      title: { type: "string", minLength: 2, maxLength: 200, description: "New proposal title. Only pass if the user gave one." },
      description: { type: "string", maxLength: 2000, description: "New description text." },
      notes: { type: "string", maxLength: 2000, description: "Internal notes on the proposal." },
      lineItems: {
        type: "array",
        description: "Replacement quotation line items. Each: {description, amount} (amount in rupees, before GST). Subtotal = sum of amounts; GST and final are recomputed. Replaces ALL existing items.",
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
      gstPercent: { type: "number", minimum: 0, maximum: 100, description: "GST % applied to the line-item subtotal. Defaults to 18. Only used when lineItems is provided." },
    },
    required: [],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;

    const c = buildChanges(args, r.proposal);
    if (c.error) return { ok: false, error: "invalid_args", uiHint: "error", summaryText: c.error };
    if (Object.keys(c.set).length === 0) {
      return { ok: false, error: "no_changes", uiHint: "error",
        summaryText: "No changes — every provided field matches the current proposal (or nothing editable was provided)." };
    }

    return {
      ok: true,
      proposalDescription: `Edit proposal "${r.proposal.title}" — ${c.desc.join("; ")}.`,
      args,
      preview: {
        proposalId: String(r.proposal._id),
        currentTitle: r.proposal.title,
        status: r.proposal.status,
        leadName: r.lead?.name,
        changes: c.desc,
      },
    };
  },

  async apply(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;

    const c = buildChanges(args, r.proposal);
    if (c.error) return { ok: false, error: "invalid_args", uiHint: "error", summaryText: c.error };
    if (Object.keys(c.set).length === 0) {
      return { ok: false, error: "no_changes", uiHint: "error",
        summaryText: "No changes to apply." };
    }

    await Proposal.findByIdAndUpdate(r.proposal._id, {
      $set: c.set,
      $push: {
        approvalHistory: {
          action: "updated",
          performedBy: ctx.userId,
          remarks: "Edited via AI assistant",
          timestamp: new Date(),
        },
      },
    });

    return {
      ok: true,
      summaryText: `Updated proposal "${c.set.title || r.proposal.title}" — ${c.desc.join("; ")}.`,
      uiHint: "actionDone",
      data: {
        proposalId: String(r.proposal._id),
        title: c.set.title || r.proposal.title,
        changedFields: Object.keys(c.set),
        finalAmount: c.set.finalAmount != null ? c.set.finalAmount : r.proposal.finalAmount,
        url: `/proposal/review/${r.proposal._id}`,
      },
    };
  },
};
