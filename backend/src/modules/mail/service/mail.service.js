const MailLog      = require("../models/MailLog.model");
const MailTemplate = require("../models/MailTemplate.model");
const CommSettings = require("../../communication/models/CommSettings.model");

// ─── Template rendering ────────────────────────────────────────────────────────
const renderTemplate = (template, variables = {}) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);

// ─── Provider registry ─────────────────────────────────────────────────────────
const getProvider = (providerName) => {
  const map = {
    gmail: require("../providers/gmail.provider"),
    smtp:  require("../providers/smtp.provider"),
  };
  return map[providerName] || map.gmail;
};

// ─── Settings loader (falls back to env-based defaults) ───────────────────────
const getSettings = async () => {
  const settings = await CommSettings.findOne({ channel: "mail" }).lean();
  return settings || { activeProvider: "gmail", queue: { maxRetries: 3, batchSize: 10, enabled: true }, providerConfigs: [] };
};

const getProviderConfig = (settings, providerName) => {
  const entry = (settings.providerConfigs || []).find((p) => p.providerName === providerName);
  return entry?.config || {};
};

// ─── Send immediately ─────────────────────────────────────────────────────────
const sendImmediate = async ({
  to, cc, bcc, subject, html, text,
  templateId, templateVariables,
  attachments,
  relatedTo, createdBy,
}) => {
  const settings = await getSettings();
  const provider = getProvider(settings.activeProvider);
  const config   = getProviderConfig(settings, settings.activeProvider);

  let finalHtml    = html;
  let finalSubject = subject;

  if (templateId) {
    const tmpl = await MailTemplate.findById(templateId);
    if (!tmpl) throw new Error("Mail template not found");
    finalHtml    = renderTemplate(tmpl.htmlBody, templateVariables || {});
    finalSubject = subject || renderTemplate(tmpl.subject, templateVariables || {});
  }

  if (!finalSubject) throw new Error("Email subject is required");
  if (!finalHtml && !text) throw new Error("Email body (html or text) is required");

  const logEntry = await MailLog.create({
    templateId:  templateId || undefined,
    to:          Array.isArray(to) ? to : [to],
    cc,
    bcc,
    subject:     finalSubject,
    htmlBody:    finalHtml,
    textBody:    text,
    provider:    settings.activeProvider,
    status:      "sent",
    relatedTo,
    createdBy,
    lastAttemptAt: new Date(),
  });

  try {
    const result = await provider.send({
      to, cc, bcc,
      subject: finalSubject,
      html:    finalHtml,
      text,
      attachments,
      config,
    });

    await MailLog.findByIdAndUpdate(logEntry._id, {
      messageId: result.messageId,
      sentAt:    new Date(),
    });

    return { success: true, messageId: result.messageId, logId: logEntry._id };
  } catch (err) {
    await MailLog.findByIdAndUpdate(logEntry._id, {
      status:        "failed",
      failureReason: err.message,
      retryCount:    1,
    });
    throw err;
  }
};

module.exports = { sendImmediate, renderTemplate, getSettings, getProvider, getProviderConfig };
