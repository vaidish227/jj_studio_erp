// Admin endpoints: metrics rollup, health surface for ops dashboards.
// Guarded by requirePermission('ai.admin') in the router.

const AIMetric = require("../models/AIMetric.model");
const AIToolCall = require("../models/AIToolCall.model");

async function metricsRollup(req, res) {
  const to   = req.query.to   ? new Date(req.query.to)   : new Date();
  const from = req.query.from ? new Date(req.query.from) : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return res.status(400).json({ message: "Invalid date range." });
  }

  const [byDay, byModel, byTool, totals] = await Promise.all([
    AIMetric.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          requests: { $sum: 1 },
          tokens: { $sum: { $add: ["$promptTokens", "$completionTokens"] } },
          costUsd: { $sum: "$costUsd" },
          errors: { $sum: { $cond: [{ $ne: ["$errorCode", null] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    AIMetric.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: "$model",
          requests: { $sum: 1 },
          tokens: { $sum: { $add: ["$promptTokens", "$completionTokens"] } },
          costUsd: { $sum: "$costUsd" },
        },
      },
    ]),
    AIToolCall.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: "$toolName",
          calls: { $sum: 1 },
          ok:    { $sum: { $cond: [{ $eq: ["$status", "ok"] }, 1, 0] } },
          denied: { $sum: { $cond: [{ $eq: ["$status", "denied"] }, 1, 0] } },
          avgLatencyMs: { $avg: "$latencyMs" },
        },
      },
      { $sort: { calls: -1 } },
    ]),
    AIMetric.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: null,
          requests: { $sum: 1 },
          tokens: { $sum: { $add: ["$promptTokens", "$completionTokens"] } },
          costUsd: { $sum: "$costUsd" },
          avgLatencyMs: { $avg: "$latencyMs" },
        },
      },
    ]),
  ]);

  res.json({
    from,
    to,
    totals: totals[0] || { requests: 0, tokens: 0, costUsd: 0, avgLatencyMs: 0 },
    byDay,
    byModel,
    byTool,
  });
}

module.exports = { metricsRollup };
