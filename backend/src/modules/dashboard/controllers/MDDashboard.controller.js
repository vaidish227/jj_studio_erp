/**
 * MD Dashboard — cross-module executive overview.
 *
 * Single endpoint that rolls up CRM funnel, Proposal pipeline, Project health,
 * and Profitability into one round-trip. Composes data from existing
 * aggregators / services — does not introduce a new data model.
 *
 * @route GET /api/md/dashboard/overview?period=week|month|quarter|all
 * @permission md.dashboard.read
 */

const Project = require("../../pms/models/Project.model");
const Task = require("../../pms/models/Task.model");
const ApprovalGate = require("../../pms/models/ApprovalGate.model");
const Approval = require("../../pms/models/Approval.model");
let User = null;
try { User = require("../../auth/models/user.model"); } catch (e) { /* optional */ }
let PurchaseOrder = null;
try { PurchaseOrder = require("../../pms/models/PurchaseOrder.model"); } catch (e) { /* optional */ }

const {
  startOfPeriod,
  previousPeriodWindow,
  classifyHealth,
  ACTIVE_STATUSES,
  TASK_DONE,
  DAY,
} = require("../../pms/controllers/DashboardOverview.controller");

const crmAggregates = require("../../crm/service/crmAggregates.service");
const proposalAggregates = require("../../proposal/service/proposalAggregates.service");

const PHASES = ["kickoff", "layout", "design", "procurement", "release", "execution", "handover"];
const HEALTHS = ["on_track", "at_risk", "blocked", "on_hold", "delayed"];

/**
 * Compose 12 ISO-week starts ending at the current week.
 */
function build12WeekStarts() {
  const now = Date.now();
  const starts = [];
  for (let i = 11; i >= 0; i -= 1) {
    starts.push(new Date(now - (i + 1) * 7 * DAY));
  }
  return starts;
}

/**
 * Aggregate PMS KPIs + project health + alerts in a single pass.
 */
async function buildPMSBlock(periodStart, prevWindow) {
  const now = new Date();

  const [activeProjectsRaw, openGates, pendingPdReviews] = await Promise.all([
    Project.find({ status: { $in: ACTIVE_STATUSES } })
      .select("name trackingId phase status progressPercent estimatedCompletionDate updatedAt clientId")
      .populate("clientId", "name")
      .lean(),
    ApprovalGate.find({ status: "open" }).select("projectId createdAt").lean(),
    Approval.countDocuments({ approverType: "principal_designer", status: "pending" }),
  ]);

  const openGatesByProject = new Map();
  for (const g of openGates) {
    const k = String(g.projectId);
    if (!openGatesByProject.has(k)) openGatesByProject.set(k, []);
    openGatesByProject.get(k).push(g);
  }

  const decorated = activeProjectsRaw.map((p) => ({
    ...p,
    health: classifyHealth(p, openGatesByProject),
  }));

  const healthCounts = Object.fromEntries(HEALTHS.map((h) => [h, 0]));
  for (const p of decorated) {
    if (healthCounts[p.health] !== undefined) healthCounts[p.health] += 1;
  }
  const projectHealth = {
    onTrack: healthCounts.on_track,
    atRisk:  healthCounts.at_risk,
    blocked: healthCounts.blocked,
    onHold:  healthCounts.on_hold,
    delayed: healthCounts.delayed,
    phaseDistribution: PHASES.map((phase) => ({
      phase,
      count: decorated.filter((p) => (p.phase || "kickoff") === phase).length,
    })),
  };

  const activeProjects = decorated.length;
  const onTrackPct = activeProjects > 0
    ? Math.round((projectHealth.onTrack / activeProjects) * 100)
    : 0;
  const delayedProjects = decorated.filter(
    (p) => p.estimatedCompletionDate && new Date(p.estimatedCompletionDate) < now,
  ).length;

  const topDelayed = decorated
    .filter((p) => p.estimatedCompletionDate && new Date(p.estimatedCompletionDate) < now)
    .map((p) => ({
      _id:        p._id,
      trackingId: p.trackingId,
      name:       p.name,
      clientName: p.clientId?.name || null,
      daysLate:   Math.max(1, Math.floor((now - new Date(p.estimatedCompletionDate)) / DAY)),
    }))
    .sort((a, b) => b.daysLate - a.daysLate)
    .slice(0, 5);

  // Previous-period deltas: compare active project count + delayed at the
  // start of the previous window vs now. Cheap heuristic — uses createdAt as
  // an "existed by" proxy. Good enough for trend indicators on KPI cards.
  const prevActive = await Project.countDocuments({
    status: { $in: ACTIVE_STATUSES },
    createdAt: { $lt: prevWindow.end },
  });

  return {
    projectHealth,
    alerts: {
      delayedCount:        delayedProjects,
      openGates:           openGates.length,
      pendingPdReviews,
      topDelayedProjects:  topDelayed,
    },
    kpis: {
      activeProjects:  { value: activeProjects, delta: activeProjects - prevActive },
      onTrackPct:      { value: onTrackPct,     delta: 0 },
      delayedProjects: { value: delayedProjects, delta: 0 },
    },
  };
}

