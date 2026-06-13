const mongoose = require("mongoose");
const CRMClient = require("../models/CRMClient.model");

// Map range token → number of days. Months are mapped to fixed day counts
// (3M = 90, 6M = 180) so the day-by-day trend/sparkline logic stays unchanged.
const rangeToDays = (range) => {
  switch (String(range || "").toLowerCase()) {
    case "6m":
      return 180;
    case "1y":
      return 365;
    case "3m":
    default:
      return 90;
  }
};

// Fill missing days with zero so the trend chart is gap-free
const fillDailySeries = (buckets, startDate, days) => {
  const map = new Map();
  for (const b of buckets) map.set(b._id, b.count);
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, value: map.get(key) || 0 });
  }
  return out;
};

const safePct = (numer, denom) =>
  denom > 0 ? Math.round((numer / denom) * 1000) / 10 : 0;

const pctDelta = (curr, prev) => {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
};

const getCRMDashboard = async (req, res) => {
  try {
    const days = rangeToDays(req.query.range);
    const now = new Date();

    const rangeStart = new Date(now);
    rangeStart.setHours(0, 0, 0, 0);
    rangeStart.setDate(rangeStart.getDate() - (days - 1));

    const prevStart = new Date(rangeStart);
    prevStart.setDate(prevStart.getDate() - days);
    const prevEnd = new Date(rangeStart);

    const facetResult = await CRMClient.aggregate([
      {
        $facet: {
          // ── KPIs (all-time + in-range)
          totals: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                converted: {
                  $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] },
                },
                lost: {
                  $sum: { $cond: [{ $eq: ["$status", "lost"] }, 1, 0] },
                },
                active: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["new", "contacted", "meeting_done", "proposal_sent"]] },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          inRange: [
            { $match: { createdAt: { $gte: rangeStart, $lte: now } } },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } },
                lost: { $sum: { $cond: [{ $eq: ["$status", "lost"] }, 1, 0] } },
              },
            },
          ],
          prevRange: [
            { $match: { createdAt: { $gte: prevStart, $lt: prevEnd } } },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } },
                lost: { $sum: { $cond: [{ $eq: ["$status", "lost"] }, 1, 0] } },
              },
            },
          ],

          // ── Avg deal cycle (days from createdAt to advancePayment.movedAt or updatedAt for converted)
          dealCycle: [
            { $match: { status: "converted" } },
            {
              $project: {
                cycleDays: {
                  $divide: [
                    {
                      $subtract: [
                        { $ifNull: ["$advancePayment.movedAt", "$updatedAt"] },
                        "$createdAt",
                      ],
                    },
                    1000 * 60 * 60 * 24,
                  ],
                },
              },
            },
            { $group: { _id: null, avgDays: { $avg: "$cycleDays" }, count: { $sum: 1 } } },
          ],

          // ── Acquisition trend (daily buckets)
          acquisitionTrend: [
            { $match: { createdAt: { $gte: rangeStart, $lte: now } } },
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],

          // ── Conversion trend (daily buckets, for sparklines)
          convertedTrend: [
            { $match: { status: "converted", updatedAt: { $gte: rangeStart, $lte: now } } },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],

          // ── Lost trend
          lostTrend: [
            { $match: { status: "lost", updatedAt: { $gte: rangeStart, $lte: now } } },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],

          // ── Source breakdown
          sourceBreakdown: [
            {
              $group: {
                _id: { $ifNull: ["$source", "other"] },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
          ],

          // ── Funnel (by lifecycleStage)
          funnel: [
            {
              $group: {
                _id: "$lifecycleStage",
                count: { $sum: 1 },
              },
            },
          ],

          // ── Lead conversion stage breakdown (mutually-exclusive buckets)
          // converted/lost are driven by status; the rest by lifecycleStage.
          stageBreakdown: [
            {
              $group: {
                _id: {
                  $switch: {
                    branches: [
                      { case: { $eq: ["$status", "converted"] }, then: "converted" },
                      { case: { $eq: ["$status", "lost"] }, then: "lost" },
                      { case: { $eq: ["$lifecycleStage", "followup_due"] }, then: "followup" },
                      {
                        case: { $in: ["$lifecycleStage", ["interested", "show_project"]] },
                        then: "interested",
                      },
                    ],
                    default: "in_progress",
                  },
                },
                count: { $sum: 1 },
              },
            },
          ],

          // ── Project type mix
          projectTypeMix: [
            { $match: { projectType: { $in: ["Residential", "Commercial"] } } },
            {
              $group: {
                _id: "$projectType",
                count: { $sum: 1 },
                totalBudget: { $sum: { $ifNull: ["$budget", 0] } },
              },
            },
          ],

          // ── Top cities
          topCities: [
            {
              $match: {
                city: { $exists: true, $ne: null, $nin: ["", " "] },
              },
            },
            {
              $group: {
                _id: { $trim: { input: "$city" } },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 6 },
          ],

          // ── Hot leads
          hotLeads: [
            {
              $match: {
                lifecycleStage: { $in: ["interested", "proposal_sent"] },
                status: { $nin: ["lost", "converted"] },
              },
            },
            { $sort: { lastInteractionAt: -1, updatedAt: -1 } },
            { $limit: 5 },
            {
              $project: {
                name: 1,
                trackingId: 1,
                projectType: 1,
                city: 1,
                priority: 1,
                status: 1,
                lifecycleStage: 1,
                budget: 1,
                phone: 1,
                lastInteractionAt: 1,
                updatedAt: 1,
              },
            },
          ],
        },
      },
    ]);

    const f = facetResult[0] || {};
    const totals = f.totals?.[0] || { total: 0, converted: 0, lost: 0, active: 0 };
    const inRange = f.inRange?.[0] || { total: 0, converted: 0, lost: 0 };
    const prevRange = f.prevRange?.[0] || { total: 0, converted: 0, lost: 0 };
    const dealCycle = f.dealCycle?.[0] || { avgDays: 0, count: 0 };

    // Build dense daily series for trend & sparklines
    const acquisitionTrend = fillDailySeries(
      f.acquisitionTrend || [],
      rangeStart,
      days
    );
    const convertedTrend = fillDailySeries(f.convertedTrend || [], rangeStart, days);
    const lostTrend = fillDailySeries(f.lostTrend || [], rangeStart, days);

    // Active pipeline rolling sparkline → cumulative active over time is expensive
    // to compute. Use acquisition - converted - lost as a proxy delta sparkline.
    const activeTrend = acquisitionTrend.map((p, i) => ({
      date: p.date,
      value: Math.max(
        0,
        p.value - (convertedTrend[i]?.value || 0) - (lostTrend[i]?.value || 0)
      ),
    }));

    // Funnel — canonical 6-step order
    const funnelMap = new Map((f.funnel || []).map((b) => [b._id, b.count]));
    const stageOrder = [
      { key: "enquiry",         label: "Enquiry" },
      { key: "meeting_scheduled", label: "Meeting" },
      { key: "interested",      label: "Interested" },
      { key: "proposal_sent",   label: "Proposal Sent" },
      { key: "advance_received", label: "Advance" },
      { key: "converted",       label: "Converted" },
    ];
    // Aggregate stages that flow forward — e.g. "thank_you_sent", "kit", "followup_due" count toward "Meeting"
    const stageAggregation = {
      enquiry: ["enquiry"],
      meeting_scheduled: ["meeting_scheduled", "thank_you_sent", "kit", "followup_due"],
      interested: ["interested", "show_project"],
      proposal_sent: ["proposal_sent"],
      advance_received: ["advance_received", "project_moved", "project_started"],
      converted: ["converted"],
    };
    const funnel = stageOrder.map(({ key, label }) => {
      const count = (stageAggregation[key] || [key]).reduce(
        (sum, k) => sum + (funnelMap.get(k) || 0),
        0
      );
      return { key, label, value: count };
    });

    // Source breakdown — ensure all enum sources surface
    const sourceLabels = {
      walk_in: "Walk-in",
      referral: "Referral",
      website: "Website",
      instagram: "Instagram",
      whatsapp: "WhatsApp",
      other: "Other",
    };
    const sourceBreakdown = (f.sourceBreakdown || []).map((s) => ({
      key: s._id,
      label: sourceLabels[s._id] || s._id,
      value: s.count,
    }));

    const projectTypeMix = (f.projectTypeMix || []).map((p) => ({
      label: p._id,
      value: p.count,
      totalBudget: p.totalBudget || 0,
    }));

    const topCities = (f.topCities || []).slice(0, 5).map((c) => ({
      label: c._id,
      value: c.count,
    }));

    const hotLeads = (f.hotLeads || []).map((l) => ({
      _id: l._id,
      name: l.name,
      trackingId: l.trackingId,
      projectType: l.projectType,
      city: l.city,
      priority: l.priority,
      status: l.status,
      lifecycleStage: l.lifecycleStage,
      budget: l.budget,
      phone: l.phone,
      lastInteractionAt: l.lastInteractionAt || l.updatedAt,
    }));

    // Lead conversion stage counts (current-state snapshot, all-time)
    const stageMap = new Map((f.stageBreakdown || []).map((b) => [b._id, b.count]));
    const leadStages = {
      inProgress: stageMap.get("in_progress") || 0,
      interested: stageMap.get("interested") || 0,
      followup: stageMap.get("followup") || 0,
      converted: stageMap.get("converted") || 0,
      lost: stageMap.get("lost") || 0,
    };

    const conversionRate = safePct(inRange.converted, inRange.total);
    const lostRate = safePct(inRange.lost, inRange.total);
    const prevConversionRate = safePct(prevRange.converted, prevRange.total);
    const prevLostRate = safePct(prevRange.lost, prevRange.total);

    const kpis = {
      totalLeads: {
        value: totals.total,
        delta: pctDelta(inRange.total, prevRange.total),
        rangeValue: inRange.total,
        prevRangeValue: prevRange.total,
      },
      activePipeline: {
        value: totals.active,
      },
      conversionRate: {
        value: conversionRate,
        prevValue: prevConversionRate,
        delta: Math.round((conversionRate - prevConversionRate) * 10) / 10,
      },
      lostRate: {
        value: lostRate,
        prevValue: prevLostRate,
        delta: Math.round((lostRate - prevLostRate) * 10) / 10,
      },
      avgDealCycle: {
        value: dealCycle.avgDays ? Math.round(dealCycle.avgDays * 10) / 10 : 0,
        count: dealCycle.count,
      },
    };

    return res.status(200).json({
      message: "CRM dashboard fetched successfully",
      data: {
        range: req.query.range || "3m",
        rangeStart,
        rangeEnd: now,
        kpis,
        leadStages,
        trends: {
          acquisition: acquisitionTrend,
          converted: convertedTrend,
          lost: lostTrend,
          active: activeTrend,
        },
        sourceBreakdown,
        funnel,
        projectTypeMix,
        topCities,
        hotLeads,
      },
    });
  } catch (error) {
    console.log("Error fetching CRM dashboard:", error.message);
    return res
      .status(500)
      .json({ message: error.message || "Failed to load CRM dashboard" });
  }
};

module.exports = {
  getCRMDashboard,
};
