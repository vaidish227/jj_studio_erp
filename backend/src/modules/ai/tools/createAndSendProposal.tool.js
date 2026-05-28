// Write tool: create a NEW Proposal for a lead and immediately send it by email.
//
// Two paths:
//   • Template-based:  pass templateId or templateName + totalAmount  → single-row lump-sum section
//   • Custom:          pass customTitle + customLineItems              → multi-row section, subtotal = Σ items
//
// The dryRun → confirm card is the human-in-the-loop check (replaces the
// dashboard's separate manager-approval step). On apply: status goes straight
// to "manager_approved" → triggerSendToClient → "sent" → CRMClient.lifecycleStage
// is synced to "proposal_sent" (mirrors Proposal.controller.js:232).

const mongoose = require("mongoose");
const Proposal = require("../../crm/models/Proposal.model");
const Template = require("../../proposal/models/Template.model");
const CRMClient = require("../../crm/models/CRMClient.model");
const { dispatch: notify } = require("../../notifications/services/notificationDispatcher");
const { triggerSendToClient } = require("../../crm/controllers/Proposal.controller");
const { resolveLead } = require("../utils/resolveCrm");

const WIDER_PERMS = ["*", "crm.update"];
const DEFAULT_GST_PERCENT = 18;

// Build a 3-column section. Labels include the keywords ("work" / "item" / "amount")
// that triggerSendToClient looks for when rendering the email body.
const SECTION_COLUMNS = [
  { id: "c_slno", label: "Sl.No",       type: "label",  width: "50px" },
  { id: "c_desc", label: "Work Item",   type: "text",   width: "70%" },
  { id: "c_amt",  label: "Amount (₹)",  type: "number", width: "30%" },
];

function buildSection(title, lineItems) {
  return {
    title,
    structure: {
      columns: SECTION_COLUMNS,
      rows: lineItems.map((it, i) => ({
        id: `r_${i + 1}`,
        isGroupHeader: false,
        cells: {
          c_slno: i + 1,
          c_desc: it.description,
          c_amt:  Number(it.amount) || 0,
        },
      })),
    },
  };
}

async function resolveTemplate({ templateId, templateName }) {
  if (templateId) {
    if (!mongoose.isValidObjectId(templateId)) return { error: `Invalid templateId: ${templateId}` };
    const doc = await Template.findById(templateId).lean();
    return doc ? { doc } : { error: `No template with id ${templateId}.` };
  }
  if (templateName) {
    const doc = await Template.findOne({ name: new RegExp(`^${escapeRegex(templateName)}$`, "i") }).lean();
    if (doc) return { doc };
    // Fall back to fuzzy contains match
    const candidates = await Template.find({ name: new RegExp(escapeRegex(templateName), "i") })
      .select("name").lean();
    if (candidates.length === 1) {
      const full = await Template.findById(candidates[0]._id).lean();
      return { doc: full };
    }
    if (candidates.length > 1) {
      return { error: `Ambiguous template "${templateName}". Matches: ${candidates.map((c) => c.name).join(", ")}.` };
    }
    return { error: `No template matches "${templateName}". Use listProposalTemplates to see options.` };
  }
  return { error: "No templateId or templateName provided." };
}

function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

