const nodemailer = require("nodemailer");

const send = async ({ to, cc, bcc, subject, html, text, attachments, config = {} }) => {
  const user     = config.user || process.env.EMAIL_USER;
  const pass     = config.pass || process.env.EMAIL_PASS;
  const fromName = config.fromName || "JJ Studio";

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

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

  return { messageId: result.messageId, provider: "gmail" };
};

module.exports = { send };
