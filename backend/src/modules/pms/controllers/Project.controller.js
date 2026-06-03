const Project = require("../models/Project.model");
const {
  createProjectSchema,
  updateProjectSchema,
  kickstartSchema,
  teamSchema,
  clientApprovalSchema,
} = require("../validator/Project.validator");
const { logActivity } = require("../../../shared/activityLogger");
const workflowEngine = require("../services/workflowEngine");

const WORKFLOW_ENGINE_V1 =
  String(process.env.WORKFLOW_ENGINE_V1 || "").toLowerCase() === "true";

const TEAM_POPULATE = [
  { path: "primaryDesigner", select: "name email role" },
  { path: "supervisor",      select: "name email role" },
  { path: "designerB",       select: "name email role" },
  { path: "designerC",       select: "name email role" },
  { path: "designerD",       select: "name email role" },
  { path: "designerE",       select: "name email role" },
  { path: "contractor",      select: "name email role" },
];

/**
 * @route POST /api/pms/project/create
 */
const createProject = async (req, res) => {
  try {
    const { error, value } = createProjectSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    // Strip empty proposalId so Mongoose doesn't try to cast '' → ObjectId
    if (!value.proposalId) delete value.proposalId;
    if (!value.primaryDesigner) delete value.primaryDesigner;
    if (!value.supervisor) delete value.supervisor;

    const existingProject = await Project.findOne({ proposalId: value.proposalId }).lean();
    if (value.proposalId && existingProject) {
      return res.status(409).json({
        message: "A project already exists for this proposal",
        project: existingProject,
      });
    }

    const project = await Project.create(value);

    logActivity({
      projectId:   project._id,
      actorId:     req.user._id,
      entityType:  "project",
      entityId:    project._id,
      action:      "created",
      description: `Project "${project.name}" created`,
    });

    res.status(201).json({
      message: "Project created successfully",
      project,
    });
  } catch (error) {
    console.error("[createProject]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/project/all
 */
const getAllProjects = async (req, res) => {
  try {
    const { status, projectType, designerId, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (status)      filter.status          = status;
    if (projectType) filter.projectType     = projectType;
    if (designerId)  filter.primaryDesigner = designerId;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Project.countDocuments(filter);

    const projects = await Project.find(filter)
      .populate("clientId",   "name phone email trackingId")
      .populate("proposalId", "title totalAmount")
      .populate(TEAM_POPULATE)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      total,
      page:  Number(page),
      count: projects.length,
      projects,
    });
  } catch (error) {
    console.error("[getAllProjects]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/project/:id
 */
const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("clientId")
      .populate("proposalId")
      .populate(TEAM_POPULATE);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.status(200).json({ project });
  } catch (error) {
    console.error("[getProjectById]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PUT /api/pms/project/update/:id
 * Only the fields defined in updateProjectSchema can be changed.
 * Immutable fields (trackingId, clientId, proposalId) are never touched.
 */
const updateProject = async (req, res) => {
  try {
    const { error, value } = updateProjectSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    ).populate(TEAM_POPULATE);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    logActivity({
      projectId:   project._id,
      actorId:     req.user._id,
      entityType:  "project",
      entityId:    project._id,
      action:      "updated",
      description: `Project "${project.name}" updated`,
      metadata:    value,
    });

    res.status(200).json({ message: "Project updated successfully", project });
  } catch (error) {
    console.error("[updateProject]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route DELETE /api/pms/project/delete/:id
 */
const deleteProject = async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    res.status(200).json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("[deleteProject]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PATCH /api/pms/project/kickstart/:id
 */
const updateKickstart = async (req, res) => {
  try {
    const { error, value } = kickstartSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const setFields = {};
    for (const [key, val] of Object.entries(value)) {
      setFields[`kickstartData.${key}`] = val;
    }

    // Auto-mark kickstartCompleted when all 6 items will be true after this update
    const merged = { ...project.kickstartData.toObject(), ...value };
    setFields.kickstartCompleted = Object.values(merged).every(Boolean);

    const updated = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: setFields },
      { new: true }
    );

    res.status(200).json({
      message: setFields.kickstartCompleted ? "Kickstart process completed" : "Kickstart updated",
      kickstartData:      updated.kickstartData,
      kickstartCompleted: updated.kickstartCompleted,
    });
  } catch (error) {
    console.error("[updateKickstart]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PATCH /api/pms/project/team/:id
 */
const updateTeam = async (req, res) => {
  try {
    const { error, value } = teamSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    // Convert empty strings to null (clears the assignment)
    const setFields = {};
    for (const [key, val] of Object.entries(value)) {
      setFields[key] = val || null;
    }

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: setFields },
      { new: true }
    ).populate(TEAM_POPULATE);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    logActivity({
      projectId:   project._id,
      actorId:     req.user._id,
      entityType:  "project",
      entityId:    project._id,
      action:      "team_updated",
      description: `Team updated on project "${project.name}"`,
      metadata:    value,
    });

    res.status(200).json({ message: "Team updated", project });
  } catch (error) {
    console.error("[updateTeam]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PATCH /api/pms/project/client-approval/:id
 */
const updateClientApproval = async (req, res) => {
  try {
    const { error, value } = clientApprovalSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    const { type, status, obtainedAt, notes } = value;

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const idx = project.clientApprovals.findIndex((a) => a.type === type);
    const prevStatus = idx > -1 ? project.clientApprovals[idx].status : null;
    if (idx > -1) {
      if (status     !== undefined) project.clientApprovals[idx].status     = status;
      if (obtainedAt !== undefined) project.clientApprovals[idx].obtainedAt = obtainedAt;
      if (notes      !== undefined) project.clientApprovals[idx].notes      = notes;
    } else {
      project.clientApprovals.push({ type, status, obtainedAt, notes });
    }

    await project.save();

    // Activity log
    try {
      await logActivity({
        projectId:   project._id,
        actorId:     req.user?._id,
        entityType:  "approval",
        entityId:    project._id,
        action:      "status_changed",
        description: `Client approval "${type}" set to "${status || prevStatus || "pending"}"`,
        metadata:    { type, status, previousStatus: prevStatus },
      });
    } catch (e) {
      // best-effort
    }

    // Workflow Engine cascade — close matching gates and unblock downstream tasks
    let cascadeSummary = null;
    if (WORKFLOW_ENGINE_V1 && status === "obtained") {
      try {
        cascadeSummary = await workflowEngine.onClientApprovalObtained({
          projectId:   project._id,
          approvalType: type,
          actorId:     req.user?._id,
        });
        await workflowEngine.recomputeProjectPhase(project._id);
        // Phase 3a — keep progress % fresh
        await workflowEngine.recomputeProjectProgress(project._id);
      } catch (engineErr) {
        console.error("[updateClientApproval:workflowEngine]", engineErr);
        // Do not fail the user request if the engine misbehaves.
      }
    }

    res.status(200).json({
      message: "Client approval updated",
      clientApprovals: project.clientApprovals,
      workflow: cascadeSummary,
    });
  } catch (error) {
    console.error("[updateClientApproval]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/project/my-projects
 * Returns only projects where the logged-in user is part of the design team.
 * Used by designer role to enforce project visibility isolation.
 */
const getMyProjects = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, page = 1, limit = 50 } = req.query;

    const filter = {
      $or: [
        { primaryDesigner: userId },
        { designerB: userId },
        { designerC: userId },
        { designerD: userId },
        { designerE: userId },
        { supervisor:  userId },
        { contractor:  userId },
      ],
    };

    if (status) filter.status = status;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Project.countDocuments(filter);

    const projects = await Project.find(filter)
      .populate("clientId",   "name phone email trackingId")
      .populate("proposalId", "title totalAmount")
      .populate(TEAM_POPULATE)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({ total, page: Number(page), count: projects.length, projects });
  } catch (error) {
    console.error("[getMyProjects]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/project/:id/gates
 * Phase 2 — surfaces the Workflow Engine's open/closed/overridden gates with
 * decorated blocking tasks, aging, and linked approvals so the ProjectGatesTab
 * can render "what is blocking us".
 */
const getProjectGates = async (req, res) => {
  try {
    const gates = await workflowEngine.listGatesForProject(req.params.id);
    res.status(200).json({ count: gates.length, gates });
  } catch (err) {
    console.error("[getProjectGates]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createProject,
  getAllProjects,
  getMyProjects,
  getProjectById,
  updateProject,
  deleteProject,
  updateKickstart,
  updateTeam,
  updateClientApproval,
  getProjectGates,
};
