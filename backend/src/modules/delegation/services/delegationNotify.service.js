const { dispatch } = require("../../notifications/services/notificationDispatcher");
const { enqueue } = require("../../mail/service/mail.queue.service");
const User = require("../../auth/models/user.model");

/**
 * delegationNotify — fire-and-forget tri-... bi-channel notifier for delegation
 * events: in-app (notificationDispatcher) + email (MailQueue). WhatsApp is
 * intentionally NOT wired in MVP. Never throws — notification failure must not
 * block the parent request.
 */

const deepLink = (d) => `/delegation/${d._id}`;

/** Resolve active recipients' email addresses (deduped). */
const resolveEmails = async (userIds = []) => {
  const ids = [...new Set(userIds.map(String))].filter(Boolean);
  if (!ids.length) return [];
  const users = await User.find({ _id: { $in: ids }, isActive: true })
    .select("email")
    .lean();
  return [...new Set(users.map((u) => u.email).filter(Boolean))];
};

/**
 * @param {Object} opts
 * @param {string} opts.type        e.g. "delegation.assigned"
 * @param {string} opts.title
 * @param {string} [opts.message]
 * @param {Object} opts.delegation  the delegation doc (needs _id, trackingId, priority)
 * @param {Object} [opts.actor]     { _id, name }
 * @param {Array}  [opts.recipients] user ids to notify in-app
 * @param {Object} [opts.email]     { subject, html, text, to? } — when set, queue an email
 */
const notify = async ({ type, title, message, delegation, actor, recipients = [], email }) => {
  // ── In-app (always) ──
  try {
    await dispatch({
      type,
      module: "delegation",
      title,
      message: message || "",
      link: deepLink(delegation),
      priority: delegation?.priority === "urgent" ? "high" : "normal",
      recipients,
      actor,
      relatedTo: { module: "delegation", recordId: delegation?._id },
      metadata: { trackingId: delegation?.trackingId },
    });
  } catch (err) {
    console.error("[delegationNotify:in-app]", err.message);
  }

  // ── Email (optional) ──
  if (email && (email.subject || email.html)) {
    try {
      const to = email.to && email.to.length ? email.to : await resolveEmails(recipients);
      if (to.length) {
        await enqueue({
          to,
          subject: email.subject,
          html: email.html,
          text: email.text,
          priority: "normal",
          // MailQueue.relatedTo.module enum has no "delegation" — use "system".
          relatedTo: { module: "system", recordId: delegation?._id },
          createdBy: actor?._id,
        });
      }
    } catch (err) {
      console.error("[delegationNotify:email]", err.message);
    }
  }
};

module.exports = { notify, resolveEmails, deepLink };
