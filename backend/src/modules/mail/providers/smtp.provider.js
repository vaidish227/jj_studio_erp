const nodemailer = require("nodemailer");

const send = async ({ to, cc, bcc, subject, html, text, attachments, config = {} }) => {
  const user     = config.user || process.env.SMTP_USER;
  const pass     = config.pass || process.env.SMTP_PASS;
  const host     = config.host || process.env.SMTP_HOST;
  const port     = config.port || parseInt(process.env.SMTP_PORT) || 587;
  const secure   = config.secure ?? (port === 465);
  const fromName = config.fromName || "JJ Studio";

  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });

  const result = await transporter.sendMail({
    from:        `"${fromName}" <${user}>`,
    to:          Array.isArray(to)  ? to.join(", ")  : to,
    cc:          cc?.length  ? (Array.isArray(cc)  ? cc.join(", ")  : cc)  : undefined,
    bcc:         bcc?.length ? (Array.isArray(bcc) ? bcc.join(", ") : bcc) : undefined,
    subject,
    html,
    text,
    attachments,
  });

  return { messageId: result.messageId, provider: "smtp" };
};

module.exports = { send };
