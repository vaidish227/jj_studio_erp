/**
 * KIT shared enums — single source of truth for the values used across the
 * kit_* Mongoose models, services, and validators. Centralised here so the
 * enum lists never drift between collections.
 *
 * `ENTITY_TYPES` is re-exported from the variable catalog so there is exactly
 * one definition of "what kind of thing a KIT message can target".
 */
const { ENTITY_TYPES } = require("./variableCatalog");

// Delivery channels. Mirrors the existing mail / whatsapp / notification planes.
const CHANNELS = ["whatsapp", "email", "notification"];

// Template categories — kept identical to the existing WhatsAppTemplate /
// MailTemplate category lists so templates can be imported 1:1 later.
const TEMPLATE_CATEGORIES = [
  "welcome", "meeting", "proposal", "followup", "reminder",
  "approval", "marketing", "system", "custom",
];

// WhatsApp media kinds (matches WhatsAppTemplate.mediaType).
const MEDIA_TYPES = ["none", "image", "document", "video"];

// Campaign audiences (segments a campaign targets).
const CAMPAIGN_AUDIENCES = ["leads", "prospects", "clients", "projects", "past_clients"];

// Campaign lifecycle.
const CAMPAIGN_STATUSES = ["draft", "active", "paused", "archived"];

// Per-step / workflow-action delay units.
const DELAY_UNITS = ["minutes", "hours", "days"];

// Enrollment lifecycle. Only one "active" enrollment per (campaign, entity).
const ENROLLMENT_STATUSES = ["active", "completed", "paused", "stopped"];

// Scheduled-job lifecycle (campaign-tick queue, claimed atomically by cron).
const JOB_STATUSES = ["pending", "processing", "done", "failed", "cancelled"];

// KIT-level message lifecycle (superset spanning all channels).
const MESSAGE_STATUSES = ["queued", "sent", "delivered", "read", "failed", "replied"];

// Which underlying audit collection a KitMessageLog points at.
const PROVIDER_LOG_REFS = ["MailLog", "WhatsAppLog", "Notification"];

// Modules that can emit business events into the trigger system.
const SOURCE_MODULES = ["crm", "proposal", "pms", "finance", "system"];

// Workflow action kinds (THEN side of WHEN → IF → THEN).
const ACTION_TYPES = ["start_campaign", "send_template", "notify", "stop_campaign"];

// Condition operators (IF side). Evaluated by conditionEvaluator.js (Phase 4).
const CONDITION_OPERATORS = [
  "eq", "ne", "gt", "gte", "lt", "lte", "in", "nin", "contains", "exists",
];

module.exports = {
  ENTITY_TYPES,
  CHANNELS,
  TEMPLATE_CATEGORIES,
  MEDIA_TYPES,
  CAMPAIGN_AUDIENCES,
  CAMPAIGN_STATUSES,
  DELAY_UNITS,
  ENROLLMENT_STATUSES,
  JOB_STATUSES,
  MESSAGE_STATUSES,
  PROVIDER_LOG_REFS,
  SOURCE_MODULES,
  ACTION_TYPES,
  CONDITION_OPERATORS,
};
