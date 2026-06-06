const express = require("express");
const router  = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  getMasterSheet,
  getSummary,
  createRow,
  patchRow,
  deleteRow,
  bulkAssign,
  bulkDates,
  freezeBaseline,
} = require("../controllers/Planner.controller");

// Sheet — project-scoped reads
router.get("/:projectId/master",  requirePermission("planner.read"), getMasterSheet);
router.get("/:projectId/summary", requirePermission("planner.read"), getSummary);

// Project-scoped mutations
router.post("/:projectId/rows",     requirePermission("planner.edit"),     createRow);
router.post("/:projectId/baseline", requirePermission("planner.baseline"), freezeBaseline);

// Row-scoped mutations
router.patch("/rows/:taskId",  requirePermission("planner.edit"),   patchRow);
router.delete("/rows/:taskId", requirePermission("planner.delete"), deleteRow);

// Bulk
router.post("/rows/bulk/assign", requirePermission("planner.assign"), bulkAssign);
router.post("/rows/bulk/dates",  requirePermission("planner.edit"),   bulkDates);

module.exports = router;
