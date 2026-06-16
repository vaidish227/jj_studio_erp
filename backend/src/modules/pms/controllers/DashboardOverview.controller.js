/**
 * DashboardOverview.controller — Operational PMS Dashboard.
 *
 * Single endpoint that aggregates everything the /pms/dashboard page needs
 * into one round-trip. Reads from existing PMS collections — no schema changes.
 *
 * @route GET /api/pms/dashboard/overview?period=week|month|quarter|all
 * @route GET /api/pms/dashboard/designer-kra?period=...
 * @permission projects.read
 */

const Project = require("../models/Project.model");
const Task = require("../models/Task.model");
const Drawing = require("../models/Drawing.model");
const Approval = require("../models/Approval.model");
const ApprovalGate = require("../models/ApprovalGate.model");
const PMSActivityLog = require("../models/PMSActivityLog.model");
let User = null; try { User = require("../../auth/models/user.model"); } catch (e) { /* optional */ }
let VendorEngagement = null; try { VendorEngagement = require("../models/VendorEngagement.model"); } catch (e) { /* optional */ }
const { generateDesignerReportPdfBuffer } = require("../services/designerReportPdf");
const { resolveDateRange, DateRangeError } = require("../../../shared/dateRange/resolveDateRange");

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

// ── Dashboard date-range resolution (overview + designer-kra only) ───────────
// Adopts the shared resolveDateRange while keeping the legacy ?period vocabulary
// working. NOTE: startOfPeriod/previousPeriodWindow above are intentionally kept
// for the adjacent endpoints (analytics, designer detail, reports) which are NOT
// part of this migration.
const LEGACY_PERIOD_TO_PRESET = { week: "last_7_days", month: "last_30_days" };
const LEGACY_PERIOD_DAYS = { quarter: 90, all: 3650 };

const istDateString = (ms) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(ms));

/**
 * Resolve dashboard query → { start, end, prevStart, prevEnd, label }.
 *   New:    ?preset=… | ?from=&to=
 *   Legacy: ?period=week|month|quarter|all  (week/month → presets; quarter/all → rolling custom)
 *   Default: last_30_days (≈ old "month")
 * @throws {DateRangeError}
 */
function resolveRequestRange(query) {
  const preset = query.preset != null ? String(query.preset).toLowerCase() : null;
  const from = query.from != null ? String(query.from) : null;
  const to = query.to != null ? String(query.to) : null;
  const period = query.period != null ? String(query.period).toLowerCase() : null;

  if (preset || from || to) {
    const r = resolveDateRange({ preset, from, to });
    return { ...r, label: r.preset };
  }
  if (period && LEGACY_PERIOD_TO_PRESET[period]) {
    const r = resolveDateRange({ preset: LEGACY_PERIOD_TO_PRESET[period] });
    return { ...r, label: period };
  }
  if (period && LEGACY_PERIOD_DAYS[period]) {
    const days = LEGACY_PERIOD_DAYS[period];
    const now = Date.now();
    const r = resolveDateRange({ from: istDateString(now - (days - 1) * DAY), to: istDateString(now) });
    return { ...r, label: period };
  }
  const r = resolveDateRange({ preset: "last_30_days" });
  return { ...r, label: r.preset };
}

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
    const eta = new Date(project.estimatedCompletionDate).getTime();
    if (eta < now) return "delayed";
    const daysToEta = (eta - now) / DAY;
    if (daysToEta < 14 && (project.progressPercent || 0) < 75) return "at_risk";
  }
  return "on_track";
}

// Shape the active-project record for the new ProjectHealthGrid card.
function shapeProjectCard(p) {
  // Pick a lead designer from assignments — prefer a row whose responsibility
  // slug looks like a lead/designer role; otherwise take the first user.
  let leadDesigner = null;
  const teamUsers = [];
  for (const row of p.assignments || []) {
    for (const u of (row.users || [])) {
      if (u && !teamUsers.find((x) => String(x._id) === String(u._id))) {
        teamUsers.push({ _id: u._id, name: u.name });
      }
    }
    const slug = (row.responsibilityId?.slug || row.customName || "").toLowerCase();
    if (!leadDesigner && (slug.includes("lead") || slug.includes("primary"))) {
      leadDesigner = row.users?.[0] || null;
    }
  }
  if (!leadDesigner && teamUsers.length > 0) leadDesigner = teamUsers[0];

  return {
    _id:                     p._id,
    trackingId:              p.trackingId,
    name:                    p.name,
    phase:                   p.phase,
    status:                  p.status,
    projectType:             p.projectType,
    area:                    p.area,
    city:                    p.siteAddress?.city || p.siteAddress?.fullAddress || null,
    clientName:              p.clientId?.name || null,
    progressPercent:         p.progressPercent || 0,
    startDate:               p.startDate,
    estimatedCompletionDate: p.estimatedCompletionDate,
    health:                  p.health,
    blockedByCount:          p.blockedByCount,
    team:                    teamUsers.slice(0, 5),
    leadDesignerName:        leadDesigner?.name || null,
  };
}

const HEALTH_RANK = { delayed: 0, blocked: 1, at_risk: 2, on_hold: 3, on_track: 4 };

const PRIVILEGED_ROLES = ["admin", "md", "manager"];
const isPrivilegedRole = (user) =>
  PRIVILEGED_ROLES.includes(String(user?.role || "").toLowerCase());

/**
 * Attach `blockers[]` + `overdueTaskCount` + `estimatedCompletionDate` to each
 * delayed-project object in-place.
 *
 * Cost: one Task.find + one User.find — independent of project count.
 *
 * Privileged roles (admin/md/manager) see full blocker attribution; everyone
 * else gets `blockers: []` so the response shape stays stable.
 */
