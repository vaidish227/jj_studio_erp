/**
 * Proposal aggregates — reusable counts and cashflow for cross-module dashboards.
 *
 * The Proposal model lives at modules/crm/models/Proposal.model.js (historic
 * placement). All status / payment / advancePayment field shapes mirror that schema.
 */

const Proposal = require("../../crm/models/Proposal.model");

const PROPOSAL_STATUSES = [
  "draft",
  "pending_approval",
  "revision_requested",
  "manager_approved",
  "sent",
  "esign_received",
  "payment_received",
  "project_ready",
  "rejected",
  "project_started",
];

const OPEN_STATUSES = [
  "draft",
  "pending_approval",
  "revision_requested",
  "manager_approved",
  "sent",
  "esign_received",
];

/**
 * @param {Date} periodStart
 * @param {{start: Date, end: Date}} prevWindow
 * @returns {Promise<{byStatus, kpis, totalValueOpen, proposalsAwaitingApproval}>}
 */
async function getStatusCountsAndCashflow(periodStart, prevWindow) {
  const facet = await Proposal.aggregate([
    {
      $facet: {
        byStatus: [
          {
            $group: {
              _id: "$status",
              count:    { $sum: 1 },
              amount:   { $sum: { $ifNull: ["$finalAmount", 0] } },
            },
          },
        ],
        sentInPeriod: [
          { $match: { sentAt: { $gte: periodStart } } },
          { $count: "n" },
        ],
        sentInPrev: [
          { $match: { sentAt: { $gte: prevWindow.start, $lt: prevWindow.end } } },
          { $count: "n" },
        ],
        // Cashflow from inline payments object (current implementation)
        paymentsInPeriod: [
          {
            $match: {
              "payments.status":      "received",
              "payments.received_at": { $gte: periodStart },
            },
          },
          {
            $group: {
              _id:    null,
              amount: { $sum: { $ifNull: ["$payments.amount", 0] } },
              count:  { $sum: 1 },
            },
          },
        ],
        // Plus advance payment cashflow (legacy field, still populated)
        advanceInPeriod: [
          { $match: { "advancePayment.paymentDate": { $gte: periodStart } } },
          {
            $group: {
              _id:    null,
              amount: { $sum: { $ifNull: ["$advancePayment.amount", 0] } },
              count:  { $sum: 1 },
            },
          },
        ],
        paymentsInPrev: [
          {
            $match: {
              "payments.status":      "received",
              "payments.received_at": { $gte: prevWindow.start, $lt: prevWindow.end },
            },
          },
          {
            $group: { _id: null, amount: { $sum: { $ifNull: ["$payments.amount", 0] } } },
          },
        ],
        advanceInPrev: [
          {
            $match: {
              "advancePayment.paymentDate": { $gte: prevWindow.start, $lt: prevWindow.end },
            },
          },
          {
            $group: { _id: null, amount: { $sum: { $ifNull: ["$advancePayment.amount", 0] } } },
          },
        ],
      },
    },
  ]);

  const f = facet[0] || {};
  const statusMap = new Map((f.byStatus || []).map((r) => [r._id, r]));
  const byStatus = PROPOSAL_STATUSES.map((status) => {
    const row = statusMap.get(status);
    return {
      status,
      count:  row?.count  || 0,
      amount: row?.amount || 0,
    };
  });

  const sentInPeriod = f.sentInPeriod?.[0]?.n || 0;
  const sentInPrev   = f.sentInPrev?.[0]?.n   || 0;

  const cashThisPeriod = (f.paymentsInPeriod?.[0]?.amount || 0) + (f.advanceInPeriod?.[0]?.amount || 0);
  const cashPrev       = (f.paymentsInPrev?.[0]?.amount   || 0) + (f.advanceInPrev?.[0]?.amount   || 0);

  const totalValueOpen = byStatus
    .filter((r) => OPEN_STATUSES.includes(r.status))
    .reduce((s, r) => s + r.amount, 0);

  const proposalsAwaitingApproval =
    (statusMap.get("pending_approval")?.count || 0) +
    (statusMap.get("revision_requested")?.count || 0);

  return {
    byStatus,
    totalValueOpen,
    advanceReceivedThisPeriod: cashThisPeriod,
    proposalsAwaitingApproval,
    kpis: {
      proposalsSent: {
        value: sentInPeriod,
        delta: sentInPeriod - sentInPrev,
      },
      advanceReceivedAmount: {
        value: cashThisPeriod,
        delta: cashThisPeriod - cashPrev,
      },
    },
  };
}

/**
 * Per-week proposals-sent and advance-received counts for the 12-week trend.
 */
async function getWeeklyActivity(weekStarts) {
  if (!weekStarts?.length) return [];
  const first = weekStarts[0];
  const docs = await Proposal.find({
    $or: [
      { sentAt: { $gte: first } },
      { "payments.received_at":      { $gte: first } },
      { "advancePayment.paymentDate": { $gte: first } },
    ],
  })
    .select("sentAt payments advancePayment status updatedAt")
    .lean();

  return weekStarts.map((start, idx) => {
    const end = weekStarts[idx + 1] || new Date(start.getTime() + 7 * 86400000);
    let sent = 0;
    let advances = 0;
    let projectsStarted = 0;
    for (const d of docs) {
      if (d.sentAt) {
        const ts = new Date(d.sentAt).getTime();
        if (ts >= start.getTime() && ts < end.getTime()) sent += 1;
      }
      const recAt = d.payments?.received_at;
      if (recAt && d.payments?.status === "received") {
        const ts = new Date(recAt).getTime();
        if (ts >= start.getTime() && ts < end.getTime()) advances += 1;
      }
      const advAt = d.advancePayment?.paymentDate;
      if (advAt) {
        const ts = new Date(advAt).getTime();
        if (ts >= start.getTime() && ts < end.getTime()) advances += 1;
      }
      if (d.status === "project_started" && d.updatedAt) {
        const ts = new Date(d.updatedAt).getTime();
        if (ts >= start.getTime() && ts < end.getTime()) projectsStarted += 1;
      }
    }
    return { weekStart: start, sent, advances, projectsStarted };
  });
}

module.exports = {
  getStatusCountsAndCashflow,
  getWeeklyActivity,
  PROPOSAL_STATUSES,
  OPEN_STATUSES,
};
