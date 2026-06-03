const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  listChecklistTemplates,
  getChecklistTemplate,
  createChecklistTemplate,
  updateChecklistTemplate,
  deleteChecklistTemplate,
  listWorkflowTemplates,
  getWorkflowTemplate,
} = require("../controllers/TemplateAdmin.controller");

// ChecklistTemplate CRUD
router.get("/checklist",        requirePermission("settings.checklists.manage"), listChecklistTemplates);
router.get("/checklist/:id",    requirePermission("settings.checklists.manage"), getChecklistTemplate);
router.post("/checklist",       requirePermission("settings.checklists.manage"), createChecklistTemplate);
router.patch("/checklist/:id",  requirePermission("settings.checklists.manage"), updateChecklistTemplate);
router.delete("/checklist/:id", requirePermission("settings.checklists.manage"), deleteChecklistTemplate);

// WorkflowTemplate read-only (Phase 4 will add full editor)
router.get("/workflow",      requirePermission("settings.workflows.manage"), listWorkflowTemplates);
router.get("/workflow/:id",  requirePermission("settings.workflows.manage"), getWorkflowTemplate);

module.exports = router;
