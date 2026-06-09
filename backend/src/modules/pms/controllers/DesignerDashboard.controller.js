const Task = require("../models/Task.model");
const Drawing = require("../models/Drawing.model");
const Project = require("../models/Project.model");
const DesignRevisionRequest = require("../models/DesignRevisionRequest.model");
const SiteVisit = require("../models/SiteVisit.model");
const Approval = require("../models/Approval.model");

// Statuses the designer can personally act on (start / submit / revise).
const ACTIONABLE_TASK_STATUSES = ["not_started", "in_progress", "revision_requested"];
const TERMINAL_STATUSES = ["completed", "released_to_site", "approved"];
const ACTIVE_STATUSES = ["in_progress", "pending_review", "revision_requested", "on_hold"];

/**
 * @route GET /api/pms/designer/dashboard
 * Returns a personalised, ACTION-FIRST summary for the logged-in designer.
 *
 * The payload is a superset of the legacy shape (stats / upcomingDeadlines /
 * overdueTasks / recentDrawings / pendingRevisionRequests / activeProjects are
 * kept for backward compatibility with the AI tool and any other consumer) plus
 * new action-oriented fields the redesigned dashboard renders:
 *   ribbon, actionQueue, blockedTasks, actionableDrawings, drawingsInReview,
 *   todaysSiteVisits, reviewsWaitingOnMe, capabilities.
 */
