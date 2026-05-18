const express = require("express");
const router  = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");

const { sendMessage, scheduleMessage, getLogs, getQueue, cancelJob, sendLeadMessage } = require("../controllers/WhatsApp.controller");
const { createTemplate, getTemplates, getTemplateById, updateTemplate, deleteTemplate } = require("../controllers/WhatsAppTemplate.controller");

// ─── Backward-compatible legacy route (was in whatspp module) ─────────────────
router.post("/send-lead-message", sendLeadMessage);

// ─── Send & Schedule ──────────────────────────────────────────────────────────
router.post("/send",     requirePermission("whatsapp.send"), sendMessage);
router.post("/schedule", requirePermission("whatsapp.send"), scheduleMessage);

// ─── Logs ─────────────────────────────────────────────────────────────────────
router.get("/logs", requirePermission("whatsapp.read"), getLogs);

// ─── Queue management ─────────────────────────────────────────────────────────
router.get("/queue",              requirePermission("whatsapp.read"),   getQueue);
router.patch("/queue/:id/cancel", requirePermission("whatsapp.manage"), cancelJob);

// ─── Templates (static routes before /:id) ────────────────────────────────────
router.get("/templates",               requirePermission("whatsapp.read"),   getTemplates);
router.post("/templates/create",       requirePermission("whatsapp.manage"), createTemplate);
router.get("/templates/:id",           requirePermission("whatsapp.read"),   getTemplateById);
router.put("/templates/update/:id",    requirePermission("whatsapp.manage"), updateTemplate);
router.delete("/templates/delete/:id", requirePermission("whatsapp.manage"), deleteTemplate);

module.exports = router;
