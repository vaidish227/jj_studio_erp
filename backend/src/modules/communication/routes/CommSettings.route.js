const express = require("express");
const router  = express.Router();
const { requirePermission } = require("../../../middleware/auth.middleware");
const { getSettings, getAllSettings, updateSettings } = require("../controllers/CommSettings.controller");

// ─── Get all channel settings ─────────────────────────────────────────────────
router.get("/", requirePermission("communication.settings.manage"), getAllSettings);

// ─── Per-channel settings — static route /all before /:channel ───────────────
router.get("/all", requirePermission("communication.settings.manage"), getAllSettings);

// ─── Per-channel get & update ─────────────────────────────────────────────────
router.get("/:channel",   requirePermission("communication.settings.manage"), getSettings);
router.patch("/:channel", requirePermission("communication.settings.manage"), updateSettings);

module.exports = router;
