const Project = require("../models/Project.model");
const CRMClient = require("../../../modules/crm/models/Client.model")

/**
 * @desc Create a new Project (usually from an approved Proposal)
 * @route POST /api/pms/project/create
 */
const createProject = async (req, res) => {
  try {
    const {
      clientId,
      proposalId,
      name,
      projectType,
      siteAddress,
      area,
      budget,
      primaryDesigner,
      supervisor,
      scopeOfWork,
      estimatedCompletionDate
    } = req.body;

    // Check if project already exists for this proposal
    const existingProject = await Project.findOne({ proposalId });
    if (existingProject) {
      return res.status(400).json({
        success: false,
        message: "A project already exists for this proposal",
        project: existingProject
      });
    }

    const project = await Project.create({
      clientId,
      proposalId,
      name,
      projectType,
      siteAddress,
      area,
      budget,
      primaryDesigner,
      supervisor,
      scopeOfWork,
      estimatedCompletionDate
    });

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      project
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Get all Projects with filtering and pagination
 * @route GET /api/pms/project/all
 */
const getAllProjects = async (req, res) => {
  try {
    const { status, projectType, designerId } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (projectType) filter.projectType = projectType;
    if (designerId) filter.primaryDesigner = designerId;

    const projects = await Project.find(filter)
      .populate("clientId", "name phone email trackingId")
      .populate("proposalId", "title totalAmount")
      .populate("primaryDesigner", "name email")
      .populate("supervisor", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: projects.length,
      projects
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Get Project by ID
 * @route GET /api/pms/project/:id
 */
const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("clientId")
      .populate("proposalId")
      .populate("primaryDesigner", "name email")
      .populate("supervisor", "name email");

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    res.status(200).json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Update Project details
 * @route PUT /api/pms/project/update/:id
 */
const updateProject = async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    res.status(200).json({
      success: true,
      message: "Project updated successfully",
      project
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Delete Project
 * @route DELETE /api/pms/project/delete/:id
 */
const deleteProject = async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    res.status(200).json({
      success: true,
      message: "Project deleted successfully"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject
};
