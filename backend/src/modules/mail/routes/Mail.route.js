const express = require("express");
const router  = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");

const { sendMail, scheduleMail, getMailLogs, getMailQueue, cancelMailJob } = require("../controllers/Mail.controller");
const { createTemplate, getTemplates, getTemplateById, updateTemplate, deleteTemplate } = require("../controllers/MailTemplate.controller");

// ─── Send & Schedule ──────────────────────────────────────────────────────────
router.post("/send",     requirePermission("mail.send"), sendMail);
router.post("/schedule", requirePermission("mail.send"), scheduleMail);

// ─── Logs ─────────────────────────────────────────────────────────────────────
router.get("/logs", requirePermission("mail.read"), getMailLogs);

// ─── Queue management ─────────────────────────────────────────────────────────
router.get("/queue",              requirePermission("mail.read"),   getMailQueue);
router.patch("/queue/:id/cancel", requirePermission("mail.manage"), cancelMailJob);

// ─── Templates (static routes before /:id) ────────────────────────────────────
router.get("/templates",              requirePermission("mail.read"),   getTemplates);
router.post("/templates/create",      requirePermission("mail.manage"), createTemplate);
router.get("/templates/:id",          requirePermission("mail.read"),   getTemplateById);
router.put("/templates/update/:id",   requirePermission("mail.manage"), updateTemplate);
router.delete("/templates/delete/:id",requirePermission("mail.manage"), deleteTemplate);

module.exports = router;
