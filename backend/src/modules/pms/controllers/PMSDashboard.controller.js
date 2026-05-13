const Project = require("../models/Project.model");
const Task = require("../models/Task.model");
const Drawing = require("../models/Drawing.model");
const Approval = require("../models/Approval.model");
const SiteLog = require("../models/SiteLog.model");

/**
 * @desc Get Global PMS Stats (For Admin/Manager)
 * @route GET /api/pms/dashboard/global-stats
 */
const getGlobalStats = async (req, res) => {
  try {
    const totalProjects = await Project.countDocuments();
    const activeProjects = await Project.countDocuments({ status: { $in: ["design_phase", "execution_phase"] } });
    const pendingApprovals = await Approval.countDocuments({ status: "pending" });
    const tasksInProgress = await Task.countDocuments({ status: "in_progress" });
    const releasedDrawings = await Drawing.countDocuments({ status: "released_to_site" });

    res.status(200).json({
      success: true,
      stats: {
        totalProjects,
        activeProjects,
        pendingApprovals,
        tasksInProgress,
        releasedDrawings
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Get Detailed Project Dashboard
 * @route GET /api/pms/dashboard/project/:projectId
 */
const getProjectDashboard = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId)
      .populate("clientId", "name phone")
      .populate("primaryDesigner", "name")
      .populate("supervisor", "name");

    if (!project) return res.status(404).json({ message: "Project not found" });

    const tasks = await Task.find({ projectId });
    const drawings = await Drawing.find({ projectId });
    const recentLogs = await SiteLog.find({ projectId }).sort({ logDate: -1 }).limit(5);

    // Calculate Progress (example logic)
    const completedTasks = tasks.filter(t => t.status === "completed" || t.status === "released_to_site").length;
    const progressPercentage = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        project,
        stats: {
          totalTasks: tasks.length,
          completedTasks,
          progressPercentage: Math.round(progressPercentage),
          totalDrawings: drawings.length,
          releasedDrawings: drawings.filter(d => d.isReleased).length
        },
        recentActivity: recentLogs
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Get Designer/Supervisor specific dashboard
 */
const getUserDashboard = async (req, res) => {
  try {
    const { userId, role } = req.query; // role: designer or supervisor

    const filter = role === "designer" ? { assignedTo: userId } : { supervisor: userId };
    
    const pendingTasks = await Task.find({ ...filter, status: "in_progress" })
      .populate("projectId", "name trackingId")
      .sort({ dueDate: 1 });

    res.status(200).json({
      success: true,
      pendingTasks
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getGlobalStats,
  getProjectDashboard,
  getUserDashboard
};
