const CommSettings = require("../models/CommSettings.model");
const { updateSettingsSchema } = require("../validator/CommSettings.validator");

const getSettings = async (req, res) => {
  try {
    const { channel } = req.params;
    const settings = await CommSettings.findOne({ channel })
      .populate("updatedBy", "name email")
      .lean();

    if (!settings) {
      const defaults = {
        mail: {
          channel: "mail", isActive: true, activeProvider: "gmail",
          providerConfigs: [], queue: { enabled: true, maxRetries: 3, retryIntervalMinutes: 5, batchSize: 10 },
          scheduling: { enabled: true, allowedHoursStart: 8, allowedHoursEnd: 20, weekendsAllowed: false },
          rateLimit: { enabled: false, maxPerHour: 100, maxPerDay: 500 },
        },
        whatsapp: {
          channel: "whatsapp", isActive: true, activeProvider: "maytapi",
          providerConfigs: [], queue: { enabled: true, maxRetries: 3, retryIntervalMinutes: 5, batchSize: 10 },
          scheduling: { enabled: true, allowedHoursStart: 8, allowedHoursEnd: 20, weekendsAllowed: false },
          rateLimit: { enabled: false, maxPerHour: 100, maxPerDay: 500 },
        },
      };
      return res.status(200).json({ message: "Default settings (not yet saved)", data: defaults[channel] || null });
    }

    res.status(200).json({ message: "Communication settings fetched", data: settings });
  } catch (err) {
    console.error("[getCommSettings]", err);
    res.status(500).json({ message: err.message });
  }
};

const getAllSettings = async (req, res) => {
  try {
    const settings = await CommSettings.find({}).populate("updatedBy", "name email").lean();
    res.status(200).json({ message: "All communication settings fetched", data: settings });
  } catch (err) {
    console.error("[getAllCommSettings]", err);
    res.status(500).json({ message: err.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    const { channel } = req.params;
    if (!["mail", "whatsapp"].includes(channel)) {
      return res.status(400).json({ message: "channel must be 'mail' or 'whatsapp'" });
    }

    const { error, value } = updateSettingsSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details.map((d) => d.message).join(", ") });

    const settings = await CommSettings.findOneAndUpdate(
      { channel },
      { $set: { ...value, updatedBy: req.user._id } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    // Force the channel field on upsert
    if (!settings.channel) {
      settings.channel = channel;
      await settings.save();
    }

    res.status(200).json({ message: "Communication settings updated", data: settings });
  } catch (err) {
    console.error("[updateCommSettings]", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getSettings, getAllSettings, updateSettings };
