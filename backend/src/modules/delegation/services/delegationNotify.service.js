const { dispatch } = require("../../notifications/services/notificationDispatcher");
const { enqueue } = require("../../mail/service/mail.queue.service");
const User = require("../../auth/models/user.model");
const Role = require("../../auth/models/Role.model");
const { aliasesFor } = require("../../auth/permissions/aliases");

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
 * Resolve active users who can assign delegations — i.e. anyone holding
 * `delegation.assign`, one of its aliases, or the admin wildcard `*`, granted
 * either via their role or via custom permissions. Used to alert potential
 * owners when a delegation is created with no assignee (otherwise it would sit
 * unassigned with nobody notified). Returns an array of user-id strings.
 *
 * This is a recipient lookup only — it grants no new access. Every user it
 * returns already has org-wide visibility via `delegation.viewAll`/`*`, so they
 * can already see the delegation; we are only pinging them.
 */
const findAssignerIds = async () => {
  try {
    const grants = [
      ...new Set(["delegation.assign", "*", ...aliasesFor("delegation.assign")]),
    ];
    const roles = await Role.find({ permissions: { $in: grants } })
      .select("name")
      .lean();
    const roleNames = roles.map((r) => r.name);
    const users = await User.find({
      isActive: true,
      $or: [{ role: { $in: roleNames } }, { customPermissions: { $in: grants } }],
    })
      .select("_id")
      .lean();
    return [...new Set(users.map((u) => String(u._id)))];
  } catch (err) {
    console.error("[delegationNotify:findAssignerIds]", err.message);
    return [];
  }
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

module.exports = { notify, resolveEmails, deepLink, findAssignerIds };
