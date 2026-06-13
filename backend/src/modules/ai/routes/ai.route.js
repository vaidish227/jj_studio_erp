// AI module router. Mounted at /api/ai by backend/src/app.js.
//
// IMPORTANT: backend/src/app.js calls `app.use(verifyToken)` before this
// router is mounted, so `req.user` is always present here. We chain
// `requirePermission('ai.chat')` (or 'ai.admin') per-route which lazily
// loads req.permissions if not yet loaded.

const express = require("express");
const multer  = require("multer");
const path    = require("path");
const router = express.Router();

const { requirePermission } = require("../../../middleware/auth.middleware");
const aiRateLimit = require("../middleware/aiRateLimit.middleware");
const aiAudit = require("../middleware/aiAudit.middleware");

const ai = require("../controllers/ai.controller");
const conversation = require("../controllers/conversation.controller");
const admin = require("../controllers/admin.controller");
const documents = require("../controllers/documents.controller");
const userFacts = require("../controllers/userFacts.controller");
const actions = require("../controllers/actions.controller");

// ─── Chat stream ─────────────────────────────────────────────────────────────
// SSE endpoint. requirePermission populates req.permissions for us.
router.post(
  "/chat",
  requirePermission("ai.chat"),
  aiRateLimit,
  aiAudit,
  ai.streamChat
);

// ─── One-shot text polish ────────────────────────────────────────────────────
// Non-streaming JSON. Rewrites raw text into professional English (e.g. the
// "AI" button on the Record MOM Discussion Summary). Rate-limited like chat.
router.post("/polish-text", requirePermission("ai.chat"), aiRateLimit, ai.polishText);

// ─── Speech-to-text (audio transcription) ────────────────────────────────────
// Memory storage so the buffer goes straight to the Whisper API (same pattern
// as Document.route). Accepts mic recordings (webm/mp4 blobs) and uploaded
// audio files. The 25 MB cap mirrors OpenAI's transcription file limit.
// MediaRecorder blobs carry a codecs suffix ("audio/webm;codecs=opus"), so we
// match on the base mimetype.
const AUDIO_MIME = new Set([
  "audio/webm", "audio/ogg", "audio/oga", "audio/mpeg", "audio/mp3",
  "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac",
  "audio/wav", "audio/x-wav", "audio/wave", "audio/flac", "audio/x-flac",
  "video/webm", "video/mp4", // browsers sometimes label audio-only blobs as video
]);
// Browsers send application/octet-stream for some audio files — accept those
// only when the extension is one Whisper supports.
const AUDIO_EXT = new Set([
  ".webm", ".ogg", ".oga", ".mp3", ".m4a", ".mp4", ".wav", ".flac", ".aac", ".mpeg", ".mpga",
]);

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const base = (file.mimetype || "").split(";")[0].trim().toLowerCase();
    const ext  = path.extname(file.originalname || "").toLowerCase();
    const ok =
      AUDIO_MIME.has(base) ||
      (base === "application/octet-stream" && AUDIO_EXT.has(ext));
    if (ok) return cb(null, true);
    req.fileFilterError = `Unsupported audio type "${file.mimetype}". Use MP3, WAV, M4A, AAC, OGG or WebM.`;
    cb(null, false);
  },
});

function handleAudioUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Audio too large. Max 25 MB." });
    }
    return res.status(400).json({ message: err.message });
  }
  return next(err);
}

router.post(
  "/transcribe",
  requirePermission("ai.chat"),
  aiRateLimit,
  audioUpload.single("audio"),
  handleAudioUploadErrors,
  ai.transcribeAudio
);

// ─── Conversations CRUD ───────────────────────────────────────────────────────
router.get   ("/conversations",          requirePermission("ai.chat"), conversation.list);
router.get   ("/conversations/:id",      requirePermission("ai.chat"), conversation.getOne);
router.post  ("/conversations/:id/rename", requirePermission("ai.chat"), conversation.rename);
router.delete("/conversations/:id",      requirePermission("ai.chat"), conversation.softDelete);

// ─── Feedback ─────────────────────────────────────────────────────────────────
router.post("/feedback", requirePermission("ai.chat"), conversation.feedback);

// ─── Write-tool proposals (V3) ───────────────────────────────────────────────
// The AI proposes a write via a tool call; the user confirms or cancels here.
// Permission to invoke the underlying tool is re-checked inside the executor.
router.post("/actions/:toolCallId/confirm", requirePermission("ai.chat"), actions.confirm);
router.post("/actions/:toolCallId/cancel",  requirePermission("ai.chat"), actions.cancel);

// ─── User Facts (long-term memory) ───────────────────────────────────────────
router.get   ("/user-facts",     requirePermission("ai.chat"), userFacts.listMine);
router.post  ("/user-facts",     requirePermission("ai.chat"), userFacts.addMine);
router.delete("/user-facts/:id", requirePermission("ai.chat"), userFacts.removeMine);

// ─── Knowledge Base (V2 RAG) ─────────────────────────────────────────────────
router.get   ("/documents",            requirePermission("ai.docs.read"),   documents.list);
router.get   ("/documents/:id",        requirePermission("ai.docs.read"),   documents.getOne);
router.get   ("/documents/:id/chunks", requirePermission("ai.docs.read"),   documents.listChunks);
router.post  ("/documents",            requirePermission("ai.docs.manage"), documents.create);
router.put   ("/documents/:id",        requirePermission("ai.docs.manage"), documents.update);
router.delete("/documents/:id",        requirePermission("ai.docs.manage"), documents.remove);
router.post  ("/documents/:id/reembed", requirePermission("ai.docs.manage"), documents.reembed);

// ─── Admin / Ops ─────────────────────────────────────────────────────────────
router.get ("/health",                 requirePermission("ai.admin"), ai.health);
router.get ("/admin/metrics",          requirePermission("ai.admin"), admin.metricsRollup);
router.post("/admin/summarize-facts",  requirePermission("ai.admin"), userFacts.runSummarizer);

module.exports = router;
