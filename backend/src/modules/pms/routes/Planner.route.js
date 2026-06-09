const express = require("express");
const multer  = require("multer");
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
  autoSchedule,
  getActivationPreview,
  activatePlan,
} = require("../controllers/Planner.controller");
const {
  exportMasterSheet,
  importMasterSheet,
  getImportTemplate,
} = require("../controllers/PlannerExcel.controller");

// XLSX uploads — memory storage so the controller can parse the buffer
// without touching the local disk. 5 MB cap is generous for a planner sheet
// of a few hundred rows.
const XLSX_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream", // some browsers send this for .xlsx
]);
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const okMime = XLSX_MIME.has(file.mimetype);
    const okExt  = /\.xlsx$/i.test(file.originalname || "");
    if (okMime || okExt) return cb(null, true);
    req.fileFilterError = `Unsupported file. Please upload a .xlsx file.`;
    cb(null, false);
  },
});
function handleExcelMulterErr(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ message: "File too large. Max 5 MB." });
    return res.status(400).json({ message: err.message });
  }
  return next(err);
}

// Sheet — project-scoped reads
router.get("/:projectId/master",  requirePermission("planner.read"), getMasterSheet);
router.get("/:projectId/summary", requirePermission("planner.read"), getSummary);

// Project-scoped mutations
router.post("/:projectId/rows",          requirePermission("planner.edit"),     createRow);
router.post("/:projectId/baseline",      requirePermission("planner.baseline"), freezeBaseline);
router.post("/:projectId/auto-schedule", requirePermission("planner.edit"),     autoSchedule);

// "Make Plan Effective" — preview + commit
router.get( "/:projectId/activation-preview", requirePermission("planner.read"),   getActivationPreview);
router.post("/:projectId/activate",           requirePermission("planner.assign"), activatePlan);

// Excel import / export
// Static segment first so Express doesn't try to match it as a :projectId.
router.get("/import-template", requirePermission("planner.read"), getImportTemplate);
router.get("/:projectId/export", requirePermission("planner.export"), exportMasterSheet);
router.post(
  "/:projectId/import",
  requirePermission("planner.import"),
  (req, res, next) => {
    excelUpload.single("file")(req, res, (err) => {
      if (err) return handleExcelMulterErr(err, req, res, next);
      if (req.fileFilterError) return res.status(400).json({ message: req.fileFilterError });
      next();
    });
  },
  importMasterSheet
);

// Row-scoped mutations
router.patch("/rows/:taskId",  requirePermission("planner.edit"),   patchRow);
router.delete("/rows/:taskId", requirePermission("planner.delete"), deleteRow);

// Bulk
router.post("/rows/bulk/assign", requirePermission("planner.assign"), bulkAssign);
router.post("/rows/bulk/dates",  requirePermission("planner.edit"),   bulkDates);

module.exports = router;
