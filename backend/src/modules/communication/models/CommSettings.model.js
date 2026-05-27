const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const providerConfigSchema = new mongoose.Schema(
  {
    providerName: { type: String, required: true },
    config: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const commSettingsSchema = new mongoose.Schema(
  {
    channel: {
      type: String,
      enum: ["mail", "whatsapp"],
      required: true,
      unique: true,
    },
    isActive:       { type: Boolean, default: true },
    activeProvider: { type: String, required: true },

    providerConfigs: [providerConfigSchema],

    queue: {
      enabled:               { type: Boolean, default: true },
      maxRetries:            { type: Number, default: 3, min: 0, max: 10 },
      retryIntervalMinutes:  { type: Number, default: 5, min: 1 },
      batchSize:             { type: Number, default: 10, min: 1, max: 100 },
    },

    scheduling: {
      enabled:           { type: Boolean, default: true },
      allowedHoursStart: { type: Number, default: 8,  min: 0, max: 23 },
      allowedHoursEnd:   { type: Number, default: 20, min: 0, max: 23 },
      weekendsAllowed:   { type: Boolean, default: false },
    },

    rateLimit: {
      enabled:    { type: Boolean, default: false },
      maxPerHour: { type: Number, default: 100 },
      maxPerDay:  { type: Number, default: 500 },
    },

    updatedBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CommSettings", commSettingsSchema);
