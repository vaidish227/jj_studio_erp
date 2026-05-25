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
} = require("../controllers/Project.controller");

// List & detail — static routes MUST come before /:id
router.get("/all",         requirePermission("projects.read"), getAllProjects);
router.get("/my-projects", requirePermission("projects.read"), getMyProjects);
router.get("/:id",         requirePermission("projects.read"), getProjectById);

// Create
router.post("/create", requirePermission("projects.create"), createProject);

// Update
router.put("/update/:id",              requirePermission("projects.update"), updateProject);
router.patch("/kickstart/:id",         requirePermission("projects.update"), updateKickstart);
router.patch("/team/:id",              requireRole("admin", "md", "manager"), updateTeam);
router.patch("/client-approval/:id",   requirePermission("projects.update"), updateClientApproval);

// Delete
router.delete("/delete/:id", requirePermission("projects.delete"), deleteProject);

module.exports = router;
