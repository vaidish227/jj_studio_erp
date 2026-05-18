const Task = require("../models/Task.model");
const Project = require("../models/Project.model");
const {
  createTaskSchema,
  updateTaskSchema,
  checklistUpdateSchema,
} = require("../validator/Task.validator");
const { logActivity } = require("../../../shared/activityLogger");

/**
 * @route POST /api/pms/task/create
 */
const createTask = async (req, res) => {
  try {
    const { error, value } = createTaskSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    if (!value.assignedTo) delete value.assignedTo;

    const project = await Project.findById(value.projectId).lean();
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const task = await Task.create(value);

    logActivity({
      projectId:   task.projectId,
      actorId:     req.user._id,
      entityType:  "task",
      entityId:    task._id,
      action:      "created",
      description: `Task "${task.title}" created`,
    });

    res.status(201).json({
      message: "Task created successfully",
      task,
    });
  } catch (error) {
    console.error("[createTask]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/task/my-tasks
 * Must be declared before /:id to avoid route shadowing.
 */
const getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ assignedTo: req.user._id })
      .populate("projectId", "name trackingId status")
      .populate("assignedTo", "name email")
      .sort({ dueDate: 1, createdAt: -1 });

    res.status(200).json({ count: tasks.length, tasks });
  } catch (error) {
    console.error("[getMyTasks]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/task/project/:projectId
 */
const getTasksByProject = async (req, res) => {
  try {
    const tasks = await Task.find({ projectId: req.params.projectId })
      .populate("assignedTo", "name email")
      .populate("externalCoordination.vendorId", "name phone")
      .sort({ createdAt: 1 });

    res.status(200).json({ count: tasks.length, tasks });
  } catch (error) {
    console.error("[getTasksByProject]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route GET /api/pms/task/:id
 */
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("projectId", "name trackingId status")
      .populate("assignedTo", "name email")
      .populate("externalCoordination.vendorId", "name phone");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.status(200).json({ task });
  } catch (error) {
    console.error("[getTaskById]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PUT /api/pms/task/update/:id
 * Only fields defined in updateTaskSchema can be changed.
 * Immutable fields (projectId, taskType) are never touched.
 */
const updateTask = async (req, res) => {
  try {
    const { error, value } = updateTaskSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details.map((d) => d.message).join('; ') });
    }

    // Auto-set completedAt when moving to a terminal status
    if (value.status === "completed" || value.status === "released_to_site") {
      value.completedAt = new Date();
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    )
      .populate("assignedTo", "name email")
      .populate("externalCoordination.vendorId", "name phone");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const action = value.status ? "status_changed" : "updated";
    const description = value.status
      ? `Task "${task.title}" status changed to ${value.status}`
      : `Task "${task.title}" updated`;

    logActivity({
      projectId:   task.projectId,
      actorId:     req.user._id,
      entityType:  "task",
      entityId:    task._id,
      action,
      description,
      metadata:    value.status ? { to: value.status } : undefined,
    });

    res.status(200).json({ message: "Task updated successfully", task });
  } catch (error) {
    console.error("[updateTask]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route PATCH /api/pms/task/checklist/:taskId/:itemIndex
 */
const updateChecklistStatus = async (req, res) => {
  try {
    const { error, value } = checklistUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { taskId, itemIndex } = req.params;
    const idx = Number(itemIndex);

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    if (idx < 0 || idx >= task.checklist.length) {
      return res.status(400).json({ message: "Invalid checklist item index" });
    }

    task.checklist[idx].isCompleted = value.isCompleted;
    task.checklist[idx].completedAt = value.isCompleted ? new Date() : null;

    await task.save();
    res.status(200).json({ message: "Checklist updated", task });
  } catch (error) {
    console.error("[updateChecklistStatus]", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @route DELETE /api/pms/task/delete/:id
 */
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("[deleteTask]", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createTask,
  getMyTasks,
  getTasksByProject,
  getTaskById,
  updateTask,
  updateChecklistStatus,
  deleteTask,
};