/**
 * Profitability rollup — mirrors Analytics.projectProfitability but flat-returned
 * so the MD page only needs the top-5 variance + totals.
 */
async function buildProfitBlock() {
  if (!PurchaseOrder) {
    return {
      topVariance:           [],
      aggregateBudget:       0,
      aggregateSpend:        0,
      aggregateVariancePct:  0,
    };
  }

  const projects = await Project.find({})
    .select("name trackingId status budget clientId")
    .populate("clientId", "name")
    .lean();

  if (!projects.length) {
    return {
      topVariance:          [],
      aggregateBudget:      0,
      aggregateSpend:       0,
      aggregateVariancePct: 0,
    };
  }

  const projectIds = projects.map((p) => p._id);
  const poAgg = await PurchaseOrder.aggregate([
    { $match: { projectId: { $in: projectIds } } },
    { $group: { _id: "$projectId", poTotal: { $sum: "$totalAmount" } } },
  ]);
  const byProject = new Map(poAgg.map((p) => [String(p._id), p.poTotal || 0]));

  const rows = projects.map((p) => {
    const budget = Number(p.budget) || 0;
    const spend = Number(byProject.get(String(p._id))) || 0;
    const variance = budget - spend;
    const variancePct = budget > 0 ? Math.round((variance / budget) * 100) : 0;
    return {
      projectId:   p._id,
      name:        p.name,
      trackingId:  p.trackingId,
      clientName:  p.clientId?.name || "—",
      budget,
      spend,
      variance,
      variancePct,
    };
  });

  const aggregateBudget = rows.reduce((s, r) => s + r.budget, 0);
  const aggregateSpend  = rows.reduce((s, r) => s + r.spend,  0);
  const aggregateVariancePct = aggregateBudget > 0
    ? Math.round(((aggregateBudget - aggregateSpend) / aggregateBudget) * 100)
    : 0;

  const topVariance = [...rows]
    .filter((r) => r.budget > 0)
    .sort((a, b) => Math.abs(b.variancePct) - Math.abs(a.variancePct))
    .slice(0, 5);

  return {
    topVariance,
    aggregateBudget,
    aggregateSpend,
    aggregateVariancePct,
  };
}

/**
 * 12-week trend: leads, proposals sent, advances received, projects started.
 */
async function buildWeeklyTrend() {
  const weekStarts = build12WeekStarts();

  const [leadSeries, proposalSeries, projectStartsSeries] = await Promise.all([
    crmAggregates.getWeeklyLeadCounts(weekStarts),
    proposalAggregates.getWeeklyActivity(weekStarts),
    countProjectsStartedPerWeek(weekStarts),
  ]);

  return weekStarts.map((start, idx) => ({
    weekStart:       start.toISOString().slice(0, 10),
    label:           start.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    leads:           leadSeries[idx]?.count           || 0,
    proposalsSent:   proposalSeries[idx]?.sent        || 0,
    advances:        proposalSeries[idx]?.advances    || 0,
    projectsStarted: projectStartsSeries[idx]?.count
                   ?? proposalSeries[idx]?.projectsStarted
                   ?? 0,
  }));
}

