/**
 * DashboardOverview.controller — Operational PMS Dashboard.
 *
 * Single endpoint that aggregates everything the /pms/dashboard page needs
 * into one round-trip. Reads from existing PMS collections — no schema changes.
 *
 * @route GET /api/pms/dashboard/overview?period=week|month|quarter|all
 * @permission projects.read
 */

const Project = require("../models/Project.model");
const Task = require("../models/Task.model");
const Drawing = require("../models/Drawing.model");
const Approval = require("../models/Approval.model");
const ApprovalGate = require("../models/ApprovalGate.model");
const PMSActivityLog = require("../models/PMSActivityLog.model");
let User = null; try { User = require("../../auth/models/user.model"); } catch (e) { /* optional */ }

const DAY = 86400000;
const ACTIVE_STATUSES = ["design_phase", "execution_phase"];
const TASK_DONE = ["approved", "released_to_site", "completed"];

const PERIOD_DAYS = { week: 7, month: 30, quarter: 90, all: 3650 };

const startOfPeriod = (period) => {
  const days = PERIOD_DAYS[period] ?? PERIOD_DAYS.month;
  return new Date(Date.now() - days * DAY);
};

const previousPeriodWindow = (period) => {
  const days = PERIOD_DAYS[period] ?? PERIOD_DAYS.month;
  const now = Date.now();
  return {
    start: new Date(now - 2 * days * DAY),
    end:   new Date(now - days * DAY),
  };
};

/**
 * Derive a per-project health label from gate openness + ETA + status.
 * - on_hold      → Project.status === "on_hold"
 * - blocked      → has any ApprovalGate.status === "open" older than 7 days
 * - at_risk      → ETA within 14 days AND progressPercent < 75
 * - on_track     → otherwise
 */
function classifyHealth(project, openGatesByProject) {
  if (project.status === "on_hold") return "on_hold";

  const gates = openGatesByProject.get(String(project._id)) || [];
  const now = Date.now();
  const hasStaleGate = gates.some(
    (g) => now - new Date(g.createdAt).getTime() > 7 * DAY
  );
  if (hasStaleGate) return "blocked";

  if (project.estimatedCompletionDate) {
    const daysToEta = (new Date(project.estimatedCompletionDate) - now) / DAY;
    if (daysToEta < 14 && (project.progressPercent || 0) < 75) return "at_risk";
  }
  return "on_track";
}

