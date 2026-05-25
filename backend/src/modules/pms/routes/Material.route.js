const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  createMaterial,
  getProjectMaterials,
  updateMaterial,
} = require("../controllers/Material.controller");

router.post("/create",            requirePermission("materials.create"), createMaterial);
router.get("/project/:projectId", requirePermission("materials.read"),   getProjectMaterials);
router.put("/update/:id",         requirePermission("materials.update"), updateMaterial);

module.exports = router;