async function countProjectsStartedPerWeek(weekStarts) {
  if (!weekStarts?.length) return [];
  const first = weekStarts[0];
  const docs = await Project.find({ createdAt: { $gte: first } }).select("createdAt").lean();
  return weekStarts.map((start, idx) => {
    const end = weekStarts[idx + 1] || new Date(start.getTime() + 7 * DAY);
    let count = 0;
    for (const d of docs) {
      const ts = new Date(d.createdAt).getTime();
      if (ts >= start.getTime() && ts < end.getTime()) count += 1;
    }
    return { weekStart: start, count };
  });
}

/**
 * Designer KPI / KRA rollup for the executive view.
 *
 * Mirrors DashboardOverview.getDesignerKRA exactly — same weighting
 * (0.45 on-time + 0.35 first-pass + 0.20 throughput, mapped to 0–5) and the
 * same throughput normalisation basis (team max across ALL task-assignees) —
 * so a designer's kraScore is identical on the MD dashboard and the PMS
 * leaderboard. We then keep only role === "designer" for display, and roll the
 * survivors up into a team summary.
 */
async function buildDesignerBlock(periodStart) {
  const ACTIVE = ["in_progress", "pending_review", "revision_requested", "not_started", "blocked"];

  const tasks = await Task.find({
    assignedTo: { $ne: null },
    $or: [
      { createdAt:   { $gte: periodStart } },
      { completedAt: { $gte: periodStart } },
      { approvedAt:  { $gte: periodStart } },
      { status: { $in: ACTIVE } },
    ],
  })
    .select("assignedTo status createdAt approvedAt completedAt dueDate revisionInstructions")
    .lean();

  const byUser = new Map();
  for (const t of tasks) {
    const key = String(t.assignedTo);
    if (!byUser.has(key)) {
      byUser.set(key, {
        userId: t.assignedTo, name: "—", role: "—",
        active: 0, done: 0, onTimeDone: 0, firstPassDone: 0, throughput: 0,
      });
    }
    const u = byUser.get(key);

    if (ACTIVE.includes(t.status)) u.active++;

    const endTs = t.completedAt || t.approvedAt;
    if (TASK_DONE.includes(t.status) && endTs && new Date(endTs) >= periodStart) {
      u.done++;
      u.throughput++;
      if (t.dueDate && new Date(endTs) <= new Date(t.dueDate)) u.onTimeDone++;
      if (!t.revisionInstructions) u.firstPassDone++;
    }
  }

  // Hydrate names + roles.
  if (User && byUser.size > 0) {
    const users = await User.find({ _id: { $in: [...byUser.keys()] } }).select("name role").lean();
    for (const u of users) {
      const entry = byUser.get(String(u._id));
      if (entry) { entry.name = u.name || entry.name; entry.role = u.role || entry.role; }
    }
  }

  // Normalise throughput across the whole assignee population (same basis as
  // the PMS leaderboard) so scores line up across screens.
  const maxThroughput = Math.max(1, ...[...byUser.values()].map((u) => u.throughput));

  // Designers only, with some activity in the window.
  const entries = [...byUser.values()].filter(
    (u) => (u.done > 0 || u.active > 0) && String(u.role || "").toLowerCase() === "designer",
  );

  const designers = entries
    .map((u) => {
      const onTimeRate    = u.done > 0 ? u.onTimeDone / u.done : 0;
      const firstPassRate = u.done > 0 ? u.firstPassDone / u.done : 0;
      const throughputNorm = u.throughput / maxThroughput;
      const score = 0.45 * onTimeRate + 0.35 * firstPassRate + 0.20 * throughputNorm;
      return {
        userId:         u.userId,
        name:           u.name,
        role:           u.role,
        active:         u.active,
        done:           u.done,
        onTimePct:      Math.round(onTimeRate * 100),
        firstPassPct:   Math.round(firstPassRate * 100),
        throughputNorm: Math.round(throughputNorm * 100),
        kraScore:       Math.round(score * 5 * 10) / 10, // 0–5, 1 decimal
      };
    })
    .sort((a, b) => b.kraScore - a.kraScore);

  // Team summary — weighted by raw counts (not an average of percentages).
  const delivered     = entries.reduce((s, u) => s + u.done, 0);
  const onTimeTotal    = entries.reduce((s, u) => s + u.onTimeDone, 0);
  const firstPassTotal = entries.reduce((s, u) => s + u.firstPassDone, 0);
  const avgKraScore = designers.length
    ? Math.round((designers.reduce((s, d) => s + d.kraScore, 0) / designers.length) * 10) / 10
    : 0;

  return {
    summary: {
      onTimePct:       delivered > 0 ? Math.round((onTimeTotal / delivered) * 100) : 0,
      firstPassPct:    delivered > 0 ? Math.round((firstPassTotal / delivered) * 100) : 0,
      delivered,
      activeDesigners: entries.filter((u) => u.active > 0).length,
      avgKraScore,
    },
    designers,
  };
}

