/**
 * CRM aggregates — reusable helpers for cross-module dashboards (e.g., MD Dashboard).
 *
 * Uses the same query logic as CRMDashboard.controller.js so numbers match
 * exactly. The HTTP controller stays untouched; this service is consumed
 * directly by other backend modules that need CRM KPIs without an extra round-trip.
 */

const CRMClient = require("../models/CRMClient.model");

const STAGE_ORDER = [
  { key: "enquiry",           label: "Enquiry" },
  { key: "meeting_scheduled", label: "Meeting" },
  { key: "interested",        label: "Interested" },
  { key: "proposal_sent",     label: "Proposal Sent" },
  { key: "advance_received",  label: "Advance" },
  { key: "converted",         label: "Converted" },
];

const STAGE_AGGREGATION = {
  enquiry:           ["enquiry"],
  meeting_scheduled: ["meeting_scheduled", "thank_you_sent", "kit", "followup_due"],
  interested:        ["interested", "show_project"],
  proposal_sent:     ["proposal_sent"],
  advance_received:  ["advance_received", "project_moved", "project_started"],
  converted:         ["converted"],
};

const safePct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
const pctDelta = (curr, prev) => {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
};

/**
 * Funnel + period KPIs for the MD dashboard.
 *
 * @param {Date} periodStart   — start of the active window (inclusive)
 * @param {Date} periodEnd     — end of the active window (inclusive)
 * @param {{start: Date, end: Date}} prevWindow — previous-window for delta calc
 * @returns {Promise<{funnel, kpis}>}
 */
async function getFunnelAndKpis(periodStart, periodEnd, prevWindow) {
  const facet = await CRMClient.aggregate([
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              active: {
                $sum: {
                  $cond: [
                    { $in: ["$status", ["new", "contacted", "meeting_done", "proposal_sent"]] },
                    1, 0,
                  ],
                },
              },
            },
          },
        ],
        inRange: [
          { $match: { createdAt: { $gte: periodStart, $lte: periodEnd } } },
          {
            $group: {
              _id: null,
              total:     { $sum: 1 },
              converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } },
              lost:      { $sum: { $cond: [{ $eq: ["$status", "lost"] }, 1, 0] } },
            },
          },
        ],
        prevRange: [
          { $match: { createdAt: { $gte: prevWindow.start, $lt: prevWindow.end } } },
          {
            $group: {
              _id: null,
              total:     { $sum: 1 },
              converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } },
            },
          },
        ],
        funnel: [
          { $group: { _id: "$lifecycleStage", count: { $sum: 1 } } },
        ],
      },
    },
  ]);

  const f = facet[0] || {};
  const totals    = f.totals?.[0]    || { total: 0, active: 0 };
  const inRange   = f.inRange?.[0]   || { total: 0, converted: 0, lost: 0 };
  const prevRange = f.prevRange?.[0] || { total: 0, converted: 0 };

  const funnelMap = new Map((f.funnel || []).map((b) => [b._id, b.count]));
  const funnel = STAGE_ORDER.map(({ key, label }) => ({
    key,
    stage: label,
    count: (STAGE_AGGREGATION[key] || [key]).reduce(
      (sum, k) => sum + (funnelMap.get(k) || 0),
      0,
    ),
  }));

  const conversionRate     = safePct(inRange.converted,   inRange.total);
  const prevConversionRate = safePct(prevRange.converted, prevRange.total);

  return {
    funnel,
    kpis: {
      totalLeads: {
        value: totals.total,
        delta: pctDelta(inRange.total, prevRange.total),
      },
      activePipeline: {
        value: totals.active,
        delta: 0,
      },
      conversionRate: {
        value: conversionRate,
        delta: Math.round((conversionRate - prevConversionRate) * 10) / 10,
      },
    },
  };
}

/**
 * Weekly trend of new leads — used by the MD dashboard's 12-week strip.
 */
async function getWeeklyLeadCounts(weekStarts) {
  if (!weekStarts?.length) return [];
  const first = weekStarts[0];
  const docs = await CRMClient.find({ createdAt: { $gte: first } })
    .select("createdAt")
    .lean();

  return weekStarts.map((start, idx) => {
    const end = weekStarts[idx + 1] || new Date(start.getTime() + 7 * 86400000);
    let count = 0;
    for (const d of docs) {
      const ts = new Date(d.createdAt).getTime();
      if (ts >= start.getTime() && ts < end.getTime()) count += 1;
    }
    return { weekStart: start, count };
  });
}

module.exports = {
  getFunnelAndKpis,
  getWeeklyLeadCounts,
};
