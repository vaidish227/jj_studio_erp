const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  createTask,
  getMyTasks,
  getAllTasks,
  getTasksByProject,
  getTaskById,
  updateTask,
  updateChecklistStatus,
  deleteTask,
  getReviewQueue,
  submitTask,
  approveTask,
  requestRevision,
  reassignTask,
} = require("../controllers/Task.controller");
const { overrideTaskBlockers } = require("../controllers/GateOverride.controller");
const { requireTaskAccess } = require("../middleware/gateEnforcement");

// Static segment routes MUST come before /:id param catch-all
router.get("/my-tasks",           requirePermission("tasks.read"),    getMyTasks);
router.get("/review-queue",       requirePermission("tasks.approve"), getReviewQueue);
router.get("/all",                requirePermission("tasks.read"),    getAllTasks);
router.get("/project/:projectId", requirePermission("tasks.read"),    getTasksByProject);
router.get("/:id",                requirePermission("tasks.read"),    getTaskById);

router.post("/create", requirePermission("tasks.create"), createTask);

// Task update — gate check applies because status transitions can lift "blocked".
// Override is consumed by gateEnforcement when body.overrideReason + permission present.
router.put(
  "/update/:id",
  requirePermission("tasks.update"),
  requireTaskAccess({ activity: "task.update", taskIdParam: "id", errorCode: "BLOCKED_BY_GATE" }),
  updateTask
);
router.patch("/checklist/:taskId/:itemIndex", requirePermission("tasks.update"),   updateChecklistStatus);

// Workflow transitions
router.patch(
  "/submit/:id",
  requirePermission("tasks.submit"),
  requireTaskAccess({ activity: "task.submit", taskIdParam: "id", errorCode: "BLOCKED_BY_GATE" }),
  submitTask
);
router.patch("/approve/:id",          requirePermission("tasks.approve"),  approveTask);
router.patch("/request-revision/:id", requirePermission("tasks.approve"),  requestRevision);
router.patch("/reassign/:id",         requirePermission("tasks.reassign"), reassignTask);

// Phase 1 — Workflow Engine task-level gate override (used by BlockedByChip)
router.post(
  "/:id/override",
  requirePermission("tasks.override_gate"),
  overrideTaskBlockers
);

router.delete("/delete/:id", requirePermission("tasks.delete"), deleteTask);

module.exports = router;
