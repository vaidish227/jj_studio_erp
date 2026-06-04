const express = require("express");
const router  = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");

const {
  createTemplate, getTemplates, getTemplateById, updateTemplate, deleteTemplate,
  getVariables, previewTemplate,
} = require("../controllers/template.controller");
const {
  createCampaign, getCampaigns, getCampaignById, updateCampaign, deleteCampaign,
  addStep, updateStep, deleteStep, reorderSteps,
  enroll, getEnrollments, stopEnrollment,
} = require("../controllers/campaign.controller");
const {
  getTriggerCatalog,
  createWorkflow, getWorkflows, getWorkflowById, updateWorkflow, toggleWorkflow, deleteWorkflow,
} = require("../controllers/workflow.controller");

// ─── Templates ────────────────────────────────────────────────────────────────
// Static routes first so they aren't captured by /templates/:id.
router.get("/templates/variables", requirePermission("kit.tab.templates"), getVariables);
router.post("/templates/preview",  requirePermission("kit.tab.templates"), previewTemplate);

router.get("/templates",     requirePermission("kit.tab.templates"), getTemplates);
router.post("/templates",    requirePermission("kit.manage"),        createTemplate);
router.get("/templates/:id", requirePermission("kit.tab.templates"), getTemplateById);
router.put("/templates/:id", requirePermission("kit.manage"),        updateTemplate);
router.delete("/templates/:id", requirePermission("kit.manage"),     deleteTemplate);

// ─── Enrollments (static before campaigns/:id catch-alls is not needed — separate base) ──
router.get("/enrollments",          requirePermission("kit.read"),   getEnrollments);
router.post("/enrollments/:id/stop", requirePermission("kit.update"), stopEnrollment);

// ─── Campaigns ────────────────────────────────────────────────────────────────
router.get("/campaigns",     requirePermission("kit.read"),   getCampaigns);
router.post("/campaigns",    requirePermission("kit.create"), createCampaign);
router.get("/campaigns/:id", requirePermission("kit.read"),   getCampaignById);
router.put("/campaigns/:id", requirePermission("kit.update"), updateCampaign);
router.delete("/campaigns/:id", requirePermission("kit.manage"), deleteCampaign);

// Campaign steps
router.post("/campaigns/:id/steps",            requirePermission("kit.update"), addStep);
router.put("/campaigns/:id/steps/reorder",     requirePermission("kit.update"), reorderSteps);
router.put("/campaigns/:id/steps/:stepId",     requirePermission("kit.update"), updateStep);
router.delete("/campaigns/:id/steps/:stepId",  requirePermission("kit.update"), deleteStep);

// Enroll entities into a campaign
router.post("/campaigns/:id/enroll", requirePermission("kit.update"), enroll);

// ─── Workflows (automation) ───────────────────────────────────────────────────
router.get("/triggers/catalog", requirePermission("kit.read"), getTriggerCatalog);

router.get("/workflows",     requirePermission("kit.read"),   getWorkflows);
router.post("/workflows",    requirePermission("kit.manage"), createWorkflow);
router.get("/workflows/:id", requirePermission("kit.read"),   getWorkflowById);
router.put("/workflows/:id", requirePermission("kit.manage"), updateWorkflow);
router.post("/workflows/:id/toggle", requirePermission("kit.manage"), toggleWorkflow);
router.delete("/workflows/:id", requirePermission("kit.manage"), deleteWorkflow);

module.exports = router;