const getDesignerDashboard = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const perms = req.user.permissions || [];
    const canReview = perms.includes("*") || perms.includes("pd.review.respond");

    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
    const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in14d = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // ── Parallel data fetch ──────────────────────────────────────────────────
    const [
      allMyTasks,
      drawingStats,
      upcomingDeadlines,
      overdueTasks,
      recentDrawings,
      pendingRevisionRequests,
      activeProjects,
      myWorkflowDrawings,
      todaysSiteVisits,
      reviewsWaitingOnMe,
    ] = await Promise.all([

      // All tasks assigned to me (drives stats + action queue + blocked lane)
      Task.find({ assignedTo: userId })
        .select("status taskType title dueDate priority projectId gateStatus planning.progressPercent")
        .populate("projectId", "name trackingId status")
        .lean(),

      // Drawing counts by status for drawings I uploaded
      Drawing.aggregate([
        { $match: { uploadedBy: userId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Upcoming deadlines — next 14 days, not terminal status (legacy field)
      Task.find({
        assignedTo: userId,
        dueDate: { $gte: now, $lte: in14d },
        status: { $nin: ["completed", "released_to_site"] },
      })
        .populate("projectId", "name trackingId")
        .sort({ dueDate: 1 })
        .limit(10)
        .lean(),

      // Overdue tasks — past dueDate, not terminal (legacy field)
      Task.find({
        assignedTo: userId,
        dueDate: { $lt: now },
        status: { $nin: ["completed", "released_to_site"] },
      })
        .populate("projectId", "name trackingId")
        .sort({ dueDate: 1 })
        .limit(10)
        .lean(),

      // My 5 most recent drawings (legacy field)
      Drawing.find({ uploadedBy: userId })
        .populate("projectId", "name trackingId")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      // Pending revision requests assigned to me
      DesignRevisionRequest.find({ assignedTo: userId, status: "pending" })
        .populate({ path: "drawingId", select: "title drawingType version status" })
        .populate({ path: "projectId", select: "name trackingId" })
        .populate({ path: "requestedBy", select: "name role" })
        .sort({ createdAt: -1 })
        .lean(),

      // Active projects where I'm part of the team (any responsibility)
      Project.find({
        "assignments.users": userId,
        status: { $in: ["design_phase", "execution_phase"] },
      })
        .select("name trackingId status phase progressPercent estimatedCompletionDate clientId assignments clientApprovals")
        .populate("clientId", "name")
        .populate("assignments.responsibilityId", "name slug icon color")
        .populate("assignments.users", "name role")
        .lean(),

      // My drawings that are actionable (draft/rejected) or in flight (sent_for_approval)
      Drawing.find({
        uploadedBy: userId,
        status: { $in: ["draft", "rejected", "sent_for_approval"] },
      })
        .select("title drawingType version status projectId rejectionReason updatedAt")
        .populate("projectId", "name trackingId")
        .sort({ updatedAt: -1 })
        .limit(30)
        .lean(),

      // Site visits I'm the visitor for, planned within the next 7 days
      SiteVisit.find({
        visitorId: userId,
        status: "planned",
        visitDate: { $gte: startOfToday, $lte: in7d },
      })
        .select("purpose visitDate status projectId observations")
        .populate("projectId", "name trackingId")
        .sort({ visitDate: 1 })
        .limit(10)
        .lean(),

      // Approvals waiting on ME — only non-empty for leads/PD reviewers
      Approval.find({
        status: "pending",
        $or: [
          { approverId: userId },
          ...(canReview ? [{ approverType: "principal_designer", approverId: { $in: [null, undefined] } }] : []),
        ],
      })
        .select("targetType targetId approverType status comments projectId createdAt")
        .populate("projectId", "name trackingId")
        .sort({ createdAt: 1 })
        .limit(10)
        .lean(),
    ]);

    // ── Derive task buckets from the single task fetch ───────────────────────
    const tasksByStatus = allMyTasks.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});

    const drawingsByStatus = drawingStats.reduce((acc, d) => {
      acc[d._id] = d.count;
      return acc;
    }, {});

    // Action queue: only what the designer can personally move, soonest-due first.
    const actionQueue = allMyTasks
      .filter((t) => ACTIONABLE_TASK_STATUSES.includes(t.status))
      .sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });

    // Blocked / waiting-on-others lane (designer cannot self-clear these).
    const blockedTasks = allMyTasks.filter((t) => t.status === "blocked");

    // Actionable vs in-flight drawings.
    const actionableDrawings = myWorkflowDrawings.filter(
      (d) => d.status === "draft" || d.status === "rejected"
    );
    const drawingsInReview = myWorkflowDrawings.filter((d) => d.status === "sent_for_approval");

    const inDate = (d, lo, hi) => d && new Date(d) >= lo && new Date(d) <= hi;

    const ribbon = {
      overdue: actionQueue.filter((t) => t.dueDate && new Date(t.dueDate) < startOfToday).length,
      dueToday: actionQueue.filter((t) => inDate(t.dueDate, startOfToday, endOfToday)).length,
      blocked: blockedTasks.length,
      revisions: pendingRevisionRequests.length,
    };

    res.status(200).json({
      // ── New action-first payload ──────────────────────────────────────────
      ribbon,
      actionQueue,
      blockedTasks,
      actionableDrawings,
      drawingsInReview,
      todaysSiteVisits,
      reviewsWaitingOnMe,
      capabilities: { canReview },

      // ── Legacy payload (kept for backward compatibility) ──────────────────
      stats: {
        totalTasks: allMyTasks.length,
        tasksByStatus,
        totalDrawings: drawingStats.reduce((s, d) => s + d.count, 0),
        drawingsByStatus,
        overdueTasksCount: overdueTasks.length,
        pendingRevisionsCount: pendingRevisionRequests.length,
        pendingApprovalDrawings: drawingsByStatus["sent_for_approval"] || 0,
        activeTasksCount: allMyTasks.filter((t) => ACTIVE_STATUSES.includes(t.status)).length,
        completedTasksCount: allMyTasks.filter((t) => TERMINAL_STATUSES.includes(t.status)).length,
        activeProjectsCount: activeProjects.length,
      },
      upcomingDeadlines,
      overdueTasks,
      recentDrawings,
      pendingRevisionRequests,
      activeProjects,
    });
  } catch (error) {
    console.error("[getDesignerDashboard]", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getDesignerDashboard };
