const WhatsAppLog      = require("../models/WhatsAppLog.model");
const WhatsAppTemplate = require("../models/WhatsAppTemplate.model");
const CommSettings     = require("../../communication/models/CommSettings.model");

const renderTemplate = (template, variables = {}) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);

const getProvider = (providerName) => {
  const map = {
    maytapi: require("../providers/maytapi.provider"),
    twilio:  require("../providers/twilio.provider"),
  };
  return map[providerName] || map.maytapi;
};

const getSettings = async () => {
  const settings = await CommSettings.findOne({ channel: "whatsapp" }).lean();
  return settings || { activeProvider: "maytapi", queue: { maxRetries: 3, batchSize: 10, enabled: true }, providerConfigs: [] };
};

const getProviderConfig = (settings, providerName) => {
  const entry = (settings.providerConfigs || []).find((p) => p.providerName === providerName);
  return entry?.config || {};
};

const sendImmediate = async ({
  to, message,
  templateId, templateVariables,
  mediaUrl, mediaType = "none",
  relatedTo, createdBy,
}) => {
  const settings = await getSettings();
  const provider = getProvider(settings.activeProvider);
  const config   = getProviderConfig(settings, settings.activeProvider);

  let finalMessage = message;

  if (templateId) {
    const tmpl = await WhatsAppTemplate.findById(templateId);
    if (!tmpl) throw new Error("WhatsApp template not found");
    finalMessage = renderTemplate(tmpl.body, templateVariables || {});
    if (!mediaUrl && tmpl.mediaUrl) {
      mediaUrl  = tmpl.mediaUrl;
      mediaType = tmpl.mediaType || "none";
    }
  }

  if (!finalMessage) throw new Error("Message body is required");

  const logEntry = await WhatsAppLog.create({
    templateId:  templateId || undefined,
    to,
    message:     finalMessage,
    mediaUrl,
    mediaType,
    provider:    settings.activeProvider,
    status:      "sent",
    relatedTo,
    createdBy,
    lastAttemptAt: new Date(),
  });

  try {
    const result = await provider.send({
      to,
      message: finalMessage,
      mediaUrl,
      mediaType,
      config,
    });

    await WhatsAppLog.findByIdAndUpdate(logEntry._id, {
      messageId: result.messageId,
      sentAt:    new Date(),
    });

    return { success: true, messageId: result.messageId, logId: logEntry._id };
  } catch (err) {
    await WhatsAppLog.findByIdAndUpdate(logEntry._id, {
      status:        "failed",
      failureReason: err.message,
      retryCount:    1,
    });
    throw err;
  }
};

module.exports = { sendImmediate, renderTemplate, getSettings, getProvider, getProviderConfig };
