const express = require("express");
const multer  = require("multer");
const router  = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const {
  getProjectSnags,
  createSnag,
  uploadMedia,
  previewMedia,
  downloadMedia,
  deleteMedia,
  updateSnag,
  deleteSnag,
} = require("../controllers/Snag.controller");

// Snag media — images, audio and short video clips. Memory storage so buffers
// stream straight to S3. The controller validates MIME per `kind`.
const ALLOWED_MIME = new Set([
  // images
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  // audio
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "audio/mp4", "audio/aac", "audio/x-m4a",
  // video
  "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska",
]);

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 100 * 1024 * 1024, files: 10 }, // video clips can be large
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    req.fileFilterError = `Unsupported file type "${file.mimetype}". Allowed: images, audio, video.`;
    cb(null, false);
  },
});

function handleMulterErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large. Max 100 MB." });
    }
    return res.status(400).json({ message: err.message });
  }
  return next(err);
}

// List per project (optional ?status=&severity= filters)
router.get("/project/:projectId", requirePermission("snag_list.read"), getProjectSnags);

// Create snag (metadata only)
router.post("/create", requirePermission("snag_list.create"), createSnag);

// Media operations on a snag
router.post(
  "/:id/files",
  requirePermission("snag_list.update"),
  mediaUpload.array("files", 10),
  handleMulterErrors,
  uploadMedia
);
router.get("/:id/files/:fileId/preview",  requirePermission("snag_list.read"),   previewMedia);
router.get("/:id/files/:fileId/download", requirePermission("snag_list.read"),   downloadMedia);
router.delete("/:id/files/:fileId",       requirePermission("snag_list.update"), deleteMedia);

// Metadata edit + delete snag
router.patch("/:id",  requirePermission("snag_list.update"), updateSnag);
router.delete("/:id", requirePermission("snag_list.delete"), deleteSnag);

module.exports = router;
