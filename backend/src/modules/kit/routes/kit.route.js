const express = require("express");
const router  = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");

const {
  createTemplate, getTemplates, getTemplateById, updateTemplate, deleteTemplate,
  getVariables, previewTemplate,
} = require("../controllers/template.controller");

// ─── Templates ────────────────────────────────────────────────────────────────
// Static routes first so they aren't captured by /templates/:id.
router.get("/templates/variables", requirePermission("kit.tab.templates"), getVariables);
router.post("/templates/preview",  requirePermission("kit.tab.templates"), previewTemplate);

router.get("/templates",     requirePermission("kit.tab.templates"), getTemplates);
router.post("/templates",    requirePermission("kit.manage"),        createTemplate);
router.get("/templates/:id", requirePermission("kit.tab.templates"), getTemplateById);
router.put("/templates/:id", requirePermission("kit.manage"),        updateTemplate);
router.delete("/templates/:id", requirePermission("kit.manage"),     deleteTemplate);

module.exports = router;
