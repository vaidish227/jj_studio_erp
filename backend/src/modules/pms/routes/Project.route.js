const express = require("express");
const router = express.Router();
const { requirePermission, requireRole } = require("../../../middleware/auth.middleware");
const {
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
} = require("../controllers/Project.controller");
const { overrideGate } = require("../controllers/GateOverride.controller");

// List & detail — static routes MUST come before /:id
router.get("/all",         requirePermission("projects.read"), getAllProjects);
router.get("/my-projects", requirePermission("projects.read"), getMyProjects);
router.get("/:id/gates",   requirePermission("projects.read"), getProjectGates);
router.get("/:id",         requirePermission("projects.read"), getProjectById);

// Create
router.post("/create", requirePermission("projects.create"), createProject);

// Update
router.put("/update/:id",              requirePermission("projects.update"), updateProject);
router.patch("/kickstart/:id",         requirePermission("projects.update"), updateKickstart);
router.patch("/team/:id",              requireRole("admin", "md", "manager"), updateTeam);
router.patch("/client-approval/:id",   requirePermission("projects.update"), updateClientApproval);

// Phase 1 — Workflow Engine gate override (PM bypass)
router.post(
  "/:id/gates/:gateId/override",
  requirePermission("tasks.override_gate"),
  overrideGate
);

// Delete
router.delete("/delete/:id", requirePermission("projects.delete"), deleteProject);

module.exports = router;
