const express = require("express");
const multer  = require("multer");
const path    = require("path");
const router  = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  uploadDocument,
  getProjectDocuments,
  downloadDocument,
  previewDocument,
  updateDocument,
  deleteDocument,
} = require("../controllers/Document.controller");

// Document Repository accepts a wider set than drawings — office files,
// archives and CAD exports alongside PDF/images. Memory storage so the buffer
// streams straight to S3 (same pattern as Drawing.route).
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
  // CAD — browsers report DWG/DXF inconsistently; octet-stream handled below.
  "application/acad", "application/dwg", "image/vnd.dwg", "image/vnd.dxf",
]);
// Browsers send application/octet-stream for many niche types — accept those
// only when the extension is one we recognise.
const OCTET_STREAM_EXT = new Set([".dwg", ".dxf", ".zip", ".rar"]);

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const ok =
      ALLOWED_MIME.has(file.mimetype) ||
      (file.mimetype === "application/octet-stream" && OCTET_STREAM_EXT.has(ext));
    if (ok) return cb(null, true);
    req.fileFilterError = `Unsupported file type "${file.mimetype}". Allowed: PDF, images, Office documents, CSV, ZIP, DWG/DXF.`;
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

// List per project (counts included for the category tab badges)
router.get("/project/:projectId", requirePermission("documents.read"), getProjectDocuments);

// Signed-URL accessors for the file itself
router.get("/:id/download", requirePermission("documents.read"), downloadDocument);
router.get("/:id/preview",  requirePermission("documents.read"), previewDocument);

// Manual upload — multer + multer-error handler before the controller
router.post(
  "/upload",
  requirePermission("documents.upload"),
  documentUpload.single("file"),
  handleMulterErrors,
  uploadDocument
);

// Metadata edit + delete
router.patch("/:id",  requirePermission("documents.update"), updateDocument);
router.delete("/:id", requirePermission("documents.delete"), deleteDocument);

module.exports = router;