async function loadAndAuthorize(args, ctx) {
  const r = await resolveLead(args.leadId);
  if (r.error) {
    return { error: { ok: false, error: r.candidates ? "ambiguous" : "not_found", summaryText: r.error } };
  }
  const lead = r.doc;
  const isOwner = String(lead.assignedTo || "") === String(ctx.userId);
  const elevated = (ctx.permissions || []).some((p) => WIDER_PERMS.includes(p));
  if (!isOwner && !elevated) {
    return { error: { ok: false, error: "denied",
      summaryText: "Only the assigned salesperson (or admin) can create proposals for this lead." } };
  }
  if (!lead.email) {
    return { error: { ok: false, error: "invalid_args",
      summaryText: `Lead "${lead.name}" has no email on file — add one before creating a proposal.` } };
  }

  // Decide the path: template-based OR custom.
  const hasTemplate = !!(args.templateId || args.templateName);
  const hasCustom = !!(args.customTitle && Array.isArray(args.customLineItems) && args.customLineItems.length > 0);

  if (hasTemplate && hasCustom) {
    return { error: { ok: false, error: "invalid_args",
      summaryText: "Provide either a template (templateId/templateName) OR custom content (customTitle + customLineItems), not both." } };
  }
  if (!hasTemplate && !hasCustom) {
    return { error: { ok: false, error: "invalid_args",
      summaryText: "Specify a template (templateId/templateName) OR custom content (customTitle + customLineItems). Use listProposalTemplates to see template options." } };
  }

  let title, lineItems, subtotal;

  if (hasTemplate) {
    const t = await resolveTemplate(args);
    if (t.error) return { error: { ok: false, error: "not_found", summaryText: t.error } };
    if (typeof args.totalAmount !== "number" || args.totalAmount <= 0) {
      return { error: { ok: false, error: "invalid_args",
        summaryText: "totalAmount is required when using a template (single lump-sum value, e.g. 380000)." } };
    }
    title = args.title || `${t.doc.name} — ${lead.name}`;
    lineItems = [{ description: t.doc.name, amount: args.totalAmount }];
    subtotal = args.totalAmount;
  } else {
    // Custom path
    const items = args.customLineItems.map((it) => ({
      description: String(it.description || it.name || "").trim(),
      amount: Number(it.amount) || 0,
    }));
    if (items.some((it) => !it.description || it.amount <= 0)) {
      return { error: { ok: false, error: "invalid_args",
        summaryText: "Every custom line item needs a non-empty description and a positive amount." } };
    }
    title = args.customTitle.trim();
    lineItems = items;
    subtotal = items.reduce((sum, it) => sum + it.amount, 0);
  }

  const gstPercent = typeof args.gstPercent === "number" ? args.gstPercent : DEFAULT_GST_PERCENT;
  const gst = Math.round(subtotal * gstPercent) / 100;
  const finalAmount = subtotal + gst;

  return { lead, title, lineItems, subtotal, gst, gstPercent, finalAmount };
}