const getOverview = async (req, res) => {
  try {
    const period = String(req.query.period || "month").toLowerCase();
    const validPeriod = ["week", "month", "quarter", "all"].includes(period) ? period : "month";
    const periodStart = startOfPeriod(validPeriod);
    const prevWindow = previousPeriodWindow(validPeriod);
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * DAY);

    // ── 1. Active projects + phase distribution + health classification ──────
    const activeProjectsRaw = await Project.find({ status: { $in: ACTIVE_STATUSES } })
      .select("name trackingId phase status progressPercent startDate estimatedCompletionDate updatedAt primaryDesigner")
      .lean();

    const allOpenGates = await ApprovalGate.find({ status: "open" })
      .select("projectId createdAt approverType")
      .lean();

    const openGatesByProject = new Map();
    for (const g of allOpenGates) {
      const k = String(g.projectId);
      if (!openGatesByProject.has(k)) openGatesByProject.set(k, []);
      openGatesByProject.get(k).push(g);
    }

    const decoratedProjects = activeProjectsRaw.map((p) => ({
      ...p,
      health: classifyHealth(p, openGatesByProject),
      blockedByCount: (openGatesByProject.get(String(p._id)) || []).length,
    }));

    // KPI: on-track / at-risk / blocked / on-hold counts.
    const projectHealth = { onTrack: 0, atRisk: 0, blocked: 0, onHold: 0 };
    for (const p of decoratedProjects) {
      if      (p.health === "on_track") projectHealth.onTrack++;
      else if (p.health === "at_risk")  projectHealth.atRisk++;
      else if (p.health === "blocked")  projectHealth.blocked++;
      else if (p.health === "on_hold")  projectHealth.onHold++;
    }

    // Phase distribution — always emit all 7 phase keys so chart legend is stable.
    const PHASES = ["kickoff", "layout", "design", "procurement", "release", "execution", "handover"];
    const phaseCounts = Object.fromEntries(PHASES.map((p) => [p, 0]));
    for (const p of decoratedProjects) {
      const ph = p.phase || "kickoff";
      if (phaseCounts[ph] !== undefined) phaseCounts[ph]++;
    }
    const phaseDistribution = PHASES.map((phase) => ({ phase, count: phaseCounts[phase] }));

    // ── 2. KPI values ──────────────────────────────────────────────────────
    const activeProjectsCount = decoratedProjects.length;
    const onTrackPct = activeProjectsCount > 0
      ? Math.round((projectHealth.onTrack / activeProjectsCount) * 100)
      : 0;
    const delayedCount = decoratedProjects.filter(
      (p) => p.estimatedCompletionDate && new Date(p.estimatedCompletionDate) < now
    ).length;

    const openGatesCount = allOpenGates.length;

    const pendingPdReviews = await Approval.countDocuments({
      approverType: "principal_designer",
      status: "pending",
    });

    const releasedThisPeriod = await Drawing.countDocuments({
      isReleased: true,
      releasedAt: { $gte: periodStart, $lte: now },
    });

    // ── Trend deltas vs previous identical-length window ──────────────────
    const releasedPrevious = await Drawing.countDocuments({
      isReleased: true,
      releasedAt: { $gte: prevWindow.start, $lt: prevWindow.end },
    });
    // For active/on-track/delayed/gates — only the released count has historical
    // signal (others are point-in-time). We synthesise simple deltas where it
    // makes sense: gates trend = -1 * net change in open gates over the period.
    const trends = {
      activeProjects:   null,
      onTrackPct:       null,
      delayedCount:     null,
      openGates:        null,
      pendingPdReviews: null,
      releasedThisPeriod: releasedThisPeriod - releasedPrevious,
    };

    // ── 3. Top active projects for the Gantt-style timeline ────────────────
    const activeProjects = [...decoratedProjects]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 8)
      .map((p) => ({
        _id:                     p._id,
        trackingId:              p.trackingId,
        name:                    p.name,
        phase:                   p.phase,
        status:                  p.status,
        progressPercent:         p.progressPercent || 0,
        startDate:               p.startDate,
        estimatedCompletionDate: p.estimatedCompletionDate,
        health:                  p.health,
        blockedByCount:          p.blockedByCount,
      }));

    // ── 4. Designer utilisation — same logic as Analytics.designerUtilisation
    //     but bounded to top 6 with active tasks.
    const tasks = await Task.find({ assignedTo: { $ne: null } })
      .select("assignedTo status createdAt approvedAt completedAt")
      .lean();

    const byUser = new Map();
    for (const t of tasks) {
      const key = String(t.assignedTo);
      if (!byUser.has(key)) byUser.set(key, {
        userId: t.assignedTo,
        name: "—",
        role: "—",
        total: 0, completed: 0, activeTasks: 0, blockedTasks: 0,
      });
      const u = byUser.get(key);
      u.total++;
      if (TASK_DONE.includes(t.status)) u.completed++;
      else if (t.status === "blocked") { u.blockedTasks++; u.activeTasks++; }
      else u.activeTasks++;
    }
    if (User && byUser.size > 0) {
      const userIds = [...byUser.keys()];
      const users = await User.find({ _id: { $in: userIds } }).select("name role").lean();
      for (const u of users) {
        const entry = byUser.get(String(u._id));
        if (entry) {
          entry.name = u.name || entry.name;
          entry.role = u.role || entry.role;
        }
      }
    }
    const designerUtilisation = [...byUser.values()]
      .map((u) => ({
        ...u,
        completionRate: u.total > 0 ? Math.round((u.completed / u.total) * 100) : 0,
      }))
      .filter((u) => u.total > 0)
      .sort((a, b) => b.activeTasks - a.activeTasks)
      .slice(0, 6);

    // ── 5. Gate aging buckets ─────────────────────────────────────────────
    const gateAgingBuckets = [
      { label: "0–3 days",   count: 0, tone: "success" },
      { label: "4–7 days",   count: 0, tone: "warning" },
      { label: "8–14 days",  count: 0, tone: "error"   },
      { label: "15+ days",   count: 0, tone: "danger"  },
    ];
    for (const g of allOpenGates) {
      const days = Math.max(0, Math.floor((Date.now() - new Date(g.createdAt).getTime()) / DAY));
      if      (days <= 3)  gateAgingBuckets[0].count++;
      else if (days <= 7)  gateAgingBuckets[1].count++;
      else if (days <= 14) gateAgingBuckets[2].count++;
      else                 gateAgingBuckets[3].count++;
    }

    // ── 6. Recent activity feed (last 10) ─────────────────────────────────
    const recentActivityRaw = await PMSActivityLog.find({})
      .populate("actorId", "name")
      .populate("projectId", "name trackingId")
      .select("entityType entityId action description createdAt actorId projectId")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const recentActivity = recentActivityRaw.map((a) => ({
      _id:         a._id,
      actorName:   a.actorId?.name || "—",
      action:      a.action,
      entityType:  a.entityType,
      description: a.description,
      projectId:   a.projectId?._id,
      projectName: a.projectId?.name,
      trackingId:  a.projectId?.trackingId,
      createdAt:   a.createdAt,
    }));

    // ── 7. Upcoming milestones — tasks due in the next 7 days ─────────────
    const upcomingMilestones = await Task.find({
      dueDate: { $gte: now, $lte: in7Days },
      status: { $nin: [...TASK_DONE] },
    })
      .populate("projectId", "name trackingId")
      .select("title taskType status dueDate projectId")
      .sort({ dueDate: 1 })
      .limit(10)
      .lean();

    const upcomingMilestonesShaped = upcomingMilestones.map((t) => ({
      _id:         t._id,
      title:       t.title,
      taskType:    t.taskType,
      status:      t.status,
      dueDate:     t.dueDate,
      projectId:   t.projectId?._id,
      projectName: t.projectId?.name,
      trackingId:  t.projectId?.trackingId,
    }));

    res.status(200).json({
      period: validPeriod,
      kpis: {
        activeProjects:     activeProjectsCount,
        onTrackPct,
        delayedCount,
        openGates:          openGatesCount,
        pendingPdReviews,
        releasedThisPeriod,
        trends,
      },
      phaseDistribution,
      projectHealth,
      activeProjects,
      designerUtilisation,
      gateAging: {
        buckets: gateAgingBuckets,
        total: allOpenGates.length,
      },
      recentActivity,
      upcomingMilestones: upcomingMilestonesShaped,
    });
  } catch (err) {
    console.error("[dashboard.overview]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getOverview };
