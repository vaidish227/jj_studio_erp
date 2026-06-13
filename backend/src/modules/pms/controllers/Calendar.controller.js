const Task              = require("../models/Task.model");
const ProjectMilestone  = require("../models/ProjectMilestone.model");
const SiteVisit         = require("../models/SiteVisit.model");
const PurchaseOrder     = require("../models/PurchaseOrder.model");
const Project           = require("../models/Project.model");

// Roles that see the whole-organisation calendar. Everyone else (designer,
// supervisor, accounts, …) gets a calendar scoped to their own work only.
const FULL_VIEW_ROLES = ["admin", "md", "manager"];

/**
 * @route GET /api/pms/calendar/events
 * Aggregates events from Tasks, Milestones, SiteVisits, POs and Project deadlines
 * into a unified calendar event list for the given date range.
 *
 * Scoping: privileged roles (admin/md/manager) see every user's events. All
 * other roles — designers in particular — see ONLY their own activities:
 * tasks assigned to them, milestones assigned to them, site visits they're
 * the visitor for, and deadlines of projects they're a team member of.
 * PO deliveries (procurement) are omitted from a scoped calendar entirely.
 *
 * Query params:
 *   startDate  (required) ISO date string
 *   endDate    (required) ISO date string
 *   projectId  (optional) filter to a single project
 *   types[]    (optional) filter event types: task_due, milestone, site_visit, po_delivery, project_deadline
 */
const getCalendarEvents = async (req, res) => {
  try {
    const { startDate, endDate, projectId } = req.query;
    const types = req.query["types[]"]
      ? [].concat(req.query["types[]"])
      : ["task_due", "milestone", "site_visit", "po_delivery", "project_deadline"];

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate are required" });
    }

    const start = new Date(startDate);
    const end   = new Date(endDate);

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    // JWT payload is { id, email, role } — resolve the requester's id robustly.
    const userId      = req.user?.id || req.user?._id;
    const scopeToSelf = !FULL_VIEW_ROLES.includes(req.user?.role);

    const projectFilter = projectId ? { projectId } : {};
    // Per-entity ownership filter applied only when the calendar is self-scoped.
    const ownerFilter = (field) =>
      scopeToSelf && userId ? { [field]: userId } : {};
    const events = [];

    // ── Task due dates ────────────────────────────────────────────────────────
    if (types.includes("task_due")) {
      const tasks = await Task.find({
        ...projectFilter,
        ...ownerFilter("assignedTo"),
        dueDate: { $gte: start, $lte: end },
      })
        .populate("projectId", "name trackingId")
        .populate("assignedTo", "name")
        .select("title taskType status priority dueDate projectId assignedTo");

      tasks.forEach((t) => {
        events.push({
          id:          `task-${t._id}`,
          type:        "task_due",
          title:       t.title,
          date:        t.dueDate,
          status:      t.status,
          priority:    t.priority,
          projectId:   t.projectId?._id,
          projectName: t.projectId?.name,
          assignee:    t.assignedTo?.name,
          assigneeId:  t.assignedTo?._id,
          entityId:    t._id,
          color:       "#D4B76C",
        });
      });
    }

    // ── Milestones ────────────────────────────────────────────────────────────
    if (types.includes("milestone")) {
      const milestones = await ProjectMilestone.find({
        ...projectFilter,
        ...ownerFilter("assignedTo"),
        dueDate: { $gte: start, $lte: end },
      })
        .populate("projectId", "name trackingId")
        .populate("assignedTo", "name")
        .select("title status isCritical dueDate projectId assignedTo");

      milestones.forEach((m) => {
        events.push({
          id:          `milestone-${m._id}`,
          type:        "milestone",
          title:       m.title,
          date:        m.dueDate,
          status:      m.status,
          isCritical:  m.isCritical,
          projectId:   m.projectId?._id,
          projectName: m.projectId?.name,
          assignee:    m.assignedTo?.name,
          assigneeId:  m.assignedTo?._id,
          entityId:    m._id,
          color:       "#3A6EA5",
        });
      });
    }

    // ── Site Visits ───────────────────────────────────────────────────────────
    if (types.includes("site_visit")) {
      const visits = await SiteVisit.find({
        ...projectFilter,
        ...ownerFilter("visitorId"),
        visitDate: { $gte: start, $lte: end },
      })
        .populate("projectId", "name trackingId")
        .populate("visitorId", "name")
        .select("purpose status visitDate projectId visitorId");

      visits.forEach((v) => {
        events.push({
          id:          `visit-${v._id}`,
          type:        "site_visit",
          title:       v.purpose,
          date:        v.visitDate,
          status:      v.status,
          projectId:   v.projectId?._id,
          projectName: v.projectId?.name,
          assignee:    v.visitorId?.name,
          assigneeId:  v.visitorId?._id,
          entityId:    v._id,
          color:       "#4A8F7C",
        });
      });
    }

    // ── Purchase Order deliveries ─────────────────────────────────────────────
    // Procurement-only — never shown on a self-scoped (e.g. designer) calendar.
    if (types.includes("po_delivery") && !scopeToSelf) {
      const pos = await PurchaseOrder.find({
        ...projectFilter,
        expectedDeliveryDate: { $gte: start, $lte: end },
      })
        .populate("projectId", "name trackingId")
        .populate("vendorId", "name")
        .select("poNumber totalAmount status expectedDeliveryDate projectId vendorId");

      pos.forEach((po) => {
        events.push({
          id:          `po-${po._id}`,
          type:        "po_delivery",
          title:       `PO ${po.poNumber} — ${po.vendorId?.name || "Vendor"}`,
          date:        po.expectedDeliveryDate,
          status:      po.status,
          projectId:   po.projectId?._id,
          projectName: po.projectId?.name,
          entityId:    po._id,
          color:       "#E67E22",
        });
      });
    }

    // ── Project deadlines ─────────────────────────────────────────────────────
    if (types.includes("project_deadline")) {
      const projectQuery = {
        estimatedCompletionDate: { $gte: start, $lte: end },
      };
      if (projectId) projectQuery._id = projectId;
      // Self-scoped: only deadlines of projects the requester is a team member of.
      if (scopeToSelf && userId) projectQuery["assignments.users"] = userId;

      const projects = await Project.find(projectQuery)
        .select("name trackingId status estimatedCompletionDate");

      projects.forEach((p) => {
        events.push({
          id:          `project-${p._id}`,
          type:        "project_deadline",
          title:       `${p.name} — Deadline`,
          date:        p.estimatedCompletionDate,
          status:      p.status,
          projectId:   p._id,
          projectName: p.name,
          entityId:    p._id,
          color:       "#D93025",
        });
      });
    }

    // Sort all events by date ascending
    events.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json({ count: events.length, events });
  } catch (error) {
    console.error("[getCalendarEvents]", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getCalendarEvents };
