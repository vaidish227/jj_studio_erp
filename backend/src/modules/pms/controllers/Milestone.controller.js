const ProjectMilestone = require("../models/ProjectMilestone.model");
const { createMilestoneSchema, updateMilestoneSchema } = require("../validator/Milestone.validator");
const { logActivity } = require("../../../shared/activityLogger");

/**
 * @route POST /api/pms/milestone/create
 */
const createMilestone = async (req, res) => {
  try {
    const { error, value } = createMilestoneSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    if (!value.assignedTo) delete value.assignedTo;

    const milestone = await ProjectMilestone.create(value);

    logActivity({
      projectId:   value.projectId,
      actorId:     req.user._id,
      entityType:  "milestone",
      entityId:    milestone._id,
      action:      "created",
      description: `Milestone "${milestone.title}" created`,
    });

    res.status(201).json({ message: "Milestone created", milestone });
  } catch (error) {
    console.error("[createMilestone]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/milestone/project/:projectId
 */
const getMilestonesByProject = async (req, res) => {
  try {
    const milestones = await ProjectMilestone.find({ projectId: req.params.projectId })
      .populate("assignedTo", "name email")
      .sort({ order: 1, dueDate: 1 });

    res.status(200).json({ count: milestones.length, milestones });
  } catch (error) {
    console.error("[getMilestonesByProject]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PUT /api/pms/milestone/update/:id
 */
const updateMilestone = async (req, res) => {
  try {
    const { error, value } = updateMilestoneSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    // Auto-set completedDate when status flips to completed
    if (value.status === "completed" && !value.completedDate) {
      value.completedDate = new Date();
    }

    const prev = await ProjectMilestone.findById(req.params.id).lean();
    if (!prev) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    const milestone = await ProjectMilestone.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    ).populate("assignedTo", "name email");

    if (value.status && value.status !== prev.status) {
      logActivity({
        projectId:   prev.projectId,
        actorId:     req.user._id,
        entityType:  "milestone",
        entityId:    milestone._id,
        action:      "status_changed",
        description: `Milestone "${milestone.title}" moved to ${value.status}`,
        metadata:    { from: prev.status, to: value.status },
      });
    }

    res.status(200).json({ message: "Milestone updated", milestone });
  } catch (error) {
    console.error("[updateMilestone]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route DELETE /api/pms/milestone/delete/:id
 */
const deleteMilestone = async (req, res) => {
  try {
    const milestone = await ProjectMilestone.findByIdAndDelete(req.params.id);
    if (!milestone) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    logActivity({
      projectId:   milestone.projectId,
      actorId:     req.user._id,
      entityType:  "milestone",
      entityId:    milestone._id,
      action:      "deleted",
      description: `Milestone "${milestone.title}" deleted`,
    });

    res.status(200).json({ message: "Milestone deleted" });
  } catch (error) {
    console.error("[deleteMilestone]", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createMilestone,
  getMilestonesByProject,
  updateMilestone,
  deleteMilestone,
};
