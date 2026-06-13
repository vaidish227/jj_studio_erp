// Tool: list CRM proposals (the canonical Proposal records the UI drives).
// Filter by lead, status, or a title fragment. Mirrors GET /proposal/get.
// Returns total + viewAllUrl (pass-through fields already whitelisted in the
// tool-result pipeline) so the model always knows the real count.

const Proposal = require("../../crm/models/Proposal.model");
const { resolveLead } = require("../utils/resolveCrm");

const STATUSES = [
  "draft", "pending_approval", "revision_requested", "manager_approved",
  "sent", "esign_received", "payment_received", "project_ready",
  "rejected", "project_started",
];

const IST_DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
});
const fmtIstDay = (d) => (d ? IST_DATE_FMT.format(new Date(d)) : null);
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = {
  name: "getProposals",
  permission: "crm.read",
  description:
    "List proposals (the quotation/proposal records). Use for 'show proposals', 'how many proposals are pending approval', 'proposals for Ratan Tata', 'list sent proposals'. Pass leadId (ObjectId, trackingId, or name fragment) to scope to one lead's proposals. Pass status to filter by lifecycle stage. Pass q to search by proposal title. For full detail on ONE proposal (line items, e-sign/payment state, approval history) call getProposalDetails instead.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      leadId: {
        type: "string",
        description: "Optional lead/client identifier to scope to that lead's proposals — ObjectId, trackingId (CLI-YYYY-NNNN), or unambiguous name fragment.",
        minLength: 2,
        maxLength: 100,
      },
      status: {
        type: "string",
        enum: [...STATUSES, "all"],
        description: "Filter by proposal status. 'pending_approval' = awaiting manager review; 'manager_approved'/'sent' = with the client; 'project_ready'/'project_started' = won. 'all' (default) = every status.",
      },
      q: {
        type: "string",
        description: "Case-insensitive search on the proposal title.",
        minLength: 1,
        maxLength: 100,
      },
      limit: { type: "integer", minimum: 1, maximum: 50 },
    },
    required: [],
  },

  handler: async (args) => {
    const limit = Math.min(args.limit || 20, 50);
    const filter = {};
    let leadDoc = null;

    if (args.leadId) {
      const r = await resolveLead(args.leadId);
      if (r.error) {
        return {
          ok: false,
          error: r.candidates ? "ambiguous" : "not_found",
          summaryText: r.error,
          uiHint: "error",
        };
      }
      leadDoc = r.doc;
      filter.leadId = r.doc._id;
    }

    if (args.status && args.status !== "all") filter.status = args.status;
    if (args.q && args.q.trim()) filter.title = new RegExp(escapeRegex(args.q.trim()), "i");

    const [proposals, total] = await Promise.all([
      Proposal.find(filter)
        .select("title status finalAmount subtotal esign payments leadId createdAt")
        .populate("leadId", "name trackingId")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Proposal.countDocuments(filter),
    ]);

    const items = proposals.map((p) => ({
      id: String(p._id),
      title: p.title,
      status: p.status,
      finalAmount: p.finalAmount || 0,
      subtotal: p.subtotal || 0,
      esign: p.esign?.status || "pending",
      payment: p.payments?.status || "pending",
      leadId: p.leadId ? String(p.leadId._id) : null,
      leadName: p.leadId?.name || null,
      leadTrackingId: p.leadId?.trackingId || null,
      createdAt: p.createdAt,
      url: `/proposal/review/${p._id}`,
    }));

    const viewAllUrl = "/proposal/list";
    const truncated = total > items.length;
    const scopeLabel = leadDoc ? ` for ${leadDoc.name}` : "";
    const statusLabel = args.status && args.status !== "all" ? ` (${args.status})` : "";

    let summaryText;
    if (items.length === 0) {
      summaryText = `No proposals${statusLabel}${scopeLabel}.`;
    } else if (truncated) {
      summaryText = `Showing ${items.length} of ${total} proposals${statusLabel}${scopeLabel}`;
    } else {
      summaryText = `${total} proposal${total === 1 ? "" : "s"}${statusLabel}${scopeLabel}`;
    }

    return {
      data: items,
      total,
      viewAllUrl,
      summaryText,
      uiHint: "proposalList",
      llmSummary: {
        total,
        shown: items.length,
        truncated,
        viewAllUrl,
        items: items.slice(0, 10).map((p) => ({
          id: p.id,
          title: p.title,
          status: p.status,
          leadName: p.leadName,
          leadTrackingId: p.leadTrackingId,
          finalAmount: inr(p.finalAmount),
          esign: p.esign,
          payment: p.payment,
          createdAt: fmtIstDay(p.createdAt),
        })),
      },
    };
  },
};
