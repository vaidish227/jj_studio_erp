/**
 * ─── Permission alias map (backward-compatibility shim) ──────────────────────
 *
 * Maps a NEW granular permission to the LEGACY permission(s) that should also
 * satisfy it. Consumed by `auth.middleware.hasPermission`: a guard for a new
 * permission passes if the user holds the new permission, `*`, OR any alias.
 *
 * This lets us introduce granular route enforcement (e.g. `crm.lead.read`)
 * without changing existing roles — anyone who already holds the coarse legacy
 * permission keeps working. Aliases are removed only in a later, separately
 * approved phase, after the granular roll-out is fully verified.
 *
 * Invariants:
 *   - keys are granular permissions present in the registry
 *   - values are legacy permission strings that grant equivalent-or-broader access
 */
const PERMISSION_ALIASES = {
  // Phase 2 Stage 2 — CRM read enforcement.
  // Every internal role already holds `clients.read` or `crm.read`, so read
  // enforcement produces zero 403s for internal users.
  "crm.lead.read": ["clients.read", "crm.read"],

  // Phase 2 Stage 4 — CRM write enforcement.
  // Each granular write is satisfied by the coarse `crm.create` / `crm.update`
  // / `crm.delete` it splits from, so any role holding the legacy coarse
  // permission keeps working without a role change.
  "crm.lead.create": ["crm.create"],
  "crm.lead.update": ["crm.update"],
  "crm.lead.delete": ["crm.delete"],
  "crm.lead.qualify": ["crm.update"],
  "crm.lead.convert": ["crm.update"],
  "crm.lead.import": ["crm.create"],
  "crm.meeting.create": ["crm.create"],
  "crm.meeting.update": ["crm.update"],
  "crm.meeting.delete": ["crm.delete"],
  "crm.mom.create": ["crm.update"],
  "crm.followup.create": ["crm.create"],
  "crm.followup.update": ["crm.update"],
  "crm.followup.delete": ["crm.delete"],

  // Document Repository — new module-level permissions. Anyone who can see
  // projects can browse the repository; PMs (projects.update) and uploaders
  // (drawings.upload) can add files, so existing roles work without edits.
  "documents.read":   ["projects.read"],
  "documents.upload": ["projects.update", "drawings.upload"],
  "documents.update": ["projects.update"],
  "documents.delete": ["projects.delete"],
};

/** Return the legacy aliases that also satisfy `permission` (or []). */
function aliasesFor(permission) {
  return PERMISSION_ALIASES[permission] || [];
}

module.exports = { PERMISSION_ALIASES, aliasesFor };
