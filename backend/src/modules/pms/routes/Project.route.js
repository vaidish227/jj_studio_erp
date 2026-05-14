const express = require("express");
const router = express.Router();
const {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
} = require("../controllers/Project.controller");

// --- CRUD Routes for Project ---

// Create Project (Handover from Proposal)
router.post("/create", createProject);

// Get All Projects (with filters)
router.get("/all", getAllProjects);

// Get Single Project
router.get("/:id", getProjectById);

// Update Project
router.put("/update/:id", updateProject);

// Delete Project
router.delete("/delete/:id", deleteProject);

module.exports = router;
