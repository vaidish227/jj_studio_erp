const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  createMilestone,
  getMilestonesByProject,
  updateMilestone,
  deleteMilestone,
} = require("../controllers/Milestone.controller");

router.post("/create",              requirePermission("milestones.create"), createMilestone);
router.get("/project/:projectId",   requirePermission("milestones.read"),   getMilestonesByProject);
router.put("/update/:id",           requirePermission("milestones.update"), updateMilestone);
router.delete("/delete/:id",        requirePermission("milestones.delete"), deleteMilestone);

module.exports = router;
