const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const { createTemplate, getTemplates, getTemplateById, updateTemplate, deleteTemplate } = require("../controllers/Template.controller");

router.get("/get",         requirePermission("template.read"),   getTemplates);
router.get("/getbyid/:id", requirePermission("template.read"),   getTemplateById);
router.post("/create",     requirePermission("template.create"), createTemplate);
router.put("/update/:id",  requirePermission("template.update"), updateTemplate);
router.delete("/delete/:id", requirePermission("template.delete"), deleteTemplate);

module.exports = router;