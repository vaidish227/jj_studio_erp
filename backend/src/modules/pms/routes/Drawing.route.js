const express = require("express");
const multer  = require("multer");
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
  getNextVersion,
  downloadDrawing,
  previewDrawing,
} = require("../controllers/Drawing.controller");

// Drawing file uploads — memory storage so we can stream the buffer straight
// to S3 without touching local disk. 20 MB cap matches the PDF spec.
const ALLOWED_MIME = new Set([
  "application/pdf", "image/jpeg", "image/jpg", "image/png",
]);
const drawingUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    // Stash the rejection on the request so the controller can return a 400
    // with a friendly message instead of a generic multer error.
    req.fileFilterError = `Unsupported file type "${file.mimetype}". Allowed: PDF, JPEG, PNG.`;
    cb(null, false);
  },
});

// Convert multer's "file too large" error into a 400 the frontend can render.
function handleMulterErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large. Max 20 MB." });
    }
    return res.status(400).json({ message: err.message });
  }
  return next(err);
}
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
const {
  listAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
} = require("../controllers/DrawingAnnotation.controller");

// List & query — static segments before parameterised routes
router.get("/all",                    requirePermission("drawings.read"),    getAllDrawings);
router.get("/pending-approvals",      requirePermission("drawings.approve"), getPendingApprovals);
router.get("/next-version",           requirePermission("drawings.read"),    getNextVersion);
router.get("/dlr/:projectId",         requirePermission("drawings.read"),    getDLRSheet);
router.get("/project/:projectId",     requirePermission("drawings.read"),    getDrawingsByProject);
router.get("/task/:taskId",           requirePermission("drawings.read"),    getDrawingsByTask);

// Signed-URL accessors for the file itself
router.get("/:id/download", requirePermission("drawings.read"), downloadDrawing);
router.get("/:id/preview",  requirePermission("drawings.read"), previewDrawing);

// Upload & revision — multer + multer-error handler before the controller
router.post(
  "/upload",
  requirePermission("drawings.upload"),
  drawingUpload.single("file"),
  handleMulterErrors,
  uploadDrawing
);
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

// Phase 6 — Manager-level annotations on drawing previews
router.get(
  "/:id/annotations",
  requirePermission("drawings.read"),
  listAnnotations
);
router.post(
  "/:id/annotations",
  requirePermission("drawings.approve"),
  createAnnotation
);
router.patch(
  "/annotation/:annotationId",
  requirePermission("drawings.approve"),
  updateAnnotation
);
router.delete(
  "/annotation/:annotationId",
  requirePermission("drawings.approve"),
  deleteAnnotation
);

// Delete
router.delete("/delete/:id", requirePermission("drawings.upload"), deleteDrawing);

module.exports = router;
