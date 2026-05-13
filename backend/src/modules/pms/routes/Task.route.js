const express = require("express");
const router = express.Router();
const {
  createTask,
  getTasksByProject,
  updateTask,
  updateChecklistStatus,
  deleteTask,
} = require("../controllers/Task.controller");

// Create Task
router.post("/create", createTask);

// Get Tasks by Project ID
router.get("/project/:projectId", getTasksByProject);

// Update Task (Status, Assignment, etc.)
router.put("/update/:id", updateTask);

// Update specific checklist item status
router.patch("/checklist/:taskId/:itemIndex", updateChecklistStatus);

// Delete Task
router.delete("/delete/:id", deleteTask);

module.exports = router;
