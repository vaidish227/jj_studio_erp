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
};

/** Return the legacy aliases that also satisfy `permission` (or []). */
function aliasesFor(permission) {
  return PERMISSION_ALIASES[permission] || [];
}

module.exports = { PERMISSION_ALIASES, aliasesFor };