async function attachBlockersToDelayedProjects(delayedProjects, decoratedProjects, now, user) {
  if (!delayedProjects.length) return;

  // Always copy ETA — needed by the project-detail banner regardless of role.
  const projectById = new Map(decoratedProjects.map((p) => [String(p._id), p]));
  for (const dp of delayedProjects) {
    const src = projectById.get(String(dp._id));
    if (src) dp.estimatedCompletionDate = src.estimatedCompletionDate;
    dp.blockers = [];
    dp.overdueTaskCount = 0;
  }

  if (!isPrivilegedRole(user)) return;

  const delayedIds = delayedProjects.map((p) => p._id);
  const overdueTasks = await Task.find({
    projectId: { $in: delayedIds },
    dueDate:   { $lt: now },
    status:    { $nin: [...TASK_DONE, "blocked"] },
    assignedTo: { $ne: null },
  })
    .select("projectId assignedTo dueDate title status")
    .lean();

  if (!overdueTasks.length) return;

  const userIds = [...new Set(overdueTasks.map((t) => String(t.assignedTo)))];
  const userById = new Map();
  if (User && userIds.length) {
    const users = await User.find({ _id: { $in: userIds } }).select("name role").lean();
    for (const u of users) userById.set(String(u._id), u);
  }

  // projectId -> userId -> responsibilityLabel (derived from project.assignments)
  const projectRespByUser = new Map();
  for (const p of decoratedProjects) {
    const m = new Map();
    for (const row of p.assignments || []) {
      const label = row.customName
        || (row.responsibilityId?.slug
            ? row.responsibilityId.slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
            : null);
      for (const u of (row.users || [])) {
        const uid = String(u._id || u);
        if (label && !m.has(uid)) m.set(uid, label);
      }
    }
    projectRespByUser.set(String(p._id), m);
  }

  // projectId -> userId -> { count, oldestDueDate, oldestTaskTitle }
  const buckets = new Map();
  for (const t of overdueTasks) {
    const pid = String(t.projectId);
    const uid = String(t.assignedTo);
    if (!buckets.has(pid)) buckets.set(pid, new Map());
    const inner = buckets.get(pid);
    if (!inner.has(uid)) {
      inner.set(uid, { count: 0, oldestDueDate: t.dueDate, oldestTaskTitle: t.title });
    }
    const agg = inner.get(uid);
    agg.count++;
    if (new Date(t.dueDate) < new Date(agg.oldestDueDate)) {
      agg.oldestDueDate   = t.dueDate;
      agg.oldestTaskTitle = t.title;
    }
  }

  for (const dp of delayedProjects) {
    const pid = String(dp._id);
    const inner = buckets.get(pid) || new Map();
    const blockers = [...inner.entries()]
      .map(([uid, agg]) => {
        const u = userById.get(uid) || {};
        return {
          userId:           uid,
          name:             u.name || "Unknown",
          role:             u.role || null,
          responsibility:   projectRespByUser.get(pid)?.get(uid) || null,
          overdueTaskCount: agg.count,
          oldestDueDate:    agg.oldestDueDate,
          oldestTaskTitle:  agg.oldestTaskTitle,
        };
      })
      .sort((a, b) =>
        (b.overdueTaskCount - a.overdueTaskCount)
        || (new Date(a.oldestDueDate) - new Date(b.oldestDueDate)))
      .slice(0, 3);

    dp.blockers         = blockers;
    dp.overdueTaskCount = [...inner.values()].reduce((s, x) => s + x.count, 0);
  }
}

