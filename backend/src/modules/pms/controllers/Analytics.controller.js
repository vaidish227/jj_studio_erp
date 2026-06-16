/**
 * Analytics.controller — Phase 4.
 *
 * Read-only aggregations for the MD/manager dashboard. All endpoints support
 * optional ?from=YYYY-MM-DD&to=YYYY-MM-DD filters where it makes sense.
 *
 * Endpoints (mounted at /api/pms/analytics):
 *   GET  /gate-aging               — open gates across all projects, sorted by age
 *   GET  /drawing-release-sla      — avg/median time from approved → released_to_site
 *   GET  /designer-utilisation     — per-designer task count + completion rate + avg cycle time
 *   GET  /vendor-performance       — per-vendor engagement count + avg time per stage
 *   GET  /project-profitability    — per-project PO total vs proposal budget + variance
 *
 * Permission: reports.read (existing). MD + manager + admin have it.
 */

const mongoose = require("mongoose");
const { resolveDateRange, DateRangeError } = require("../../../shared/dateRange/resolveDateRange");
const Project = require("../models/Project.model");
const Task = require("../models/Task.model");
const ApprovalGate = require("../models/ApprovalGate.model");
const Drawing = require("../models/Drawing.model");
const Vendor = require("../models/Vendor.model");
const VendorEngagement = require("../models/VendorEngagement.model");
const PurchaseOrder = require("../models/PurchaseOrder.model");
let User = null; try { User = require("../../auth/models/user.model"); } catch (e) {}
// Register populate refs so Mongoose can resolve them on cold start
try { require("../../crm/models/CRMClient.model"); } catch (e) { /* optional */ }

const DAY = 86400000;

const parseDateRange = (q) => {
  const from = q?.from ? new Date(q.from) : null;
  const to   = q?.to   ? new Date(q.to)   : null;
  return { from, to };
};

const median = (arr) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

/**
 * @route GET /api/pms/analytics/gate-aging
 *
 * Open gates across all projects, ordered by age desc.
 * Aggregates by approverType so the dashboard can split client / PD / hybrid / manager.
 */
