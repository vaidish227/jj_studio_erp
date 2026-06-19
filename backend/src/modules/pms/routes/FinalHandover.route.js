const express = require("express");
const multer  = require("multer");
const path    = require("path");
const router  = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  getProjectDocs,
  uploadDoc,
  downloadDoc,
  previewDoc,
  updateDoc,
  deleteDoc,
} = require("../controllers/FinalHandover.controller");

// Handover documents accept the wider document set (PDF, images, office files,
// archives). Memory storage so the buffer streams straight to S3.
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
  "application/acad", "application/dwg", "image/vnd.dwg", "image/vnd.dxf",
]);
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

// List per project
router.get("/project/:projectId", requirePermission("final_handover.read"), getProjectDocs);

// Signed-URL accessors
router.get("/:id/download", requirePermission("final_handover.read"), downloadDoc);
router.get("/:id/preview",  requirePermission("final_handover.read"), previewDoc);

// Upload — multer + multer-error handler before the controller
router.post(
  "/upload",
  requirePermission("final_handover.upload"),
  documentUpload.single("file"),
  handleMulterErrors,
  uploadDoc
);

// Metadata edit + delete
router.patch("/:id",  requirePermission("final_handover.upload"), updateDoc);
router.delete("/:id", requirePermission("final_handover.delete"), deleteDoc);

module.exports = router;