const getOverview = async (req, res) => {
  try {
    const { start, end, prevStart, prevEnd, label } = resolveRequestRange(req.query);
    const prevWindow = { start: prevStart, end: prevEnd };
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * DAY);

    // ── 1. Active projects + phase distribution + health classification ──────
    const activeProjectsRaw = await Project.find({ status: { $in: ACTIVE_STATUSES } })
      .select("name trackingId phase status progressPercent startDate estimatedCompletionDate updatedAt assignments projectType area siteAddress clientId")
      .populate("assignments.responsibilityId", "slug")
      .populate("assignments.users", "name")
      .populate("clientId", "name")
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
    const projectHealth = { onTrack: 0, atRisk: 0, blocked: 0, onHold: 0, delayed: 0 };
    for (const p of decoratedProjects) {
      if      (p.health === "on_track") projectHealth.onTrack++;
      else if (p.health === "at_risk")  projectHealth.atRisk++;
      else if (p.health === "blocked")  projectHealth.blocked++;
      else if (p.health === "on_hold")  projectHealth.onHold++;
      else if (p.health === "delayed")  projectHealth.delayed++;
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
      releasedAt: { $gte: start, $lte: end },
    });

    // ── Trend deltas vs previous identical-length window ──────────────────
    const releasedPrevious = await Drawing.countDocuments({
      isReleased: true,
      releasedAt: { $gte: prevWindow.start, $lt: prevWindow.end },
    });
    const trends = {
      activeProjects:   null,
      onTrackPct:       null,
      delayedCount:     null,
      openGates:        null,
      pendingPdReviews: null,
      releasedThisPeriod: releasedThisPeriod - releasedPrevious,
    };

    // ── 3a. Active projects (Gantt timeline — top 8 by recent activity) ────
    const activeProjects = [...decoratedProjects]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 8)
      .map(shapeProjectCard);

    // ── 3b. Project Health Grid — sorted delayed → blocked → at_risk → ─────
    //       on_hold → on_track. Top 6 worst-health surface to the dashboard.
    const projectHealthGrid = [...decoratedProjects]
      .sort((a, b) => {
        const rA = HEALTH_RANK[a.health] ?? 99;
        const rB = HEALTH_RANK[b.health] ?? 99;
        if (rA !== rB) return rA - rB;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      })
      .slice(0, 6)
      .map(shapeProjectCard);

    // ── 3c. Delayed projects (for the red alert banner) ────────────────────
    const delayedProjects = decoratedProjects
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

    await attachBlockersToDelayedProjects(delayedProjects, decoratedProjects, now, req.user);

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

    // ── 8. Pending My Approval — items awaiting current user's sign-off ──
    const pendingMyApproval = await buildPendingMyApproval(req.user);

    // ── 9. Weekly trend — fuel for the dashboard sparkline cards ─────────────
    //     12 weeks of completed-task counts, split by on-time vs delayed.
    const weeklyTrend = await buildWeeklyTrend();

    res.status(200).json({
      period: label,
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
      projectHealthGrid,
      delayedProjects,
      designerUtilisation,
      gateAging: {
        buckets: gateAgingBuckets,
        total: allOpenGates.length,
      },
      recentActivity,
      upcomingMilestones: upcomingMilestonesShaped,
      pendingMyApproval,
      weeklyTrend,
    });
  } catch (err) {
    if (err instanceof DateRangeError) {
      return res.status(400).json({ error: err.code, message: err.message });
    }
    console.error("[dashboard.overview]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Build 12-week trend of completed tasks split by on-time vs delayed.
 * Drives the dashboard's "Delivery Trend" sparkline cards (Phase D).
 *
 * Returns: [{ weekStart, label, delivered, onTime, delayed, onTimePct }, ...]
 *   weekStart: ISO date of the week's first day
 *   delivered: tasks where status is in TASK_DONE and (completedAt|approvedAt) falls in the week
 *   onTime:    delivered AND endTs <= dueDate
 *   delayed:   delivered AND (no dueDate OR endTs > dueDate). The "no due date"
 *              bucket is treated as on-time for the percentage but still counted
 *              in delivered.
 */
async function buildWeeklyTrend() {
  const now = Date.now();
  const lookback = new Date(now - 12 * 7 * DAY);
  const tasks = await Task.find({
    status: { $in: TASK_DONE },
    $or: [
      { completedAt: { $gte: lookback } },
      { approvedAt:  { $gte: lookback } },
    ],
  })
    .select("status completedAt approvedAt dueDate")
    .lean();

  const weeks = [];
  for (let i = 11; i >= 0; i -= 1) {
    const start = new Date(now - (i + 1) * 7 * DAY);
    const end   = new Date(now - i * 7 * DAY);
    let delivered = 0, onTime = 0, delayed = 0;
    for (const t of tasks) {
      const endTs = t.completedAt || t.approvedAt;
      if (!endTs) continue;
      const ts = new Date(endTs).getTime();
      if (ts < start.getTime() || ts >= end.getTime()) continue;
      delivered++;
      if (t.dueDate && new Date(endTs) > new Date(t.dueDate)) delayed++;
      else onTime++;
    }
    weeks.push({
      weekStart: start.toISOString().slice(0, 10),
      label:     start.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      delivered,
      onTime,
      delayed,
      onTimePct: delivered > 0 ? Math.round((onTime / delivered) * 100) : null,
    });
  }
  return weeks;
}

/**
 * Pending My Approval — surfaces 10 items the current user can act on:
 *   • Drawings in sent_for_approval (top 4)
 *   • Tasks in pending_review (top 3)
 *   • Vendor engagements in quoted/po_emitted awaiting client/MD approval (top 3)
 *
 * MD + manager see ALL pending items; other roles see only items where they're
 * the explicit assignee/reviewer. Bounded to keep payload small.
 */
async function buildPendingMyApproval(user) {
  if (!user) return [];
  const isPrivileged = ["admin", "md", "manager"].includes(String(user.role || "").toLowerCase());
  const out = [];

  // 1. Drawings sent for approval
  const drawingsQ = { status: "sent_for_approval" };
  const drawings = await Drawing.find(drawingsQ)
    .populate("projectId", "name trackingId")
    .populate("uploadedBy", "name")
    .select("title drawingType updatedAt projectId uploadedBy")
    .sort({ updatedAt: 1 })
    .limit(isPrivileged ? 4 : 8)
    .lean();
  for (const d of drawings) {
    out.push({
      kind:        "drawing",
      _id:         d._id,
      title:       d.title,
      subtitle:    [d.uploadedBy?.name, d.projectId?.name].filter(Boolean).join(" · "),
      projectId:   d.projectId?._id,
      projectName: d.projectId?.name,
      trackingId:  d.projectId?.trackingId,
      ageMs:       Date.now() - new Date(d.updatedAt).getTime(),
      link:        `/projects/${d.projectId?._id}?tab=drawings`,
    });
  }

  // 2. Tasks pending_review (privileged users only — designers wouldn't approve)
  if (isPrivileged) {
    const reviewTasks = await Task.find({ status: "pending_review" })
      .populate("projectId", "name trackingId")
      .populate("assignedTo", "name")
      .select("title taskType submittedAt projectId assignedTo")
      .sort({ submittedAt: 1 })
      .limit(3)
      .lean();
    for (const t of reviewTasks) {
      out.push({
        kind:        "task",
        _id:         t._id,
        title:       t.title,
        subtitle:    [t.assignedTo?.name, t.projectId?.name].filter(Boolean).join(" · "),
        projectId:   t.projectId?._id,
        projectName: t.projectId?.name,
        trackingId:  t.projectId?.trackingId,
        ageMs:       Date.now() - new Date(t.submittedAt || t.updatedAt).getTime(),
        link:        `/tasks/${t._id}`,
      });
    }
  }

  // 3. Vendor engagements waiting for client/MD approval after quote
  if (VendorEngagement && isPrivileged) {
    const engs = await VendorEngagement.find({ status: "quoted" })
      .populate("projectId", "name trackingId")
      .populate("vendorId", "name")
      .select("vendorKind status updatedAt projectId vendorId currentQuoteAmount")
      .sort({ updatedAt: 1 })
      .limit(3)
      .lean();
    for (const e of engs) {
      const amount = Number(e.currentQuoteAmount) || 0;
      out.push({
        kind:        "vendor",
        _id:         e._id,
        title:       `${e.vendorKind?.toUpperCase() || "Vendor"} Quotation${amount > 0 ? ` — ₹${amount.toLocaleString("en-IN")}` : ""}`,
        subtitle:    [e.vendorId?.name, e.projectId?.name].filter(Boolean).join(" · "),
        projectId:   e.projectId?._id,
        projectName: e.projectId?.name,
        trackingId:  e.projectId?.trackingId,
        ageMs:       Date.now() - new Date(e.updatedAt).getTime(),
        link:        `/projects/${e.projectId?._id}?tab=vendors`,
      });
    }
  }

  // Sort oldest first (most aged at top) and cap to 10
  return out.sort((a, b) => b.ageMs - a.ageMs).slice(0, 10);
}

/**
 * Designer KPI / KRA Scoreboard.
 *
 * KRA score = 0.45 × on-time-rate + 0.35 × first-pass-approval-rate + 0.20 × throughput-norm
 * mapped to a 0-5 scale.
 *
 * @route GET /api/pms/dashboard/designer-kra?period=week|month|quarter|all
 */
const getDesignerKRA = async (req, res) => {
  try {
    const { start: periodStart, end: periodEnd, label } = resolveRequestRange(req.query);

    // Pull tasks within the window (by createdAt OR completedAt/approvedAt — we need
    // both active tasks and tasks completed during the window). The date branches are
    // bounded purely to narrow the fetch; the authoritative "done in window" gate is
    // in JS below. The active-status branch stays date-unbounded (current in-flight).
    const tasks = await Task.find({
      assignedTo: { $ne: null },
      $or: [
        { createdAt:   { $gte: periodStart, $lte: periodEnd } },
        { completedAt: { $gte: periodStart, $lte: periodEnd } },
        { approvedAt:  { $gte: periodStart, $lte: periodEnd } },
        { status: { $in: ["in_progress", "pending_review", "revision_requested", "not_started", "blocked"] } },
      ],
    })
      .select("assignedTo status createdAt approvedAt completedAt dueDate reassignedFrom revisionInstructions")
      .lean();

    const byUser = new Map();
    for (const t of tasks) {
      const key = String(t.assignedTo);
      if (!byUser.has(key)) byUser.set(key, {
        userId: t.assignedTo,
        name: "—",
        role: "—",
        active: 0,           // in_progress + pending_review + revision_requested + not_started
        done: 0,             // TASK_DONE within period
        onTimeDone: 0,       // done where completedAt/approvedAt <= dueDate
        firstPassDone: 0,    // done without any revision (no revisionInstructions ever set)
        throughput: 0,       // = done count (used for normalisation)
      });
      const u = byUser.get(key);

      // Active bucket
      if (["in_progress", "pending_review", "revision_requested", "not_started", "blocked"].includes(t.status)) {
        u.active++;
      }

      // Done bucket — only count completions in the period
      const endTs = t.completedAt || t.approvedAt;
      if (TASK_DONE.includes(t.status) && endTs && new Date(endTs) >= periodStart && new Date(endTs) <= periodEnd) {
        u.done++;
        u.throughput++;
        // On-time check
        if (t.dueDate && new Date(endTs) <= new Date(t.dueDate)) {
          u.onTimeDone++;
        }
        // First-pass approval — no revision ever requested
        if (!t.revisionInstructions) {
          u.firstPassDone++;
        }
      }
    }

    // Hydrate names + roles
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

    // Throughput normalisation — divide by team max so the highest delivery
    // scores 1.0 and the rest scale linearly.
    const maxThroughput = Math.max(1, ...[...byUser.values()].map((u) => u.throughput));

    const designers = [...byUser.values()]
      // Only include designers/supervisors — skip admins/managers from the leaderboard
      .filter((u) => {
        if (u.done === 0 && u.active === 0) return false;
        const r = String(u.role || "").toLowerCase();
        return ["designer", "supervisor", "contractor", "primary_designer", "—"].includes(r);
      })
      .map((u) => {
        const onTimeRate    = u.done > 0 ? u.onTimeDone / u.done : 0;
        const firstPassRate = u.done > 0 ? u.firstPassDone / u.done : 0;
        const throughputNorm = u.throughput / maxThroughput;
        const score = 0.45 * onTimeRate + 0.35 * firstPassRate + 0.20 * throughputNorm;
        const kraScore = Math.round(score * 5 * 10) / 10; // 0–5 with 1 decimal

        return {
          userId:         u.userId,
          name:           u.name,
          role:           u.role,
          active:         u.active,
          done:           u.done,
          onTimePct:      Math.round(onTimeRate * 100),
          firstPassPct:   Math.round(firstPassRate * 100),
          throughputNorm: Math.round(throughputNorm * 100),
          kraScore,
        };
      })
      .sort((a, b) => b.kraScore - a.kraScore);

    res.status(200).json({ period: label, designers });
  } catch (err) {
    if (err instanceof DateRangeError) {
      return res.status(400).json({ error: err.code, message: err.message });
    }
    console.error("[dashboard.designer-kra]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Per-designer detail — the data behind the MD-facing Designer Detail Page
 * and the downloadable PDF report card.
 *
 * Returns the same KRA metrics as getDesignerKRA but for ONE user only,
 * decorated with time-series trends, status distribution, and task / project
 * lists for chart-driven visualisation. Returns null when the user
 * does not exist.
 */
const computeDesignerDetail = async (userId, validPeriod) => {
  const periodStart = startOfPeriod(validPeriod);

  // 1. User profile
  const user = User
    ? await User.findById(userId).select("name email phone role isActive").lean()
    : null;
  if (!user) return null;

  // 2. All tasks ever assigned to this user (we cap trend window to 12 weeks
  // below). Pull a slightly larger window than the active period so trend
  // sparklines render even for "week" view.
  const trendWindowStart = new Date(Date.now() - 12 * 7 * DAY);
  const lookbackStart = periodStart < trendWindowStart ? periodStart : trendWindowStart;
  const tasks = await Task.find({
    assignedTo: userId,
    $or: [
      { createdAt:   { $gte: lookbackStart } },
      { completedAt: { $gte: lookbackStart } },
      { approvedAt:  { $gte: lookbackStart } },
      // Always include currently-open tasks so the active counter is honest
      { status: { $in: ["not_started", "in_progress", "pending_review", "revision_requested", "blocked"] } },
    ],
  })
    .select("title status taskType priority createdAt completedAt approvedAt dueDate revisionInstructions projectId updatedAt submittedAt")
    .sort({ updatedAt: -1 })
    .lean();

  // 3. Current-period stats (mirrors getDesignerKRA logic for ONE user)
  let active = 0, done = 0, onTimeDone = 0, firstPassDone = 0;
  let delayedActive = 0;
  const statusCounts = new Map();
  const now = Date.now();
  for (const t of tasks) {
    const inPeriodActive = ["not_started", "in_progress", "pending_review", "revision_requested", "blocked"].includes(t.status);
    if (inPeriodActive) {
      active++;
      // Overdue active task = past dueDate
      if (t.dueDate && new Date(t.dueDate).getTime() < now) delayedActive++;
    }

    const endTs = t.completedAt || t.approvedAt;
    const isDoneInPeriod = TASK_DONE.includes(t.status) && endTs && new Date(endTs) >= periodStart;
    if (isDoneInPeriod) {
      done++;
      if (t.dueDate && new Date(endTs) <= new Date(t.dueDate)) onTimeDone++;
      if (!t.revisionInstructions) firstPassDone++;
    }

    // Status distribution counts ALL tasks the designer touched in the
    // lookback window — gives a fuller donut.
    const s = t.status || "unknown";
    statusCounts.set(s, (statusCounts.get(s) || 0) + 1);
  }
  const onTimeRate    = done > 0 ? onTimeDone / done : 0;
  const firstPassRate = done > 0 ? firstPassDone / done : 0;
  const throughputNorm = Math.min(1, done / 20); // 20 = full bar on absolute scale
  const kraScore = Math.round((0.45 * onTimeRate + 0.35 * firstPassRate + 0.20 * throughputNorm) * 5 * 10) / 10;

  // 4. Weekly trend — last 12 ISO weeks
  const weekly = [];
  for (let i = 11; i >= 0; i -= 1) {
    const start = new Date(now - (i + 1) * 7 * DAY);
    const end   = new Date(now - i * 7 * DAY);
    let wDone = 0, wOnTime = 0, wFirstPass = 0;
    for (const t of tasks) {
      const endTs = t.completedAt || t.approvedAt;
      if (TASK_DONE.includes(t.status) && endTs) {
        const ts = new Date(endTs).getTime();
        if (ts >= start.getTime() && ts < end.getTime()) {
          wDone++;
          if (t.dueDate && new Date(endTs) <= new Date(t.dueDate)) wOnTime++;
          if (!t.revisionInstructions) wFirstPass++;
        }
      }
    }
    weekly.push({
      weekStart:   start.toISOString().slice(0, 10),
      done:        wDone,
      onTime:      wOnTime,
      firstPass:   wFirstPass,
      onTimePct:   wDone > 0 ? Math.round((wOnTime / wDone) * 100) : null,
      firstPassPct:wDone > 0 ? Math.round((wFirstPass / wDone) * 100) : null,
    });
  }

  // 5. Monthly delivery count — last 6 calendar months
  const monthly = [];
  const monthCursor = new Date();
  monthCursor.setDate(1);
  monthCursor.setHours(0, 0, 0, 0);
  for (let i = 5; i >= 0; i -= 1) {
    const monthStart = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - i, 1);
    const monthEnd   = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - i + 1, 1);
    let count = 0;
    for (const t of tasks) {
      const endTs = t.completedAt || t.approvedAt;
      if (TASK_DONE.includes(t.status) && endTs) {
        const ts = new Date(endTs).getTime();
        if (ts >= monthStart.getTime() && ts < monthEnd.getTime()) count++;
      }
    }
    monthly.push({
      monthStart: monthStart.toISOString().slice(0, 10),
      label:      monthStart.toLocaleString("en-IN", { month: "short", year: "2-digit" }),
      done:       count,
    });
  }

  // 6. Projects assigned — distinct projectIds across the task set
  const projectIds = [...new Set(tasks.map((t) => String(t.projectId)).filter(Boolean))];
  const projects = projectIds.length
    ? await Project.find({ _id: { $in: projectIds } })
        .select("name trackingId phase status estimatedCompletionDate progressPercent")
        .lean()
    : [];
  // Tasks-per-project count for the projects table
  const tasksByProject = new Map();
  for (const t of tasks) {
    const k = String(t.projectId);
    if (!tasksByProject.has(k)) tasksByProject.set(k, { total: 0, active: 0, done: 0 });
    const bucket = tasksByProject.get(k);
    bucket.total += 1;
    if (["not_started", "in_progress", "pending_review", "revision_requested", "blocked"].includes(t.status)) bucket.active += 1;
    if (TASK_DONE.includes(t.status)) bucket.done += 1;
  }
  const projectsShaped = projects.map((p) => ({
    _id:        p._id,
    name:       p.name,
    trackingId: p.trackingId,
    phase:      p.phase,
    status:     p.status,
    eta:        p.estimatedCompletionDate || null,
    progress:   p.progressPercent || 0,
    tasks:      tasksByProject.get(String(p._id)) || { total: 0, active: 0, done: 0 },
  }));

  // 7. Recent tasks — top 10 by updatedAt
  const projectNameById = new Map(projects.map((p) => [String(p._id), p.name]));
  const recentTasks = tasks.slice(0, 30).map((t) => ({
    _id:         t._id,
    title:       t.title,
    status:      t.status,
    taskType:    t.taskType,
    priority:    t.priority,
    projectName: projectNameById.get(String(t.projectId)) || "—",
    projectId:   t.projectId,
    dueDate:     t.dueDate || null,
    updatedAt:   t.updatedAt,
    isDelayed:   !!(t.dueDate && new Date(t.dueDate).getTime() < now
                    && !TASK_DONE.includes(t.status)),
  }));

  // 8. Status distribution shaped for the donut
  const statusDistribution = [...statusCounts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  return {
    user: {
      _id:    user._id,
      name:   user.name,
      email:  user.email,
      phone:  user.phone,
      role:   user.role,
      isActive: user.isActive,
    },
    period: validPeriod,
    currentStats: {
      kraScore,
      onTimePct:    Math.round(onTimeRate * 100),
      firstPassPct: Math.round(firstPassRate * 100),
      throughput:   done,
      active,
      delayedActive,
    },
    kraBreakdown: {
      onTime:     Math.round(onTimeRate * 100),
      firstPass:  Math.round(firstPassRate * 100),
      throughput: Math.round(throughputNorm * 100),
    },
    trend: { weekly, monthly },
    statusDistribution,
    projects: projectsShaped,
    recentTasks,
  };
};

/**
 * @route GET /api/pms/dashboard/designer/:userId?period=week|month|quarter|all
 * @permission projects.read
 */
const getDesignerDetail = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ message: "userId is required" });

    const period = String(req.query.period || "month").toLowerCase();
    const validPeriod = ["week", "month", "quarter", "all"].includes(period) ? period : "month";

    const detail = await computeDesignerDetail(userId, validPeriod);
    if (!detail) return res.status(404).json({ message: "User not found" });

    res.status(200).json(detail);
  } catch (err) {
    console.error("[dashboard.designer-detail]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Designer report card as a downloadable PDF — same data as the detail page,
 * rendered server-side (see services/designerReportPdf.js).
 *
 * @route GET /api/pms/dashboard/designer/:userId/report.pdf?period=...
 * @permission projects.read
 */
const downloadDesignerReportPdf = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ message: "userId is required" });

    const period = String(req.query.period || "month").toLowerCase();
    const validPeriod = ["week", "month", "quarter", "all"].includes(period) ? period : "month";

    const detail = await computeDesignerDetail(userId, validPeriod);
    if (!detail) return res.status(404).json({ message: "User not found" });

    const buffer = await generateDesignerReportPdfBuffer(detail);
    const safeName = String(detail.user.name || "designer").trim().replace(/[^\w-]+/g, "-");
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Designer-Report-${safeName}-${validPeriod}.pdf"`,
      "Content-Length": buffer.length,
    });
    // Puppeteer ≥22 returns a Uint8Array — normalise so Express streams bytes.
    res.send(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
  } catch (err) {
    console.error("[dashboard.designer-report-pdf]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Project Analytics — MD-facing overview across the entire PMS.
 *
 * Returns aggregates designed for chart rendering:
 *   • statusDistribution   — projects by status (donut)
 *   • healthDistribution   — projects by classifyHealth() label (donut)
 *   • phaseDistribution    — projects by phase (bar)
 *   • delayedPerProject    — top 10 projects by overdue active task count (h-bar)
 *   • designerLeaderboard  — top-5 + bottom-5 designers by KRA (h-bar)
 *   • activeTrend          — last 12 weeks: new projects, completed tasks (line)
 *
 * @route GET /api/pms/dashboard/analytics?period=week|month|quarter|all
 * @permission projects.read
 */
const getAnalytics = async (req, res) => {
  try {
    // Overview tab joins the shared date-filter system: preset/from/to (+ legacy
    // period alias). Flow parts (designer leaderboard) honor the window; the
    // status/health/phase/delayed snapshots and the 12-week trend are unaffected.
    const { start, end, label } = resolveRequestRange(req.query);
    const now = Date.now();

    // 1. Project lists — all projects (for status / phase distribution + leaderboard)
    const projects = await Project.find({})
      .select("name trackingId phase status startDate estimatedCompletionDate progressPercent createdAt")
      .lean();

    const STATUSES = ["new", "design_phase", "execution_phase", "on_hold", "completed", "cancelled"];
    const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const p of projects) {
      const s = p.status || "new";
      if (statusCounts[s] !== undefined) statusCounts[s] += 1;
      else statusCounts.new += 1;
    }
    const statusDistribution = STATUSES.map((status) => ({ status, count: statusCounts[status] }));

    // 2. Health distribution — reuse classifyHealth on the active subset
    const activeProjects = projects.filter((p) => ACTIVE_STATUSES.includes(p.status));
    const openGates = await ApprovalGate.find({ status: "open" })
      .select("projectId createdAt")
      .lean();
    const openGatesByProject = new Map();
    for (const g of openGates) {
      const k = String(g.projectId);
      if (!openGatesByProject.has(k)) openGatesByProject.set(k, []);
      openGatesByProject.get(k).push(g);
    }
    const HEALTHS = ["on_track", "at_risk", "blocked", "on_hold", "delayed"];
    const healthCounts = Object.fromEntries(HEALTHS.map((h) => [h, 0]));
    for (const p of activeProjects) {
      const h = classifyHealth(p, openGatesByProject);
      if (healthCounts[h] !== undefined) healthCounts[h] += 1;
    }
    const healthDistribution = HEALTHS.map((health) => ({ health, count: healthCounts[health] }));

    // 3. Phase distribution (active projects only)
    const PHASES = ["kickoff", "layout", "design", "procurement", "release", "execution", "handover"];
    const phaseCounts = Object.fromEntries(PHASES.map((ph) => [ph, 0]));
    for (const p of activeProjects) {
      const ph = p.phase || "kickoff";
      if (phaseCounts[ph] !== undefined) phaseCounts[ph] += 1;
    }
    const phaseDistribution = PHASES.map((phase) => ({ phase, count: phaseCounts[phase] }));

    // 4. Delayed-per-project — count overdue active tasks per project
    const overdueAggregation = await Task.aggregate([
      {
        $match: {
          status: { $nin: TASK_DONE },
          dueDate: { $lt: new Date(now) },
        },
      },
      { $group: { _id: "$projectId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);
    const projectById = new Map(projects.map((p) => [String(p._id), p]));
    const delayedPerProject = overdueAggregation.map((r) => {
      const p = projectById.get(String(r._id));
      return {
        projectId:  r._id,
        name:       p?.name || "—",
        trackingId: p?.trackingId || "",
        count:      r.count,
      };
    });

    // 5. Designer leaderboard — reuse getDesignerKRA's computation inline
    //    Pulls tasks similar to getDesignerKRA so the numbers match exactly.
    const periodStart = start;
    const periodEnd = end;
    const desTasks = await Task.find({
      assignedTo: { $ne: null },
      $or: [
        { createdAt:   { $gte: periodStart, $lte: periodEnd } },
        { completedAt: { $gte: periodStart, $lte: periodEnd } },
        { approvedAt:  { $gte: periodStart, $lte: periodEnd } },
        { status: { $in: ["in_progress", "pending_review", "revision_requested", "not_started", "blocked"] } },
      ],
    })
      .select("assignedTo status createdAt approvedAt completedAt dueDate revisionInstructions")
      .lean();

    const byUser = new Map();
    for (const t of desTasks) {
      const key = String(t.assignedTo);
      if (!byUser.has(key)) byUser.set(key, {
        userId: t.assignedTo, name: "—", role: "—",
        active: 0, done: 0, onTimeDone: 0, firstPassDone: 0, throughput: 0,
      });
      const u = byUser.get(key);
      if (["in_progress", "pending_review", "revision_requested", "not_started", "blocked"].includes(t.status)) {
        u.active += 1;
      }
      const endTs = t.completedAt || t.approvedAt;
      if (TASK_DONE.includes(t.status) && endTs && new Date(endTs) >= periodStart && new Date(endTs) <= periodEnd) {
        u.done += 1;
        u.throughput += 1;
        if (t.dueDate && new Date(endTs) <= new Date(t.dueDate)) u.onTimeDone += 1;
        if (!t.revisionInstructions) u.firstPassDone += 1;
      }
    }
    if (User && byUser.size > 0) {
      const users = await User.find({ _id: { $in: [...byUser.keys()] } }).select("name role").lean();
      for (const u of users) {
        const entry = byUser.get(String(u._id));
        if (entry) { entry.name = u.name || entry.name; entry.role = u.role || entry.role; }
      }
    }
    const maxThroughput = Math.max(1, ...[...byUser.values()].map((u) => u.throughput));
    const ranked = [...byUser.values()]
      .filter((u) => (u.done > 0 || u.active > 0))
      .map((u) => {
        const onTime = u.done > 0 ? u.onTimeDone / u.done : 0;
        const fp     = u.done > 0 ? u.firstPassDone / u.done : 0;
        const tn     = u.throughput / maxThroughput;
        const kra    = Math.round((0.45 * onTime + 0.35 * fp + 0.20 * tn) * 5 * 10) / 10;
        return {
          userId: u.userId, name: u.name, role: u.role,
          active: u.active, done: u.done,
          onTimePct: Math.round(onTime * 100),
          kraScore:  kra,
        };
      })
      .sort((a, b) => b.kraScore - a.kraScore);

    const top    = ranked.slice(0, 5);
    const bottom = ranked.length > 5 ? ranked.slice(-5).reverse() : [];

    // 6. Active trend — last 12 weeks: new projects + tasks completed
    const lookback = new Date(now - 12 * 7 * DAY);
    const [projectsInWindow, completedTasks] = await Promise.all([
      Project.find({ createdAt: { $gte: lookback } }).select("createdAt").lean(),
      Task.find({
        status: { $in: TASK_DONE },
        $or: [
          { completedAt: { $gte: lookback } },
          { approvedAt:  { $gte: lookback } },
        ],
      }).select("completedAt approvedAt dueDate").lean(),
    ]);
    const activeTrend = [];
    for (let i = 11; i >= 0; i -= 1) {
      const start = new Date(now - (i + 1) * 7 * DAY);
      const end   = new Date(now - i * 7 * DAY);
      const newProjects = projectsInWindow.filter((p) => {
        const ts = new Date(p.createdAt).getTime();
        return ts >= start.getTime() && ts < end.getTime();
      }).length;
      let tasksDone = 0, tasksDelayed = 0;
      for (const t of completedTasks) {
        const endTs = t.completedAt || t.approvedAt;
        if (!endTs) continue;
        const ts = new Date(endTs).getTime();
        if (ts < start.getTime() || ts >= end.getTime()) continue;
        tasksDone += 1;
        if (t.dueDate && new Date(endTs) > new Date(t.dueDate)) tasksDelayed += 1;
      }
      activeTrend.push({
        weekStart: start.toISOString().slice(0, 10),
        label:     start.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        newProjects,
        tasksDone,
        tasksDelayed,
        onTimePct: tasksDone > 0 ? Math.round(((tasksDone - tasksDelayed) / tasksDone) * 100) : null,
      });
    }

    res.status(200).json({
      period: label,
      totals: {
        projects:        projects.length,
        activeProjects:  activeProjects.length,
        completedProjects: projects.filter((p) => p.status === "completed").length,
        designersActive: ranked.length,
      },
      statusDistribution,
      healthDistribution,
      phaseDistribution,
      delayedPerProject,
      designerLeaderboard: { top, bottom },
      activeTrend,
    });
  } catch (err) {
    if (err instanceof DateRangeError) {
      return res.status(400).json({ error: err.code, message: err.message });
    }
    console.error("[dashboard.analytics]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Per-project pending MD approval queue.
 *
 * Surfaces designer submissions for THIS project that the MD can act on:
 *   • tasks in pending_review
 *   • drawings in sent_for_approval
 *
 * Used by the Project Detail → Overview tab's "Pending MD Approval" card.
 *
 * @route GET /api/pms/dashboard/project/:projectId/pending-md-approval
 * @permission projects.read
 */
const getProjectPendingApproval = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!projectId) return res.status(400).json({ message: "projectId is required" });

    const [tasks, drawings] = await Promise.all([
      Task.find({ projectId, status: "pending_review" })
        .populate("assignedTo", "name email")
        .select("title taskType submittedAt submissionNotes assignedTo")
        .sort({ submittedAt: 1 })
        .lean(),
      Drawing.find({ projectId, status: "sent_for_approval" })
        .populate("uploadedBy", "name email")
        .select("title drawingType version updatedAt submissionNotes uploadedBy zoneName fileType fileName")
        .sort({ updatedAt: 1 })
        .lean(),
    ]);

    const now = Date.now();

    const tasksShaped = tasks.map((t) => ({
      _id:              t._id,
      title:            t.title,
      taskType:         t.taskType,
      submitterName:    t.assignedTo?.name || "—",
      submissionNotes:  t.submissionNotes || "",
      submittedAt:      t.submittedAt,
      ageMs:            t.submittedAt ? now - new Date(t.submittedAt).getTime() : 0,
    }));

    const drawingsShaped = drawings.map((d) => ({
      _id:              d._id,
      title:            d.title,
      drawingType:      d.drawingType,
      version:          d.version,
      zoneName:         d.zoneName,
      fileType:         d.fileType || null,
      fileName:         d.fileName || null,
      submitterName:    d.uploadedBy?.name || "—",
      submissionNotes:  d.submissionNotes || "",
      submittedAt:      d.updatedAt,
      ageMs:            now - new Date(d.updatedAt).getTime(),
    }));

    res.status(200).json({
      total:    tasks.length + drawings.length,
      tasks:    tasksShaped,
      drawings: drawingsShaped,
    });
  } catch (err) {
    console.error("[dashboard.project-pending-approval]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Consolidated alerts feed for the dashboard's AlertsSection widget.
 *
 * Four categories: delayed projects (with blocker attribution), overdue tasks,
 * idle gates (open >3 days), and the current user's pending approvals.
 *
 * RBAC: admin/md/manager see everything. Other roles see only their own
 * overdue tasks + their own pending approvals; delayedProjects/idleGates
 * arrays come back empty.
 *
 * @route GET /api/pms/dashboard/alerts
 * @permission projects.read
 */
const getAlerts = async (req, res) => {
  try {
    const now = new Date();
    const privileged = isPrivilegedRole(req.user);

    // ── Delayed projects + blockers ───────────────────────────────────────
    let delayedItems = [];
    if (privileged) {
      const activeProjects = await Project.find({ status: { $in: ACTIVE_STATUSES } })
        .select("name trackingId estimatedCompletionDate assignments clientId")
        .populate("assignments.responsibilityId", "slug")
        .populate("assignments.users", "name")
        .populate("clientId", "name")
        .lean();

      delayedItems = activeProjects
        .filter((p) => p.estimatedCompletionDate && new Date(p.estimatedCompletionDate) < now)
        .map((p) => ({
          _id:        p._id,
          trackingId: p.trackingId,
          name:       p.name,
          clientName: p.clientId?.name || null,
          daysLate:   Math.max(1, Math.floor((now - new Date(p.estimatedCompletionDate)) / DAY)),
        }))
        .sort((a, b) => b.daysLate - a.daysLate);

      await attachBlockersToDelayedProjects(delayedItems, activeProjects, now, req.user);
    }

    // ── Overdue tasks (own-only for non-privileged) ───────────────────────
    const taskFilter = {
      dueDate: { $lt: now },
      status:  { $nin: [...TASK_DONE, "blocked"] },
      assignedTo: { $ne: null },
    };
    if (!privileged) taskFilter.assignedTo = req.user?._id;

    const overdueTasksRaw = await Task.find(taskFilter)
      .populate("projectId", "name trackingId")
      .populate("assignedTo", "name role")
      .select("title taskType dueDate projectId assignedTo")
      .sort({ dueDate: 1 })
      .limit(25)
      .lean();

    const overdueTasksItems = overdueTasksRaw.map((t) => ({
      _id:           t._id,
      title:         t.title,
      taskType:      t.taskType,
      dueDate:       t.dueDate,
      daysOverdue:   Math.max(1, Math.floor((now - new Date(t.dueDate)) / DAY)),
      projectId:     t.projectId?._id,
      projectName:   t.projectId?.name,
      trackingId:    t.projectId?.trackingId,
      assigneeId:    t.assignedTo?._id,
      assigneeName:  t.assignedTo?.name || "—",
      assigneeRole:  t.assignedTo?.role || null,
    }));

    // ── Idle gates (privileged only) ──────────────────────────────────────
    let idleGatesItems = [];
    if (privileged) {
      const cutoff = new Date(Date.now() - 3 * DAY);
      const idleGates = await ApprovalGate.find({ status: "open", createdAt: { $lt: cutoff } })
        .populate("projectId", "name trackingId")
        .select("label gateType approverType createdAt projectId")
        .sort({ createdAt: 1 })
        .limit(15)
        .lean();
      idleGatesItems = idleGates.map((g) => ({
        _id:          g._id,
        label:        g.label,
        gateType:     g.gateType,
        approverType: g.approverType,
        ageDays:      Math.max(1, Math.floor((Date.now() - new Date(g.createdAt).getTime()) / DAY)),
        projectId:    g.projectId?._id,
        projectName:  g.projectId?.name,
        trackingId:   g.projectId?.trackingId,
      }));
    }

    // ── Pending approvals (always scoped to the caller) ───────────────────
    const pendingApprovals = await buildPendingMyApproval(req.user);

    const totalCount =
      delayedItems.length +
      overdueTasksItems.length +
      idleGatesItems.length +
      pendingApprovals.length;

    res.status(200).json({
      totalCount,
      categories: {
        delayedProjects:  { count: delayedItems.length,     items: delayedItems },
        overdueTasks:     { count: overdueTasksItems.length, items: overdueTasksItems },
        idleGates:        { count: idleGatesItems.length,    items: idleGatesItems },
        pendingApprovals: { count: pendingApprovals.length,  items: pendingApprovals },
      },
    });
  } catch (err) {
    console.error("[dashboard.alerts]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Designer KPI report — flat JSON the frontend turns into Excel via SheetJS.
 * Same numbers as the dashboard scoreboard, shaped as a downloadable table.
 *
 * @route GET /api/pms/reports/designer-kpi?period=...
 * @permission projects.read
 */
const getDesignerKpiReport = async (req, res) => {
  try {
    const period = String(req.query.period || "month").toLowerCase();
    const validPeriod = ["week", "month", "quarter", "all"].includes(period) ? period : "month";
    const periodStart = startOfPeriod(validPeriod);

    const tasks = await Task.find({
      assignedTo: { $ne: null },
      $or: [
        { createdAt:   { $gte: periodStart } },
        { completedAt: { $gte: periodStart } },
        { approvedAt:  { $gte: periodStart } },
        { status: { $in: ["in_progress", "pending_review", "revision_requested", "not_started", "blocked"] } },
      ],
    })
      .select("assignedTo status createdAt approvedAt completedAt dueDate revisionInstructions")
      .lean();

    const byUser = new Map();
    for (const t of tasks) {
      const key = String(t.assignedTo);
      if (!byUser.has(key)) byUser.set(key, {
        userId: t.assignedTo, name: "—", role: "—", email: "",
        active: 0, done: 0, overdueActive: 0,
        onTimeDone: 0, firstPassDone: 0, throughput: 0,
      });
      const u = byUser.get(key);
      const isActive = ["in_progress", "pending_review", "revision_requested", "not_started", "blocked"].includes(t.status);
      if (isActive) {
        u.active += 1;
        if (t.dueDate && new Date(t.dueDate).getTime() < Date.now()) u.overdueActive += 1;
      }
      const endTs = t.completedAt || t.approvedAt;
      if (TASK_DONE.includes(t.status) && endTs && new Date(endTs) >= periodStart) {
        u.done += 1;
        u.throughput += 1;
        if (t.dueDate && new Date(endTs) <= new Date(t.dueDate)) u.onTimeDone += 1;
        if (!t.revisionInstructions) u.firstPassDone += 1;
      }
    }
    if (User && byUser.size > 0) {
      const users = await User.find({ _id: { $in: [...byUser.keys()] } }).select("name role email").lean();
      for (const u of users) {
        const entry = byUser.get(String(u._id));
        if (entry) {
          entry.name = u.name || entry.name;
          entry.role = u.role || entry.role;
          entry.email = u.email || "";
        }
      }
    }

    const maxThroughput = Math.max(1, ...[...byUser.values()].map((u) => u.throughput));
    const rows = [...byUser.values()].map((u) => {
      const onTime = u.done > 0 ? u.onTimeDone / u.done : 0;
      const fp     = u.done > 0 ? u.firstPassDone / u.done : 0;
      const tn     = u.throughput / maxThroughput;
      const kra    = Math.round((0.45 * onTime + 0.35 * fp + 0.20 * tn) * 5 * 10) / 10;
      return {
        name:           u.name,
        role:           u.role,
        email:          u.email,
        activeTasks:    u.active,
        overdueActive:  u.overdueActive,
        delivered:      u.done,
        onTimePct:      Math.round(onTime * 100),
        firstPassPct:   Math.round(fp * 100),
        kraScore:       kra,
      };
    }).sort((a, b) => b.kraScore - a.kraScore);

    res.status(200).json({
      reportName: "Designer KPI Report",
      period:     validPeriod,
      generatedAt: new Date().toISOString(),
      rows,
      summary: {
        designers:    rows.length,
        avgKra:       rows.length > 0 ? Math.round((rows.reduce((s, r) => s + r.kraScore, 0) / rows.length) * 10) / 10 : 0,
        totalDelivered: rows.reduce((s, r) => s + r.delivered, 0),
        totalActive:    rows.reduce((s, r) => s + r.activeTasks, 0),
        totalOverdue:   rows.reduce((s, r) => s + r.overdueActive, 0),
      },
    });
  } catch (err) {
    console.error("[reports.designer-kpi]", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Project summary report — flat JSON, one row per project.
 *
 * @route GET /api/pms/reports/project-summary?period=...
 * @permission projects.read
 */
const getProjectSummaryReport = async (req, res) => {
  try {
    const period = String(req.query.period || "month").toLowerCase();
    const validPeriod = ["week", "month", "quarter", "all"].includes(period) ? period : "month";

    const projects = await Project.find({})
      .select("name trackingId phase status startDate estimatedCompletionDate progressPercent createdAt")
      .lean();

    const openGates = await ApprovalGate.find({ status: "open" })
      .select("projectId createdAt")
      .lean();
    const openGatesByProject = new Map();
    for (const g of openGates) {
      const k = String(g.projectId);
      if (!openGatesByProject.has(k)) openGatesByProject.set(k, []);
      openGatesByProject.get(k).push(g);
    }

    // Task aggregates per project — active + delivered + overdue
    const projectIds = projects.map((p) => p._id);
    const taskAgg = await Task.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      {
        $group: {
          _id: "$projectId",
          total:    { $sum: 1 },
          done:     { $sum: { $cond: [{ $in: ["$status", TASK_DONE] }, 1, 0] } },
          active:   { $sum: { $cond: [{ $in: ["$status", ["in_progress", "pending_review", "revision_requested", "not_started", "blocked"]] }, 1, 0] } },
          overdue:  {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $not: { $in: ["$status", TASK_DONE] } },
                    { $ne: ["$dueDate", null] },
                    { $lt: ["$dueDate", new Date()] },
                  ],
                },
                1, 0,
              ],
            },
          },
        },
      },
    ]);
    const taskByProject = new Map(taskAgg.map((r) => [String(r._id), r]));

    const now = Date.now();
    const rows = projects.map((p) => {
      const health = classifyHealth(p, openGatesByProject);
      const tStats = taskByProject.get(String(p._id)) || { total: 0, done: 0, active: 0, overdue: 0 };
      const daysToDeadline = p.estimatedCompletionDate
        ? Math.round((new Date(p.estimatedCompletionDate).getTime() - now) / DAY)
        : null;
      return {
        trackingId:    p.trackingId || "",
        name:          p.name,
        status:        p.status,
        phase:         p.phase || "",
        health,
        progressPct:   p.progressPercent || 0,
        startDate:     p.startDate ? new Date(p.startDate).toISOString().slice(0, 10) : "",
        eta:           p.estimatedCompletionDate ? new Date(p.estimatedCompletionDate).toISOString().slice(0, 10) : "",
        daysToDeadline,
        isDelayed:     p.estimatedCompletionDate ? (new Date(p.estimatedCompletionDate).getTime() < now && p.status !== "completed") : false,
        tasksTotal:    tStats.total,
        tasksDone:     tStats.done,
        tasksActive:   tStats.active,
        tasksOverdue:  tStats.overdue,
        openGates:     (openGatesByProject.get(String(p._id)) || []).length,
      };
    });

    res.status(200).json({
      reportName: "Project Summary Report",
      period:     validPeriod,
      generatedAt: new Date().toISOString(),
      rows,
      summary: {
        total:        rows.length,
        active:       rows.filter((r) => ACTIVE_STATUSES.includes(r.status)).length,
        completed:    rows.filter((r) => r.status === "completed").length,
        delayed:      rows.filter((r) => r.isDelayed).length,
        totalOverdueTasks: rows.reduce((s, r) => s + r.tasksOverdue, 0),
      },
    });
  } catch (err) {
    console.error("[reports.project-summary]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getOverview,
  getDesignerKRA,
  getDesignerDetail,
  downloadDesignerReportPdf,
  getAnalytics,
  getProjectPendingApproval,
  getAlerts,
  // Reports (Phase C — JSON; frontend turns these into Excel via SheetJS)
  getDesignerKpiReport,
  getProjectSummaryReport,
  // Helpers exposed for cross-module aggregators (e.g., MD Dashboard)
  startOfPeriod,
  previousPeriodWindow,
  PERIOD_DAYS,
  classifyHealth,
  HEALTH_RANK,
  ACTIVE_STATUSES,
  TASK_DONE,
  DAY,
};
