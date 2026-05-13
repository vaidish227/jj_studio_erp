const Task = require("../models/Task.model");
const Project = require("../models/Project.model");

/**
 * @desc Create a new Design Task for a Project
 * @route POST /api/pms/task/create
 */
const createTask = async (req, res) => {
  try {
    const { projectId, taskType, title, assignedTo, dueDate, priority, checklist } = req.body;

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const task = await Task.create({
      projectId,
      taskType,
      title,
      assignedTo,
      dueDate,
      priority,
      checklist
    });

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      task
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Get all Tasks for a specific Project
 * @route GET /api/pms/task/project/:projectId
 */
const getTasksByProject = async (req, res) => {
  try {
    const tasks = await Task.find({ projectId: req.params.projectId })
      .populate("assignedTo", "name email")
      .populate("externalCoordination.vendorId", "name phone")
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Update Task status or details
 * @route PUT /api/pms/task/update/:id
 */
const updateTask = async (req, res) => {
  try {
    const updateData = { ...req.body };
    
    // If status is completed, set completedAt
    if (updateData.status === "completed" || updateData.status === "released_to_site") {
      updateData.completedAt = new Date();
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    res.status(200).json({
      success: true,
      message: "Task updated successfully",
      task
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Update Checklist Item
 * @route PATCH /api/pms/task/checklist/:taskId/:itemIndex
 */
const updateChecklistStatus = async (req, res) => {
  try {
    const { taskId, itemIndex } = req.params;
    const { isCompleted } = req.body;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    if (task.checklist[itemIndex]) {
      task.checklist[itemIndex].isCompleted = isCompleted;
      task.checklist[itemIndex].completedAt = isCompleted ? new Date() : null;
    }

    await task.save();
    res.status(200).json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc Delete Task
 * @route DELETE /api/pms/task/delete/:id
 */
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    res.status(200).json({ success: true, message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createTask,
  getTasksByProject,
  updateTask,
  updateChecklistStatus,
  deleteTask
};
