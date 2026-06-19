const express = require("express");
const multer  = require("multer");
const path    = require("path");
const router  = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  getProjectEntries,
  createEntry,
  uploadFiles,
  previewFile,
  downloadFile,
  deleteFile,
  updateEntry,
  deleteEntry,
} = require("../controllers/MaterialFinalization.controller");

// Accepts images + the wider document set (spec sheets, warranties, etc).
// Memory storage so buffers stream straight to S3 (same pattern as Document.route).
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv", "text/plain",
  "application/zip", "application/x-zip-compressed",
]);
const OCTET_STREAM_EXT = new Set([".zip", ".rar"]);

const entryUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 25 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const ok =
      ALLOWED_MIME.has(file.mimetype) ||
      (file.mimetype === "application/octet-stream" && OCTET_STREAM_EXT.has(ext));
    if (ok) return cb(null, true);
    req.fileFilterError = `Unsupported file type "${file.mimetype}". Allowed: PDF, images, Office documents, CSV, ZIP.`;
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

// List per project
router.get("/project/:projectId", requirePermission("material_finalization.read"), getProjectEntries);

// Create entry (metadata only)
router.post("/create", requirePermission("material_finalization.create"), createEntry);

// File operations on an entry
router.post(
  "/:id/files",
  requirePermission("material_finalization.update"),
  entryUpload.array("files", 10),
  handleMulterErrors,
  uploadFiles
);
router.get("/:id/files/:fileId/preview",  requirePermission("material_finalization.read"),   previewFile);
router.get("/:id/files/:fileId/download", requirePermission("material_finalization.read"),   downloadFile);
router.delete("/:id/files/:fileId",       requirePermission("material_finalization.update"), deleteFile);

// Metadata edit + delete entry
router.patch("/:id",  requirePermission("material_finalization.update"), updateEntry);
router.delete("/:id", requirePermission("material_finalization.delete"), deleteEntry);

module.exports = router;
