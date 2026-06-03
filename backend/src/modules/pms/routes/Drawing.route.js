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
  getDLRSheet,
} = require("../controllers/Drawing.controller");
const { requireProjectActivityAllowed } = require("../middleware/gateEnforcement");
const Drawing = require("../models/Drawing.model");
const {
  requestPDReview,
  respondPDReview,
  getDrawingPDReview,
} = require("../controllers/PDReview.controller");
const {
  getReleaseLog,
  ackReleaseLog,
} = require("../controllers/DrawingReleaseLog.controller");

// List & query — static segments before parameterised routes
router.get("/all",                    requirePermission("drawings.read"),    getAllDrawings);
router.get("/pending-approvals",      requirePermission("drawings.approve"), getPendingApprovals);
router.get("/dlr/:projectId",         requirePermission("drawings.read"),    getDLRSheet);
router.get("/project/:projectId",     requirePermission("drawings.read"),    getDrawingsByProject);
router.get("/task/:taskId",           requirePermission("drawings.read"),    getDrawingsByTask);

// Upload & revision
router.post("/upload",     requirePermission("drawings.upload"), uploadDrawing);
router.post("/revise/:id", requirePermission("drawings.upload"), reviseDrawing);

// Lifecycle actions
router.patch("/send-for-approval/:id", requirePermission("drawings.upload"),  sendForApproval);
router.patch("/approve/:id",           requirePermission("drawings.approve"), approveDrawing);
router.patch("/reject/:id",            requirePermission("drawings.approve"), rejectDrawing);
router.patch(
  "/release/:id",
  requirePermission("drawings.release"),
  requireProjectActivityAllowed({
    activity: "drawing.release",
    projectIdResolver: async (req) => {
      const d = await Drawing.findById(req.params.id).select("projectId").lean();
      return d?.projectId;
    },
  }),
  releaseDrawing
);

// Phase 2 — Principal Designer review on 3D drawings
router.get(
  "/:id/pd-review",
  requirePermission("drawings.read"),
  getDrawingPDReview
);
router.post(
  "/:id/pd-review/request",
  requirePermission("approvals.create"),
  requestPDReview
);
router.post(
  "/:id/pd-review/respond",
  requirePermission("pd.review.respond"),
  respondPDReview
);

// Phase 2 — Drawing Release Acknowledgement
router.get(
  "/:id/release-log",
  requirePermission("drawings.read"),
  getReleaseLog
);
router.post(
  "/release-log/:logId/ack",
  requirePermission("drawings.read"),
  ackReleaseLog
);

// Delete
router.delete("/delete/:id", requirePermission("drawings.upload"), deleteDrawing);

module.exports = router;
