const express = require("express");
const multer  = require("multer");
const router  = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  getProjectContractors,
  createContractor,
  uploadFiles,
  previewFile,
  downloadFile,
  deleteFile,
  updateContractor,
  deleteContractor,
} = require("../controllers/Contractor.controller");

// Contractor documents — agreements, licenses, insurance (PDF/Office) plus
// scanned images. Memory storage so buffers stream straight to S3; the
// controller validates MIME per `kind`.
const ALLOWED_MIME = new Set([
  // documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv", "text/plain",
  "application/zip", "application/x-zip-compressed",
  // images (scanned agreements, etc.)
  "image/jpeg", "image/jpg", "image/png", "image/webp",
]);

const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 25 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    req.fileFilterError = `Unsupported file type "${file.mimetype}". Allowed: documents and images.`;
    cb(null, false);
  },
});

function handleMulterErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large. Max 25 MB." });
    }
    return res.status(400).json({ message: err.message });
  }
  return next(err);
}

// List per project (optional ?status= filter)
router.get("/project/:projectId", requirePermission("contractor.read"), getProjectContractors);

// Create contractor (metadata only)
router.post("/create", requirePermission("contractor.create"), createContractor);

// Document operations on a contractor
router.post(
  "/:id/files",
  requirePermission("contractor.update"),
  fileUpload.array("files", 10),
  handleMulterErrors,
  uploadFiles
);
router.get("/:id/files/:fileId/preview",  requirePermission("contractor.read"),   previewFile);
router.get("/:id/files/:fileId/download", requirePermission("contractor.read"),   downloadFile);
router.delete("/:id/files/:fileId",       requirePermission("contractor.update"), deleteFile);

// Metadata edit + delete contractor
router.patch("/:id",  requirePermission("contractor.update"), updateContractor);
router.delete("/:id", requirePermission("contractor.delete"), deleteContractor);

module.exports = router;