module.exports = {
  name: "createAndSendProposal",
  permission: "crm.update",
  isWrite: true,
  description:
    "Create a NEW Proposal for a lead and send it to the client by email in one shot. Use when the user asks to 'send a proposal to X' and no manager-approved proposal exists yet (sendProposal would fail). Two paths: (1) Template — pass templateName (e.g. 'Civil Work') or templateId, plus a single totalAmount lump-sum. (2) Custom — pass customTitle and customLineItems (array of {description, amount}). Default GST is 18% — pass gstPercent to override. The user MUST confirm the preview card before the email goes out. Bypasses the manager-approval step — the chat confirmation IS the approval gate.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      leadId: {
        type: "string",
        description: "Lead identifier — accepts ObjectId, trackingId (CLI-YYYY-NNNN), or an unambiguous name fragment.",
        minLength: 2,
        maxLength: 100,
      },
      // Template path
      templateId: {
        type: "string",
        description: "Proposal template ObjectId. Get from listProposalTemplates. Alternative: pass templateName.",
        minLength: 24,
        maxLength: 24,
      },
      templateName: {
        type: "string",
        description: "Proposal template name, e.g. 'Civil Work', 'Electrical Work'. Case-insensitive. Alternative to templateId.",
        minLength: 2,
        maxLength: 100,
      },
      totalAmount: {
        type: "number",
        description: "REQUIRED when using a template. Single lump-sum amount (rupees, before GST). E.g. 380000 for ₹3.8L.",
        exclusiveMinimum: 0,
      },
      // Custom path
      customTitle: {
        type: "string",
        description: "Proposal title for the custom path. E.g. '2BHK Interior Design — Maya Patel'. Required if not using a template.",
        minLength: 2,
        maxLength: 200,
      },
      customLineItems: {
        type: "array",
        description: "Array of line items for the custom path. Each: {description, amount}. Subtotal = sum of amounts. Required if customTitle is set.",
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
      // Common
      title: {
        type: "string",
        description: "Optional title override for the template path. Defaults to '<templateName> — <leadName>'. Ignored for custom path (customTitle is the title).",
        minLength: 2,
        maxLength: 200,
      },
      gstPercent: {
        type: "number",
        description: "GST percentage on subtotal. Defaults to 18.",
        minimum: 0,
        maximum: 100,
      },
    },
    required: ["leadId"],
  },

  async dryRun(args, ctx) {
    const r = await loadAndAuthorize(args, ctx);
    if (r.error) return r.error;
    const itemsLine = r.lineItems.length === 1
      ? `1 line item`
      : `${r.lineItems.length} line items`;
    return {
      ok: true,
      proposalDescription:
        `Create + send proposal "${r.title}" to ${r.lead.email} for "${r.lead.name}" (${r.lead.trackingId}) · ` +
        `${itemsLine}, subtotal ₹${r.subtotal.toLocaleString("en-IN")}, GST ${r.gstPercent}% ₹${r.gst.toLocaleString("en-IN")}, ` +
        `final ₹${r.finalAmount.toLocaleString("en-IN")}`,
      args,
      preview: {
        leadName: r.lead.name,
        leadTrackingId: r.lead.trackingId,
        recipientEmail: r.lead.email,
        title: r.title,
        lineItems: r.lineItems,
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

    const section = buildSection(r.title, r.lineItems);
    const now = new Date();

    // Create at manager_approved so triggerSendToClient's "approved" template
    // copy reads correctly, then immediately flip to sent (matches the
    // controller's manager_approved → sent transition at line 210-218).
    const proposal = await Proposal.create({
      leadId: r.lead._id,
      title: r.title,
      content: { sections: [section] },
      subtotal: r.subtotal,
      gst: r.gst,
      totalAmount: r.subtotal,
      finalAmount: r.finalAmount,
      status: "manager_approved",
      approvedAt: now,
      approved_by: ctx.userId,
      approved_at: now,
      createdBy: ctx.userId,
      approvalHistory: [
        { action: "created", performedBy: ctx.userId, remarks: "Created via AI assistant", timestamp: now },
        { action: "manager_approved", performedBy: ctx.userId, remarks: "Auto-approved via AI assistant chat confirmation", timestamp: now },
      ],
    });

    // Link to CRMClient (mirrors createProposal controller behavior).
    await CRMClient.findByIdAndUpdate(r.lead._id, { $addToSet: { linkedProposals: proposal._id } });

    // Populate leadId so triggerSendToClient can read client.email/name.
    const populated = await Proposal.findById(proposal._id).populate("leadId", "name email phone");
    await triggerSendToClient(populated);

    populated.status = "sent";
    populated.sentAt = new Date();
    populated.approvalHistory.push({
      action: "sent",
      performedBy: ctx.userId,
      remarks: "Sent via AI assistant",
      timestamp: populated.sentAt,
    });
    await populated.save();

    // Sync the lead's lifecycleStage (mirrors Proposal.controller.js:232-234).
    await CRMClient.findByIdAndUpdate(r.lead._id, { lifecycleStage: "proposal_sent" });

    notify({
      type: "proposal.sent",
      module: "proposal",
      priority: "normal",
      title: `Proposal created & sent to ${r.lead.name}`,
      message: `"${r.title}" — ₹${r.finalAmount.toLocaleString("en-IN")} (via AI assistant).`,
      link: `/proposal/review/${populated._id}`,
      actor: { _id: ctx.userId, name: ctx.userName || "AI Assistant" },
      notifyActor: true,
      relatedTo: { module: "proposal", recordId: populated._id },
      metadata: { leadName: r.lead.name, finalAmount: r.finalAmount, viaAI: true },
    });

    return {
      ok: true,
      summaryText: `Proposal "${r.title}" created and sent to ${r.lead.email} (₹${r.finalAmount.toLocaleString("en-IN")}).`,
      uiHint: "actionDone",
      data: {
        proposalId: String(populated._id),
        leadId: String(r.lead._id),
        leadName: r.lead.name,
        recipientEmail: r.lead.email,
        title: r.title,
        subtotal: r.subtotal,
        gst: r.gst,
        finalAmount: r.finalAmount,
        sentAt: populated.sentAt,
        url: "/crm/proposal",
      },
    };
  },
};
