const express = require("express");
const router  = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const multer = require("multer");

const {
  createTemplate, getTemplates, getTemplateById, updateTemplate, deleteTemplate,
  getVariables, previewTemplate, uploadMedia,
} = require("../controllers/template.controller");

// WhatsApp media upload — buffered in memory then streamed to S3 by the controller.
const kitMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 16 * 1024 * 1024, files: 1 },   // WhatsApp video cap ≈ 16 MB
  fileFilter: (req, file, cb) => {
    const mt = file.mimetype || "";
    const ok = mt.startsWith("image/") || mt.startsWith("video/") ||
      mt === "application/pdf" || /(msword|officedocument|ms-excel|ms-powerpoint)/.test(mt) ||
      mt === "text/plain" || mt === "text/csv";
    if (ok) return cb(null, true);
    req.fileFilterError = `Unsupported file type "${mt}". Allowed: images, video, PDF, Office docs.`;
    cb(null, false);
  },
});
function handleKitMulterErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ message: "File too large. Max 16 MB." });
    return res.status(400).json({ message: err.message });
  }
  return next(err);
}
const {
  createCampaign, getCampaigns, getCampaignById, updateCampaign, deleteCampaign,
  addStep, updateStep, deleteStep, reorderSteps,
  enroll, getEnrollments, stopEnrollment,
} = require("../controllers/campaign.controller");
const {
  getTriggerCatalog,
  createWorkflow, getWorkflows, getWorkflowById, updateWorkflow, toggleWorkflow, deleteWorkflow,
} = require("../controllers/workflow.controller");
const { getTimeline, getMessages } = require("../controllers/timeline.controller");
const { getOverview, getCampaignAnalytics, getTemplateAnalytics } = require("../controllers/analytics.controller");
const { getThankYouSettings, updateThankYouSettings } = require("../controllers/thankYou.controller");
const { getKickoffSettings, updateKickoffSettings } = require("../controllers/kickoff.controller");
const { getSettings, updateSettings } = require("../controllers/settings.controller");
const {
  listDesigns, getDesign, createDesign, updateDesign, setDefault, duplicateDesign, deleteDesign,
} = require("../controllers/emailDesign.controller");

// ─── Templates ────────────────────────────────────────────────────────────────
// Static routes first so they aren't captured by /templates/:id.
router.get("/templates/variables", requirePermission("kit.tab.templates"), getVariables);
router.post("/templates/preview",  requirePermission("kit.tab.templates"), previewTemplate);
router.post("/templates/upload-media", requirePermission("kit.manage"), kitMediaUpload.single("file"), handleKitMulterErrors, uploadMedia);

router.get("/templates",     requirePermission("kit.tab.templates"), getTemplates);
router.post("/templates",    requirePermission("kit.manage"),        createTemplate);
router.get("/templates/:id", requirePermission("kit.tab.templates"), getTemplateById);
router.put("/templates/:id", requirePermission("kit.manage"),        updateTemplate);
router.delete("/templates/:id", requirePermission("kit.manage"),     deleteTemplate);

// ─── Thank-You Automation settings (singleton) ──────────────────────────────
router.get("/thank-you/settings", requirePermission("kit.read"),   getThankYouSettings);
router.put("/thank-you/settings", requirePermission("kit.manage"), updateThankYouSettings);

// ─── Project Kickoff Automation settings (singleton) ────────────────────────
router.get("/kickoff/settings", requirePermission("kit.read"),   getKickoffSettings);
router.put("/kickoff/settings", requirePermission("kit.manage"), updateKickoffSettings);

// ─── Global KIT settings (delivery preferences, singleton) ──────────────────
router.get("/settings", requirePermission("kit.read"),   getSettings);
router.put("/settings", requirePermission("kit.manage"), updateSettings);

// ─── Email Designs (reusable named email frames) ────────────────────────────
router.get("/email-designs",                 requirePermission("kit.read"),   listDesigns);
router.post("/email-designs",                requirePermission("kit.manage"), createDesign);
router.get("/email-designs/:id",             requirePermission("kit.read"),   getDesign);
router.put("/email-designs/:id",             requirePermission("kit.manage"), updateDesign);
router.delete("/email-designs/:id",          requirePermission("kit.manage"), deleteDesign);
router.post("/email-designs/:id/default",    requirePermission("kit.manage"), setDefault);
router.post("/email-designs/:id/duplicate",  requirePermission("kit.manage"), duplicateDesign);

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

// ─── Analytics ────────────────────────────────────────────────────────────────
router.get("/analytics/overview",  requirePermission("kit.read"), getOverview);
router.get("/analytics/campaigns", requirePermission("kit.read"), getCampaignAnalytics);
router.get("/analytics/templates", requirePermission("kit.read"), getTemplateAnalytics);

// ─── Timeline + message logs ──────────────────────────────────────────────────
router.get("/messages", requirePermission("kit.read"), getMessages);
router.get("/timeline/:entityType/:entityId", requirePermission("kit.read"), getTimeline);

// ─── Workflows (automation) ───────────────────────────────────────────────────
router.get("/triggers/catalog", requirePermission("kit.read"), getTriggerCatalog);

router.get("/workflows",     requirePermission("kit.read"),   getWorkflows);
router.post("/workflows",    requirePermission("kit.manage"), createWorkflow);
router.get("/workflows/:id", requirePermission("kit.read"),   getWorkflowById);
router.put("/workflows/:id", requirePermission("kit.manage"), updateWorkflow);
router.post("/workflows/:id/toggle", requirePermission("kit.manage"), toggleWorkflow);
router.delete("/workflows/:id", requirePermission("kit.manage"), deleteWorkflow);

module.exports = router;
