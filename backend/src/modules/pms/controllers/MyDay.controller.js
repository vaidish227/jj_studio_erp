/**
 * MyDay.controller — Phase 3a.
 *
 * One endpoint that answers "what should I do today?" for the logged-in user.
 * Reads only — pulls from existing Task / ApprovalGate / Approval / Drawing.
 *
 * Buckets returned:
 *   - overdueTasks       — tasks assigned to me, dueDate in the past, not yet approved/released/completed
 *   - upcomingTasks      — tasks assigned to me, due in next 7 days, not yet approved/released/completed
 *   - blockedTasks       — tasks assigned to me currently status=blocked (need a gate / dep to clear)
 *   - pendingMyApprovals — PD-review pending approvals where approverId == me (or unassigned PD reviewer if I'm a PD)
 *   - gatesIBlock        — open gates on projects where I am the primary owner/PM (best-effort by team slots)
 *
 * Designed for the front-page MyDay widget. Cheap — bounded queries, no populate loops.
 */

const Task = require("../models/Task.model");
const ApprovalGate = require("../models/ApprovalGate.model");
const Approval = require("../models/Approval.model");
const Project = require("../models/Project.model");

const TASK_DONE_STATUSES = ["approved", "released_to_site", "completed"];

/**
 * @route GET /api/pms/myday
 */
const getMyDay = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 86400000);

    // 1. Overdue tasks assigned to me
    const overdueTasks = await Task.find({
      assignedTo: userId,
      dueDate: { $lt: now },
      status: { $nin: [...TASK_DONE_STATUSES, "blocked"] },
    })
      .populate("projectId", "name trackingId")
      .select("title taskType status dueDate projectId")
      .sort({ dueDate: 1 })
      .limit(15)
      .lean();

    // 2. Upcoming tasks (next 7 days)
    const upcomingTasks = await Task.find({
      assignedTo: userId,
      dueDate: { $gte: now, $lte: in7Days },
      status: { $nin: [...TASK_DONE_STATUSES, "blocked"] },
    })
      .populate("projectId", "name trackingId")
      .select("title taskType status dueDate projectId")
      .sort({ dueDate: 1 })
      .limit(10)
      .lean();

    // 3. Blocked tasks assigned to me — these need someone else to unblock
    const blockedTasks = await Task.find({
      assignedTo: userId,
      status: "blocked",
    })
      .populate("projectId", "name trackingId")
      .select("title taskType status dueDate projectId dependsOn gateStatus")
      .limit(10)
      .lean();

    // 4. Pending PD-review approvals where I am the named reviewer.
    // Also includes pending PD approvals with no approverId yet, when the
    // requester has pd.review.respond — best-effort permission inference.
    const userPerms = req.user.permissions || [];
    const isPDEligible = userPerms.includes("*") || userPerms.includes("pd.review.respond");
    const pendingMyApprovals = await Approval.find({
      status: "pending",
      $or: [
        { approverId: userId },
        ...(isPDEligible ? [{ approverType: "principal_designer", approverId: { $in: [null, undefined] } }] : []),
      ],
    })
      .populate("projectId", "name trackingId")
      .select("targetType targetId approverType status gateId comments createdAt projectId")
      .sort({ createdAt: 1 })
      .limit(10)
      .lean();

    // 5. Gates blocking projects where I'm the primary owner/PM/principal designer.
    // Use any team-slot membership as the membership signal — keeps it general.
    const myProjects = await Project.find({
      $or: [
        { primaryDesigner: userId },
        { supervisor: userId },
        { designerB: userId },
        { designerC: userId },
        { designerD: userId },
        { designerE: userId },
        { contractor: userId },
      ],
    })
      .select("_id")
      .lean();

    const myProjectIds = myProjects.map((p) => p._id);

    const gatesIBlock = myProjectIds.length
      ? await ApprovalGate.find({
          projectId: { $in: myProjectIds },
          status: "open",
        })
          .populate("projectId", "name trackingId")
          .select("gateType label approverType listensTo projectId createdAt")
          .sort({ createdAt: 1 })
          .limit(15)
          .lean()
          // re-populate manually since populate above was on the query model (projectId)
      : [];

    // Decorate gates with aging
    const decoratedGates = gatesIBlock.map((g) => ({
      ...g,
      ageingDays: Math.max(0, Math.floor((Date.now() - new Date(g.createdAt).getTime()) / 86400000)),
    }));

    res.status(200).json({
      counts: {
        overdue: overdueTasks.length,
        upcoming: upcomingTasks.length,
        blocked: blockedTasks.length,
        pendingMyApprovals: pendingMyApprovals.length,
        gatesIBlock: decoratedGates.length,
      },
      overdueTasks,
      upcomingTasks,
      blockedTasks,
      pendingMyApprovals,
      gatesIBlock: decoratedGates,
    });
  } catch (err) {
    console.error("[getMyDay]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getMyDay };
