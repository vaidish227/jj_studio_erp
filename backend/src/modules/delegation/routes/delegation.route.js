const express = require("express");
const multer = require("multer");
const router = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const c = require("../controllers/delegation.controller");

// In-memory upload (streamed to S3). MVP: PDF / image / document only, 20 MB.
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    req.fileFilterError = "Unsupported file type (allowed: PDF, image, document)";
    cb(null, false);
  },
});

// verifyToken is applied globally in app.js.

// Dashboard + assignees — declared BEFORE "/:id" so they aren't parsed as ids.
router.get("/dashboard", requirePermission("delegation.read"), c.getDashboard);
router.get("/assignees", requirePermission("delegation.assign"), c.listAssignees);

// Collection
router.get("/", requirePermission("delegation.read"), c.listDelegations);
router.post("/", requirePermission("delegation.create"), c.createDelegation);

// Single record
router.get("/:id", requirePermission("delegation.read"), c.getDelegation);
router.patch("/:id", requirePermission("delegation.update"), c.updateDelegation);
router.delete("/:id", requirePermission("delegation.delete"), c.deleteDelegation);

// Workflow
router.patch("/:id/assign", requirePermission("delegation.assign"), c.assignDelegation);
router.patch("/:id/reassign", requirePermission("delegation.reassign"), c.reassignDelegation);
router.patch("/:id/status", requirePermission("delegation.update"), c.changeStatus);
router.patch("/:id/checklist", requirePermission("delegation.update"), c.updateChecklist);

// Comments
router.get("/:id/comments", requirePermission("delegation.read"), c.listComments);
router.post("/:id/comments", requirePermission("delegation.read"), c.addComment);

// Attachments
router.post("/:id/attachments", requirePermission("delegation.update"), upload.single("file"), c.addAttachment);
router.get("/:id/attachments/:attId/url", requirePermission("delegation.read"), c.getAttachmentUrl);
router.delete("/:id/attachments/:attId", requirePermission("delegation.update"), c.removeAttachment);

// Activity timeline
router.get("/:id/activity", requirePermission("delegation.read"), c.getActivity);

module.exports = router;
