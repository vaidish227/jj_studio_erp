const ThankYouSettings = require("../models/ThankYouSettings.model");

// Editable message slots and the text fields each one carries.
const MESSAGE_FIELDS = {
  leadWhatsapp:     ["body"],
  leadEmail:        ["subject", "body"],
  referralWhatsapp: ["body"],
  referralEmail:    ["subject", "body"],
};

/**
 * GET /api/kit/thank-you/settings — return the singleton thank-you settings,
 * creating defaults (with starter wording) on first access.
 */
const getThankYouSettings = async (req, res) => {
  try {
    const settings = await ThankYouSettings.getOrCreateDefaults();
    return res.status(200).json({ success: true, settings });
  } catch (err) {
    console.error("[thankYou.getSettings]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/kit/thank-you/settings — partial update of the singleton settings.
 * Validates delayHours (numeric, ≥ 0). Message bodies are free text.
 */
const updateThankYouSettings = async (req, res) => {
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

    const settings = await ThankYouSettings.getOrCreateDefaults();

    if (enabled !== undefined) settings.enabled = !!enabled;
    if (delayValue !== undefined) settings.delayValue = Number(delayValue);
    if (delayUnit !== undefined) settings.delayUnit = delayUnit;

    if (channels && typeof channels === "object") {
      if (channels.whatsapp !== undefined) settings.channels.whatsapp = !!channels.whatsapp;
      if (channels.email !== undefined) settings.channels.email = !!channels.email;
    }
    if (recipients && typeof recipients === "object") {
      if (recipients.lead !== undefined) settings.recipients.lead = !!recipients.lead;
      if (recipients.referral !== undefined) settings.recipients.referral = !!recipients.referral;
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

    return res.status(200).json({ success: true, message: "Thank-you settings updated", settings });
  } catch (err) {
    console.error("[thankYou.updateSettings]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getThankYouSettings, updateThankYouSettings };
