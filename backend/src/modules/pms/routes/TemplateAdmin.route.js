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
  getWorkflowTemplateOptions,
  updateWorkflowTemplate,
  createWorkflowTemplate,
  deleteWorkflowTemplate,
} = require("../controllers/TemplateAdmin.controller");

// ChecklistTemplate CRUD
router.get("/checklist",        requirePermission("settings.checklists.manage"), listChecklistTemplates);
router.get("/checklist/:id",    requirePermission("settings.checklists.manage"), getChecklistTemplate);
router.post("/checklist",       requirePermission("settings.checklists.manage"), createChecklistTemplate);
router.patch("/checklist/:id",  requirePermission("settings.checklists.manage"), updateChecklistTemplate);
router.delete("/checklist/:id", requirePermission("settings.checklists.manage"), deleteChecklistTemplate);

// WorkflowTemplate CRUD (Phase 4 — Clone & Edit)
router.get("/workflow",         requirePermission("settings.workflows.manage"), listWorkflowTemplates);
router.get("/workflow/options", requirePermission("settings.workflows.manage"), getWorkflowTemplateOptions);
router.get("/workflow/:id",     requirePermission("settings.workflows.manage"), getWorkflowTemplate);
router.post("/workflow",        requirePermission("settings.workflows.manage"), createWorkflowTemplate);
router.patch("/workflow/:id",   requirePermission("settings.workflows.manage"), updateWorkflowTemplate);
router.delete("/workflow/:id",  requirePermission("settings.workflows.manage"), deleteWorkflowTemplate);

module.exports = router;
