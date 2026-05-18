const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  updateKickstart,
  updateTeam,
  updateClientApproval,
} = require("../controllers/Project.controller");

// List & detail
router.get("/all",  requirePermission("projects.read"), getAllProjects);
router.get("/:id",  requirePermission("projects.read"), getProjectById);

// Create
router.post("/create", requirePermission("projects.create"), createProject);

// Update
router.put("/update/:id",              requirePermission("projects.update"), updateProject);
router.patch("/kickstart/:id",         requirePermission("projects.update"), updateKickstart);
router.patch("/team/:id",              requirePermission("projects.update"), updateTeam);
router.patch("/client-approval/:id",   requirePermission("projects.update"), updateClientApproval);

// Delete
router.delete("/delete/:id", requirePermission("projects.delete"), deleteProject);

module.exports = router;
