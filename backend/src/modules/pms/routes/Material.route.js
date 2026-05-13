const express = require("express");
const router = express.Router();
const {
  createMaterial,
  getProjectMaterials,
  updateMaterial,
} = require("../controllers/Material.controller");

// Create Material Selection
router.post("/create", createMaterial);

// Get Materials by Project
router.get("/project/:projectId", getProjectMaterials);

// Update Material Selection
router.put("/update/:id", updateMaterial);

module.exports = router;
