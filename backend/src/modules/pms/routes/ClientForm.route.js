const express = require("express");
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  createTemplate,
  getTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  createFormLink,
  getProjectFormLinks,
  deleteFormLink,
  getPublicForm,
  submitPublicForm,
  sendFormLink,
  getProjectFormResponses,
} = require("../controllers/ClientForm.controller");

// ─── Public router (no JWT — mounted BEFORE verifyToken in app.js) ────────────
const publicRouter = express.Router();
publicRouter.get("/:token",         getPublicForm);
publicRouter.post("/:token/submit", submitPublicForm);

// ─── Protected router (JWT + permissions — mounted AFTER verifyToken) ─────────
const protectedRouter = express.Router();

// Templates
protectedRouter.get("/templates",        requirePermission("documents.read"),   getTemplates);
protectedRouter.get("/templates/:id",    requirePermission("documents.read"),   getTemplate);
protectedRouter.post("/templates",       requirePermission("documents.upload"), createTemplate);
protectedRouter.put("/templates/:id",    requirePermission("documents.upload"), updateTemplate);
protectedRouter.delete("/templates/:id", requirePermission("documents.delete"), deleteTemplate);

// Form links
protectedRouter.get("/links/project/:projectId",  requirePermission("documents.read"),   getProjectFormLinks);
protectedRouter.post("/links",                     requirePermission("documents.upload"), createFormLink);
protectedRouter.delete("/links/:id",              requirePermission("documents.delete"), deleteFormLink);
protectedRouter.post("/links/:id/send",           requirePermission("documents.upload"), sendFormLink);

// Responses
protectedRouter.get("/responses/project/:projectId", requirePermission("documents.read"), getProjectFormResponses);

module.exports = { publicRouter, protectedRouter };
