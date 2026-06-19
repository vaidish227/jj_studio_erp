const KickoffSettings = require("../models/KickoffSettings.model");

// Editable message slots and the text fields each one carries.
const MESSAGE_FIELDS = {
  internalApp:      ["title", "body"],
  internalEmail:    ["subject", "body"],
  internalWhatsapp: ["body"],
  clientEmail:      ["subject", "body"],
  clientWhatsapp:   ["body"],
};

/**
 * GET /api/kit/kickoff/settings — return the singleton kickoff settings,
 * creating defaults (with starter wording) on first access.
 */
const getKickoffSettings = async (req, res) => {
  try {
    const settings = await KickoffSettings.getOrCreateDefaults();
    return res.status(200).json({ success: true, settings });
  } catch (err) {
    console.error("[kickoff.getSettings]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/kit/kickoff/settings — partial update of the singleton settings.
 * Validates delayValue (numeric, ≥ 0) / delayUnit. Message bodies are free text.
 */
const updateKickoffSettings = async (req, res) => {
  try {
    const { enabled, delayValue, delayUnit, channels, recipients, messages } = req.body;
    const VALID_UNITS = ["minutes", "hours", "days"];

    if (delayValue !== undefined) {
      const n = Number(delayValue);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({ success: false, message: "delayValue must be a number greater than or equal to 0" });
      }
    }
    if (delayUnit !== undefined && !VALID_UNITS.includes(delayUnit)) {
      return res.status(400).json({ success: false, message: "delayUnit must be one of: minutes, hours, days" });
    }

    const settings = await KickoffSettings.getOrCreateDefaults();

    if (enabled !== undefined) settings.enabled = !!enabled;
    if (delayValue !== undefined) settings.delayValue = Number(delayValue);
    if (delayUnit !== undefined) settings.delayUnit = delayUnit;

    if (channels && typeof channels === "object") {
      if (channels.app !== undefined) settings.channels.app = !!channels.app;
      if (channels.email !== undefined) settings.channels.email = !!channels.email;
      if (channels.whatsapp !== undefined) settings.channels.whatsapp = !!channels.whatsapp;
    }
    if (recipients && typeof recipients === "object") {
      if (recipients.team !== undefined) settings.recipients.team = !!recipients.team;
      if (recipients.management !== undefined) settings.recipients.management = !!recipients.management;
      if (recipients.client !== undefined) settings.recipients.client = !!recipients.client;
    }

    if (messages && typeof messages === "object") {
      for (const [slot, fields] of Object.entries(MESSAGE_FIELDS)) {
        const incoming = messages[slot];
        if (incoming && typeof incoming === "object") {
          for (const f of fields) {
            if (incoming[f] !== undefined) settings.messages[slot][f] = String(incoming[f] ?? "");
          }
        }
      }
      settings.markModified("messages");
    }

    settings.updatedBy = req.user?._id || req.user?.id || settings.updatedBy;
    await settings.save();

    return res.status(200).json({ success: true, message: "Kickoff settings updated", settings });
  } catch (err) {
    console.error("[kickoff.updateSettings]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getKickoffSettings, updateKickoffSettings };
