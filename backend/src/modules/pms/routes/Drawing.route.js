const express = require("express");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  uploadDrawing,
  reviseDrawing,
  getAllDrawings,
  getPendingApprovals,
  getDrawingsByProject,
  getDrawingsByTask,
  sendForApproval,
  approveDrawing,
  rejectDrawing,
  releaseDrawing,
  deleteDrawing,
} = require("../controllers/Drawing.controller");

// List & query
router.get("/all",                    requirePermission("drawings.read"), getAllDrawings);
router.get("/pending-approvals",      requirePermission("drawings.approve"), getPendingApprovals);
router.get("/project/:projectId",     requirePermission("drawings.read"), getDrawingsByProject);
router.get("/task/:taskId",           requirePermission("drawings.read"), getDrawingsByTask);

// Upload & revision
router.post("/upload",     requirePermission("drawings.upload"), uploadDrawing);
router.post("/revise/:id", requirePermission("drawings.upload"), reviseDrawing);

// Lifecycle actions
router.patch("/send-for-approval/:id", requirePermission("drawings.upload"),  sendForApproval);
router.patch("/approve/:id",           requirePermission("drawings.approve"), approveDrawing);
router.patch("/reject/:id",            requirePermission("drawings.approve"), rejectDrawing);
router.patch("/release/:id",           requirePermission("drawings.release"), releaseDrawing);

// Delete
router.delete("/delete/:id", requirePermission("drawings.upload"), deleteDrawing);

module.exports = router;
