const mongoose = require("mongoose");
const Notification = require("../models/Notification.model");
const User = require("../../auth/models/user.model");

// Roles treated as "admins" for the always-copy fallback. MD = Managing
// Director, top-of-org. Adjust here if the policy ever changes.
const ADMIN_ROLES = ["admin", "md"];

// Tiny in-process cache so we don't hit the User collection on every dispatch.
// Refreshed every minute; cheap enough for any internal ERP.
let _adminCache = { ids: [], expiresAt: 0 };
const ADMIN_CACHE_TTL_MS = 60 * 1000;

const getAdminUserIds = async () => {
  if (Date.now() < _adminCache.expiresAt && _adminCache.ids.length) {
    return _adminCache.ids;
  }
  const admins = await User.find({ role: { $in: ADMIN_ROLES } })
    .select("_id")
    .lean();
  _adminCache = {
    ids: admins.map((u) => u._id),
    expiresAt: Date.now() + ADMIN_CACHE_TTL_MS,
  };
  return _adminCache.ids;
};

const invalidateAdminCache = () => {
  _adminCache = { ids: [], expiresAt: 0 };
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const normalizeId = (raw) => {
  if (!raw) return null;
  // Already an ObjectId
  if (raw instanceof mongoose.Types.ObjectId) return raw;
  // Populated user doc { _id, ... }
  if (typeof raw === "object" && raw._id) {
    return isValidId(raw._id) ? new mongoose.Types.ObjectId(raw._id) : null;
  }
  // Raw string id
  if (typeof raw === "string" && isValidId(raw)) {
    return new mongoose.Types.ObjectId(raw);
  }
  return null;
};

const dedupeIds = (ids) => {
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (!id) continue;
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return out;
};

/**
 * dispatch — fan a single event out as one Notification document per recipient.
 *
 * @param {Object}   opts
 * @param {String}   opts.type        e.g. "meeting.scheduled" (required)
 * @param {String}   opts.module      coarse bucket: "crm" | "pms" | "meeting" | "proposal" | "auth" | "system"
 * @param {String}   opts.title       human display, e.g. "Meeting scheduled with Rajiv Kumar"
 * @param {String}   [opts.message]   optional body text
 * @param {String}   [opts.link]      frontend route to deep-link to
 * @param {"low"|"normal"|"high"} [opts.priority="normal"]
 * @param {Array}    [opts.recipients]   user IDs / docs / strings (any mix). May be empty — admins still get notified.
 * @param {Boolean}  [opts.skipAdmins=false]   if true, skip the admin fallback copy
 * @param {Boolean}  [opts.notifyActor=false]  if true, the actor receives a copy too (default false — don't notify someone of their own action)
 * @param {Object}   [opts.actor]     { _id, name } — populated user doc or { _id, name } literal
 * @param {Object}   [opts.relatedTo] { module, recordId }
 * @param {Object}   [opts.metadata]  free-form
 *
 * @returns {Promise<Notification[]>}  inserted docs (empty if nothing dispatched)
 */
const dispatch = async (opts) => {
  try {
    if (!opts || !opts.type || !opts.module || !opts.title) {
      console.warn("[notifications] dispatch called without type/module/title — skipped");
      return [];
    }

    const actorId = normalizeId(opts.actor?._id || opts.actor);
    const actorName =
      opts.actor && typeof opts.actor === "object" && opts.actor.name
        ? opts.actor.name
        : undefined;

    // Resolve recipients
    const explicit = (opts.recipients || []).map(normalizeId).filter(Boolean);
    let admins = [];
    if (!opts.skipAdmins) {
      try {
        admins = await getAdminUserIds();
      } catch (err) {
        console.error("[notifications] failed to resolve admin recipients:", err.message);
      }
    }
    let allRecipients = dedupeIds([...explicit, ...admins]);

    // Optionally suppress notifying the actor about their own action
    if (actorId && !opts.notifyActor) {
      allRecipients = allRecipients.filter((id) => String(id) !== String(actorId));
    }

    if (allRecipients.length === 0) {
      // No one to notify — quietly no-op rather than throw
      return [];
    }

    const baseDoc = {
      type: opts.type,
      module: opts.module,
      title: opts.title,
      message: opts.message || "",
      link: opts.link || "",
      priority: opts.priority || "normal",
      relatedTo: opts.relatedTo || undefined,
      actorId: actorId || undefined,
      actorName: actorName || undefined,
      metadata: opts.metadata || {},
    };

    const docs = allRecipients.map((recipientId) => ({ ...baseDoc, recipientId }));
    const inserted = await Notification.insertMany(docs, { ordered: false });
    return inserted;
  } catch (err) {
    // Notifications are best-effort — never fail the parent request because
    // of a dispatch error. Just log and move on.
    console.error("[notifications] dispatch error:", err.message);
    return [];
  }
};

module.exports = {
  dispatch,
  getAdminUserIds,
  invalidateAdminCache,
};
