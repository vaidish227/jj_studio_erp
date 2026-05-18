const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  createTask,
  getMyTasks,
  getTasksByProject,
  getTaskById,
  updateTask,
  updateChecklistStatus,
  deleteTask,
} = require("../controllers/Task.controller");

// Must be declared before /:id to avoid route shadowing
router.get("/my-tasks",           requirePermission("tasks.read"), getMyTasks);
router.get("/project/:projectId", requirePermission("tasks.read"), getTasksByProject);
router.get("/:id",                requirePermission("tasks.read"), getTaskById);

router.post("/create", requirePermission("tasks.create"), createTask);

router.put("/update/:id",                    requirePermission("tasks.update"), updateTask);
router.patch("/checklist/:taskId/:itemIndex", requirePermission("tasks.update"), updateChecklistStatus);

router.delete("/delete/:id", requirePermission("tasks.delete"), deleteTask);

module.exports = router;