const getMDOverview = async (req, res) => {
  try {
    const period = String(req.query.period || "month").toLowerCase();
    const validPeriod = ["week", "month", "quarter", "all"].includes(period) ? period : "month";
    const periodStart = startOfPeriod(validPeriod);
    const prevWindow  = previousPeriodWindow(validPeriod);

    const [crmBlock, pmsBlock, proposalBlock, profitBlock, weeklyTrend, designerBlock] = await Promise.all([
      crmAggregates.getFunnelAndKpis(periodStart, prevWindow),
      buildPMSBlock(periodStart, prevWindow),
      proposalAggregates.getStatusCountsAndCashflow(periodStart, prevWindow),
      buildProfitBlock(),
      buildWeeklyTrend(),
      buildDesignerBlock(periodStart),
    ]);

    res.status(200).json({
      period: validPeriod,
      executiveKpis: {
        totalLeads:            crmBlock.kpis.totalLeads,
        activePipeline:        crmBlock.kpis.activePipeline,
        conversionRate:        crmBlock.kpis.conversionRate,
        proposalsSent:         proposalBlock.kpis.proposalsSent,
        advanceReceivedAmount: proposalBlock.kpis.advanceReceivedAmount,
        activeProjects:        pmsBlock.kpis.activeProjects,
        onTrackPct:            pmsBlock.kpis.onTrackPct,
        delayedProjects:       pmsBlock.kpis.delayedProjects,
        openProfitVariancePct: { value: profitBlock.aggregateVariancePct },
      },
      crmFunnel: crmBlock.funnel,
      proposalPipeline: {
        byStatus:                  proposalBlock.byStatus,
        totalValueOpen:            proposalBlock.totalValueOpen,
        advanceReceivedThisPeriod: proposalBlock.advanceReceivedThisPeriod,
      },
      projectHealth: pmsBlock.projectHealth,
      profitability: profitBlock,
      alerts: {
        delayedCount:               pmsBlock.alerts.delayedCount,
        openGates:                  pmsBlock.alerts.openGates,
        pendingPdReviews:           pmsBlock.alerts.pendingPdReviews,
        proposalsAwaitingApproval:  proposalBlock.proposalsAwaitingApproval,
        topDelayedProjects:         pmsBlock.alerts.topDelayedProjects,
      },
      weeklyTrend,
      designerPerformance: designerBlock,
    });
  } catch (err) {
    console.error("[md.dashboard.overview]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getMDOverview,
};
