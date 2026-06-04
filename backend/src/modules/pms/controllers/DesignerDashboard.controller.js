const Task = require("../models/Task.model");
const Drawing = require("../models/Drawing.model");
const Project = require("../models/Project.model");
const DesignRevisionRequest = require("../models/DesignRevisionRequest.model");

/**
 * @route GET /api/pms/designer/dashboard
 * Returns a personalised summary for the logged-in designer.
 */
const getDesignerDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const now    = new Date();
    const in14d  = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // ── Parallel data fetch ──────────────────────────────────────────────────
    const [
      allMyTasks,
      drawingStats,
      upcomingDeadlines,
      overdueTasks,
      recentDrawings,
      pendingRevisionRequests,
      activeProjects,
    ] = await Promise.all([

      // All tasks assigned to me
      Task.find({ assignedTo: userId })
        .select("status taskType title dueDate priority projectId")
        .populate("projectId", "name trackingId status")
        .lean(),

      // Drawing counts by status for drawings I uploaded
      Drawing.aggregate([
        { $match: { uploadedBy: userId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // Upcoming deadlines — next 14 days, not terminal status
      Task.find({
        assignedTo: userId,
        dueDate: { $gte: now, $lte: in14d },
        status: { $nin: ["completed", "released_to_site"] },
      })
        .populate("projectId", "name trackingId")
        .sort({ dueDate: 1 })
        .limit(10)
        .lean(),

      // Overdue tasks — past dueDate, not terminal
      Task.find({
        assignedTo: userId,
        dueDate: { $lt: now },
        status: { $nin: ["completed", "released_to_site"] },
      })
        .populate("projectId", "name trackingId")
        .sort({ dueDate: 1 })
        .limit(10)
        .lean(),

      // My 5 most recent drawings
      Drawing.find({ uploadedBy: userId })
        .populate("projectId", "name trackingId")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      // Pending revision requests assigned to me
      DesignRevisionRequest.find({ assignedTo: userId, status: "pending" })
        .populate({ path: "drawingId",   select: "title drawingType version status" })
        .populate({ path: "projectId",   select: "name trackingId" })
        .populate({ path: "requestedBy", select: "name role" })
        .sort({ createdAt: -1 })
        .lean(),

      // Active projects where I'm part of the team (any responsibility)
      Project.find({
        "assignments.users": userId,
        status: { $in: ["design_phase", "execution_phase"] },
      })
        .select("name trackingId status estimatedCompletionDate clientId assignments")
        .populate("clientId", "name")
        .populate("assignments.responsibilityId", "name slug icon color")
        .populate("assignments.users", "name role")
        .lean(),
    ]);

    // ── Aggregate task stats ─────────────────────────────────────────────────
    const tasksByStatus = allMyTasks.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});

    // Normalise drawing stats from aggregation pipeline
    const drawingsByStatus = drawingStats.reduce((acc, d) => {
      acc[d._id] = d.count;
      return acc;
    }, {});

    const ACTIVE_STATUSES    = ["in_progress", "pending_review", "revision_requested", "on_hold"];
    const TERMINAL_STATUSES  = ["completed", "released_to_site", "approved"];

    res.status(200).json({
      stats: {
        totalTasks:             allMyTasks.length,
        tasksByStatus,
        totalDrawings:          drawingStats.reduce((s, d) => s + d.count, 0),
        drawingsByStatus,
        overdueTasksCount:      overdueTasks.length,
        pendingRevisionsCount:  pendingRevisionRequests.length,
        pendingApprovalDrawings: drawingsByStatus["sent_for_approval"] || 0,
        activeTasksCount:       allMyTasks.filter((t) => ACTIVE_STATUSES.includes(t.status)).length,
        completedTasksCount:    allMyTasks.filter((t) => TERMINAL_STATUSES.includes(t.status)).length,
        activeProjectsCount:    activeProjects.length,
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
