const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  requestHandover,
  getHandoverByProject,
  updateDrawingItem,
  addPunchItem,
  resolvePunchItem,
  designLeadSign,
  supervisorAccept,
  supervisorReject,
} = require("../controllers/Handover.controller");

// Project-scoped reads/creates
router.get("/project/:projectId",          requirePermission("projects.read"),   getHandoverByProject);
router.post("/project/:projectId/request", requirePermission("projects.update"), requestHandover);

// Package-scoped operations
router.patch("/:id/drawings/:itemId",      requirePermission("projects.update"), updateDrawingItem);
router.post("/:id/punch",                  requirePermission("projects.update"), addPunchItem);
router.patch("/:id/punch/:punchId",        requirePermission("projects.update"), resolvePunchItem);
router.post("/:id/sign",                   requirePermission("projects.update"), designLeadSign);

// Supervisor reuses pms.handover.signoff if added — for now require projects.update + supervisor role check is via permission settings
router.post("/:id/accept",                 requirePermission("projects.update"), supervisorAccept);
router.post("/:id/reject",                 requirePermission("projects.update"), supervisorReject);

module.exports = router;
