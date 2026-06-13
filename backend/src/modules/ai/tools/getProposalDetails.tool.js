// Tool: full detail for ONE proposal — line items, pricing, e-sign / payment
// state, advance payment, and approval history (IST-formatted). Accepts a
// proposalId directly, or a leadId (resolves the lead's proposal; asks which
// one if the lead has several).

const { resolveProposal } = require("../utils/resolveCrm");

const WIDER_PERMS = ["*", "crm.read", "users.manage"];

const IST_DATETIME_FMT = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: true,
});
const fmtIst = (d) => (d ? `${IST_DATETIME_FMT.format(new Date(d))} IST` : null);
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// Flatten content.sections (the dynamic quotation structure) into a simple list
// of { section, name, amount }. Mirrors the column-sniffing in
// Proposal.controller.js triggerSendToClient (looks for an "item/work" column
// and an "amount/total" column).
function extractLineItems(content) {
  const sections = content?.sections || [];
  const out = [];
  for (const section of sections) {
    const cols = section.structure?.columns || [];
    const nameCol = cols.find((c) => /item|work|desc/i.test(c.label || ""));
    const amtCol = cols.find((c) => /amount|total|price|rate/i.test(c.label || ""));
    for (const row of section.structure?.rows || []) {
      if (row.isGroupHeader) continue;
      out.push({
        section: section.title || "",
        name: nameCol ? row.cells?.[nameCol.id] : null,
        amount: amtCol ? Number(row.cells?.[amtCol.id]) || 0 : null,
      });
    }
  }
  return out;
}

module.exports = {
  name: "getProposalDetails",
  permission: "crm.read",
  description:
    "Get full details for ONE proposal — title, status, line items (the quotation), subtotal/GST/final amount, e-sign status, payment/advance status, and approval history. Use for 'open proposal X', 'show the quotation for Ratan Tata', 'what's the status of the proposal for CLI-2026-0003'. Pass proposalId if you have it; otherwise pass leadId (name/trackingId) and it resolves that lead's proposal.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      proposalId: {
        type: "string",
        description: "Proposal ObjectId (24 hex). Use when you already have the id (e.g. from getProposals).",
        minLength: 24,
        maxLength: 24,
      },
      leadId: {
        type: "string",
        description: "Lead/client identifier — ObjectId, trackingId (CLI-YYYY-NNNN), or name fragment. Resolves to that lead's proposal. If the lead has multiple proposals, the tool lists them so you can pick a proposalId.",
        minLength: 2,
        maxLength: 100,
      },
    },
    required: [],
  },

  handler: async (args, ctx) => {
    if (!args.proposalId && !args.leadId) {
      return {
        ok: false,
        error: "invalid_args",
        summaryText: "Provide a proposalId or a leadId to look up the proposal.",
        uiHint: "error",
      };
    }

    const r = await resolveProposal({ proposalId: args.proposalId, leadId: args.leadId });
    if (r.error) {
      return {
        ok: false,
        error: r.candidates ? "ambiguous" : "not_found",
        summaryText: r.error,
        uiHint: "error",
      };
    }

    const p = r.doc;
    const lead = r.lead || p.leadId;

    // Authorize: owner of the lead, or a caller with a wider read permission.
    const isOwner = lead && String(lead.assignedTo || "") === String(ctx.userId);
    const elevated = (ctx.permissions || []).some((perm) => WIDER_PERMS.includes(perm));
    if (!isOwner && !elevated) {
      return {
        ok: false,
        error: "denied",
        summaryText: "You don't have permission to view this proposal.",
        uiHint: "error",
      };
    }

    const lineItems = extractLineItems(p.content);
    const history = (p.approvalHistory || [])
      .slice()
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 15)
      .map((h) => ({ action: h.action, remarks: h.remarks || "", at: fmtIst(h.timestamp) }));

    const data = {
      id: String(p._id),
      title: p.title,
      description: p.description || null,
      status: p.status,
      lead: lead
        ? {
            id: String(lead._id),
            name: lead.name,
            trackingId: lead.trackingId,
            email: lead.email || null,
            phone: lead.phone || null,
          }
        : null,
      subtotal: p.subtotal || 0,
      gst: p.gst || 0,
      finalAmount: p.finalAmount || 0,
      esign: {
        status: p.esign?.status || "pending",
        signedAt: p.esign?.signed_at || null,
      },
      payment: {
        status: p.payments?.status || "pending",
        amount: p.payments?.amount || 0,
        method: p.payments?.method || null,
        receivedAt: p.payments?.received_at || null,
        transactionRef: p.payments?.transactionRef || null,
      },
      advancePayment: p.advancePayment?.amount
        ? {
            amount: p.advancePayment.amount,
            paidBy: p.advancePayment.paidBy || null,
            method: p.advancePayment.paymentMethod || null,
            paymentDate: p.advancePayment.paymentDate || null,
          }
        : null,
      lineItems,
      approvalHistory: history,
      createdAt: p.createdAt,
      url: `/proposal/review/${p._id}`,
    };

    const summaryText =
      `"${p.title}" — ${p.status}, ${inr(p.finalAmount)}` +
      (lead ? ` for ${lead.name} (${lead.trackingId})` : "") +
      `. eSign: ${data.esign.status}, payment: ${data.payment.status}.`;

    return {
      data,
      summaryText,
      uiHint: "proposalDetails",
      llmSummary: {
        id: data.id,
        title: data.title,
        status: data.status,
        leadName: lead?.name || null,
        leadTrackingId: lead?.trackingId || null,
        subtotal: inr(data.subtotal),
        gst: inr(data.gst),
        finalAmount: inr(data.finalAmount),
        esignStatus: data.esign.status,
        esignSignedAt: fmtIst(data.esign.signedAt),
        paymentStatus: data.payment.status,
        paymentAmount: inr(data.payment.amount),
        advancePaid: !!data.advancePayment,
        lineItemCount: lineItems.length,
        lineItems: lineItems.slice(0, 20),
        recentHistory: history.slice(0, 5),
      },
    };
  },
};