const gateAging = async (req, res) => {
  try {
    const gates = await ApprovalGate.find({ status: "open" })
      .populate("projectId", "name trackingId phase")
      .select("label gateType approverType listensTo createdAt projectId")
      .lean();

    const now = Date.now();
    const decorated = gates.map((g) => ({
      _id: g._id,
      projectId: g.projectId?._id,
      projectName: g.projectId?.name,
      trackingId: g.projectId?.trackingId,
      phase: g.projectId?.phase,
      label: g.label,
      gateType: g.gateType,
      approverType: g.approverType,
      listensTo: g.listensTo,
      ageingDays: Math.max(0, Math.floor((now - new Date(g.createdAt).getTime()) / DAY)),
    })).sort((a, b) => b.ageingDays - a.ageingDays);

    // Buckets for summary
    const buckets = { "0-3": 0, "4-7": 0, "8-14": 0, "15+": 0 };
    for (const g of decorated) {
      if (g.ageingDays <= 3) buckets["0-3"]++;
      else if (g.ageingDays <= 7) buckets["4-7"]++;
      else if (g.ageingDays <= 14) buckets["8-14"]++;
      else buckets["15+"]++;
    }

    // Per approverType count
    const byApprover = decorated.reduce((acc, g) => {
      acc[g.approverType] = (acc[g.approverType] || 0) + 1;
      return acc;
    }, {});

    res.json({
      total: decorated.length,
      buckets,
      byApprover,
      gates: decorated.slice(0, 50),  // hard cap for UI
    });
  } catch (err) {
    console.error("[analytics.gateAging]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route GET /api/pms/analytics/drawing-release-sla
 *
 * Time from drawing approvalDate → releasedAt. Reports avg, median, count.
 * Optional date range filter applied to releasedAt.
 */
const drawingReleaseSLA = async (req, res) => {
  try {
    // Shared date contract: ?preset=… OR ?from=&to=. Routed through the shared
    // resolver for IST-correct, end-inclusive windows. No params ⇒ all releases.
    const { preset, from, to } = req.query;
    let windowStart = null, windowEnd = null;
    if (preset || from || to) {
      const r = resolveDateRange({
        preset: preset != null ? String(preset).toLowerCase() : undefined,
        from,
        to,
      });
      windowStart = r.start;
      windowEnd = r.end;
    }

    const q = {
      isReleased: true,
      releasedAt: { $ne: null },
      approvalDate: { $ne: null },
    };
    if (windowStart && windowEnd) {
      q.releasedAt = { $gte: windowStart, $lte: windowEnd };
    }

    const releases = await Drawing.find(q)
      .populate("projectId", "name trackingId")
      .select("title drawingType approvalDate releasedAt projectId")
      .lean();

    const durations = releases.map((d) => {
      const ms = new Date(d.releasedAt) - new Date(d.approvalDate);
      return { ...d, slaHours: ms / 3600000 };
    });

    const hours = durations.map((d) => d.slaHours).filter((h) => h >= 0);
    const avgHours = avg(hours);
    const medianHours = median(hours);

    // Per drawing-type breakdown
    const byType = {};
    for (const d of durations) {
      const k = d.drawingType || "other";
      (byType[k] = byType[k] || []).push(d.slaHours);
    }
    const byTypeSummary = Object.entries(byType).map(([type, arr]) => ({
      type,
      count: arr.length,
      avgHours: avg(arr),
      medianHours: median(arr),
    }));

    res.json({
      total: durations.length,
      avgHours,
      medianHours,
      maxHours: hours.length ? Math.max(...hours) : 0,
      minHours: hours.length ? Math.min(...hours) : 0,
      byType: byTypeSummary,
      recent: durations.sort((a, b) => new Date(b.releasedAt) - new Date(a.releasedAt)).slice(0, 20),
    });
  } catch (err) {
    if (err instanceof DateRangeError) {
      return res.status(400).json({ error: err.code, message: err.message });
    }
    console.error("[analytics.drawingReleaseSLA]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route GET /api/pms/analytics/designer-utilisation
 *
 * Per-designer: assigned task count, completed count, completion %, avg cycle time
 * (createdAt → approvedAt / completedAt).
 */
const designerUtilisation = async (req, res) => {
  try {
    const TERMINAL = ["approved", "released_to_site", "completed"];

    // Don't populate — populate sets the field to null if the User doc is
    // missing, which would lose the raw assignedTo ObjectId on test data.
    const tasks = await Task.find({ assignedTo: { $ne: null } })
      .select("assignedTo status createdAt approvedAt completedAt taskType")
      .lean();

    const byUser = new Map();
    for (const t of tasks) {
      if (!t.assignedTo) continue;
      const key = String(t.assignedTo);
      if (!byUser.has(key)) byUser.set(key, {
        userId: t.assignedTo,
        name: "—",
        role: "—",
        total: 0, completed: 0, inProgress: 0, blocked: 0,
        cycleHours: [],
      });
      const u = byUser.get(key);
      u.total++;
      if (TERMINAL.includes(t.status)) {
        u.completed++;
        const endTs = t.completedAt || t.approvedAt;
        if (endTs && t.createdAt) {
          u.cycleHours.push((new Date(endTs) - new Date(t.createdAt)) / 3600000);
        }
      }
      if (t.status === "in_progress" || t.status === "pending_review") u.inProgress++;
      if (t.status === "blocked") u.blocked++;
    }

    // Hydrate user names / roles in a single batch query
    if (User && byUser.size > 0) {
      const userIds = [...byUser.keys()];
      const users = await User.find({ _id: { $in: userIds } }).select("name email role").lean();
      for (const u of users) {
        const entry = byUser.get(String(u._id));
        if (entry) {
          entry.name = u.name || entry.name;
          entry.role = u.role || entry.role;
        }
      }
    }

    const rows = [...byUser.values()].map((u) => ({
      userId: u.userId,
      name: u.name,
      role: u.role,
      total: u.total,
      completed: u.completed,
      inProgress: u.inProgress,
      blocked: u.blocked,
      completionRate: u.total > 0 ? Math.round((u.completed / u.total) * 100) : 0,
      avgCycleHours: avg(u.cycleHours),
      medianCycleHours: median(u.cycleHours),
    })).sort((a, b) => b.total - a.total);

    res.json({ designers: rows });
  } catch (err) {
    console.error("[analytics.designerUtilisation]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route GET /api/pms/analytics/vendor-performance
 *
 * Per-vendor: total engagements, avg time per stage transition, success rate
 * (% reaching site_received vs cancelled).
 */
const vendorPerformance = async (req, res) => {
  try {
    const engagements = await VendorEngagement.find({})
      .populate("vendorId", "name category rating")
      .select("vendorId vendorKind status history createdAt updatedAt")
      .lean();

    const byVendor = new Map();
    for (const e of engagements) {
      const key = String(e.vendorId?._id || e.vendorId || "unknown");
      if (!byVendor.has(key)) byVendor.set(key, {
        vendorId: e.vendorId?._id || e.vendorId,
        name: e.vendorId?.name || "—",
        category: e.vendorId?.category || "—",
        rating: e.vendorId?.rating ?? null,
        total: 0,
        active: 0,
        delivered: 0,
        siteReceived: 0,
        cancelled: 0,
        avgQuoteHours: [],   // requested → quoted
        avgApproveHours: [], // quoted → client_approved
        avgPOHours: [],      // client_approved → po_emitted
        avgDeliveryHours: [],// po_emitted → delivered
      });
      const v = byVendor.get(key);
      v.total++;
      if (["delivered", "site_received"].includes(e.status)) v.delivered++;
      if (e.status === "site_received") v.siteReceived++;
      if (e.status === "cancelled") v.cancelled++;
      if (!["site_received", "cancelled", "delivered"].includes(e.status)) v.active++;

      // Compute stage transitions from history
      const h = e.history || [];
      const trans = {};
      for (const ent of h) {
        if (ent.toStatus && ent.at) trans[ent.toStatus] = new Date(ent.at).getTime();
      }
      const start = new Date(e.createdAt).getTime();
      if (trans.quoted) v.avgQuoteHours.push((trans.quoted - start) / 3600000);
      if (trans.client_approved && trans.quoted) v.avgApproveHours.push((trans.client_approved - trans.quoted) / 3600000);
      if (trans.po_emitted && trans.client_approved) v.avgPOHours.push((trans.po_emitted - trans.client_approved) / 3600000);
      if (trans.delivered && trans.po_emitted) v.avgDeliveryHours.push((trans.delivered - trans.po_emitted) / 3600000);
    }

    const rows = [...byVendor.values()].map((v) => ({
      vendorId: v.vendorId,
      name: v.name,
      category: v.category,
      rating: v.rating,
      total: v.total,
      active: v.active,
      delivered: v.delivered,
      siteReceived: v.siteReceived,
      cancelled: v.cancelled,
      successRate: v.total > 0 ? Math.round((v.siteReceived / v.total) * 100) : 0,
      avgQuoteHours: avg(v.avgQuoteHours),
      avgApproveHours: avg(v.avgApproveHours),
      avgPOHours: avg(v.avgPOHours),
      avgDeliveryHours: avg(v.avgDeliveryHours),
    })).sort((a, b) => b.total - a.total);

    res.json({ vendors: rows });
  } catch (err) {
    console.error("[analytics.vendorPerformance]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route GET /api/pms/analytics/project-profitability
 *
 * Per-project: sum of PO totalAmounts vs project.budget (which is mirrored from
 * proposal at initiation). Computes variance and variance %.
 */
const projectProfitability = async (req, res) => {
  try {
    const projects = await Project.find({})
      .select("name trackingId status phase budget createdAt clientId")
      .populate("clientId", "name")
      .lean();

    const projectIds = projects.map((p) => p._id);
    const poAgg = await PurchaseOrder.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      { $group: {
          _id: "$projectId",
          poTotal: { $sum: "$totalAmount" },
          poCount: { $sum: 1 },
      } },
    ]);
    const byProject = new Map(poAgg.map((p) => [String(p._id), p]));

    const rows = projects.map((p) => {
      const po = byProject.get(String(p._id)) || { poTotal: 0, poCount: 0 };
      const budget = Number(p.budget) || 0;
      const spend = Number(po.poTotal) || 0;
      const variance = budget - spend;
      const variancePct = budget > 0 ? Math.round((variance / budget) * 100) : 0;
      return {
        projectId: p._id,
        name: p.name,
        trackingId: p.trackingId,
        clientName: p.clientId?.name || "—",
        status: p.status,
        phase: p.phase,
        budget,
        spend,
        variance,
        variancePct,
        poCount: po.poCount,
        overBudget: budget > 0 && spend > budget,
      };
    }).sort((a, b) => Math.abs(b.variancePct) - Math.abs(a.variancePct));

    const totals = rows.reduce(
      (acc, r) => ({
        budget: acc.budget + r.budget,
        spend:  acc.spend  + r.spend,
        overBudgetCount: acc.overBudgetCount + (r.overBudget ? 1 : 0),
      }),
      { budget: 0, spend: 0, overBudgetCount: 0 }
    );

    res.json({
      totals: {
        ...totals,
        variance: totals.budget - totals.spend,
        variancePct: totals.budget > 0 ? Math.round(((totals.budget - totals.spend) / totals.budget) * 100) : 0,
      },
      projects: rows,
    });
  } catch (err) {
    console.error("[analytics.projectProfitability]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  gateAging,
  drawingReleaseSLA,
  designerUtilisation,
  vendorPerformance,
  projectProfitability,
};
