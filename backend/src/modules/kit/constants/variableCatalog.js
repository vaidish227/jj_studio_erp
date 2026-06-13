/**
 * KIT Variable Catalog — Phase 0 foundation.
 *
 * Single source of truth for the `{{placeholder}}` tokens that KIT templates
 * (WhatsApp / Email / Notification) may contain. Two consumers will read this:
 *
 *   1. The Template Editor (frontend) — to render the variable picker / chips
 *      and to validate that a template only uses known variables.
 *   2. `variableResolver.js` (backend, Phase 2) — to resolve a token to a real
 *      value at send time, given an entity (lead / client / project / proposal).
 *
 * Rendering contract (already implemented in mail/whatsapp services):
 *   renderTemplate("Hi {{client_name}}", { client_name: "Asha" }) → "Hi Asha"
 *   Unknown/empty tokens are left as `{{token}}` by the existing renderer.
 *
 * `source` is metadata describing where the resolver should read the value from
 * once Phase 2 builds it. It is intentionally declarative (no logic here) so this
 * file stays a pure constant with no DB/Mongoose dependency.
 *
 *   source.entity  — which catalog entity the value hangs off of
 *   source.path    — dot-path on the resolved entity document (best-effort hint)
 *   source.format  — optional formatting hint ("date" | "currency" | "raw")
 */

// Entity types a KIT message can be addressed to. Mirrors the soft-ref
// `entityType` used by enrollments / message logs in later phases.
const ENTITY_TYPES = ["lead", "client", "project", "proposal"];

/**
 * Variable definitions. `entities` lists which entity types can resolve the
 * token (so the editor can offer only the relevant variables for a campaign's
 * audience). Keep keys snake_case to match the business-facing examples in the
 * KIT spec ({{client_name}}, {{project_name}}, {{proposal_number}}…).
 */
const VARIABLES = [
  // ── Person / contact ──────────────────────────────────────────────────────
  { key: "client_name",   label: "Client Name",   entities: ["lead", "client", "project", "proposal"], source: { entity: "lead",     path: "name",                 format: "raw" } },
  { key: "first_name",    label: "First Name",    entities: ["lead", "client", "project", "proposal"], source: { entity: "lead",     path: "name",                 format: "first-word" } },
  { key: "phone",         label: "Phone",         entities: ["lead", "client"],                        source: { entity: "lead",     path: "phone",                format: "raw" } },
  { key: "email",         label: "Email",         entities: ["lead", "client"],                        source: { entity: "lead",     path: "email",                format: "raw" } },
  { key: "city",          label: "City",          entities: ["lead", "client"],                        source: { entity: "lead",     path: "city",                 format: "raw" } },

  // ── Sales / pipeline ──────────────────────────────────────────────────────
  { key: "project_type",  label: "Project Type",  entities: ["lead", "client", "project"],             source: { entity: "lead",     path: "projectType",          format: "raw" } },
  { key: "meeting_date",  label: "Meeting Date",  entities: ["lead"],                                  source: { entity: "meeting",  path: "scheduledAt",          format: "date" } },
  { key: "followup_date", label: "Follow-up Date",entities: ["lead"],                                  source: { entity: "followup", path: "date",                 format: "date" } },

  // ── Proposal ──────────────────────────────────────────────────────────────
  { key: "proposal_number", label: "Proposal No.", entities: ["proposal"],                             source: { entity: "proposal", path: "proposalNumber",       format: "raw" } },
  { key: "proposal_amount", label: "Proposal Amount", entities: ["proposal"],                          source: { entity: "proposal", path: "totalAmount",          format: "currency" } },
  { key: "proposal_status", label: "Proposal Status", entities: ["proposal"],                          source: { entity: "proposal", path: "status",               format: "raw" } },

  // ── Project (PMS) ─────────────────────────────────────────────────────────
  { key: "project_name",    label: "Project Name",    entities: ["project"],                           source: { entity: "project",  path: "name",                 format: "raw" } },
  { key: "project_phase",   label: "Project Phase",   entities: ["project"],                           source: { entity: "project",  path: "phase",                format: "raw" } },
  { key: "project_progress",label: "Project Progress",entities: ["project"],                           source: { entity: "project",  path: "progressPercent",      format: "raw" } },
  { key: "site_visit_date", label: "Site Visit Date", entities: ["project"],                           source: { entity: "siteVisit",path: "visitDate",            format: "date" } },
  { key: "milestone_name",  label: "Milestone Name",  entities: ["project"],                           source: { entity: "milestone",path: "name",                 format: "raw" } },

  // ── Company / sender (static, always available) ───────────────────────────
  { key: "company_name",  label: "Company Name",  entities: ENTITY_TYPES,                              source: { entity: "static",   path: "JJ Studio",            format: "raw" } },
];

// Convenience lookups.
const VARIABLE_KEYS = VARIABLES.map((v) => v.key);

const getVariablesForEntity = (entityType) =>
  VARIABLES.filter((v) => v.entities.includes(entityType));

/**
 * Returns the list of unknown tokens used by a body string — i.e. `{{tokens}}`
 * that are not in the catalog. Empty array = template is valid.
 */
const findUnknownVariables = (body = "") => {
  const used = [...body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
  return [...new Set(used)].filter((t) => !VARIABLE_KEYS.includes(t));
};

module.exports = {
  ENTITY_TYPES,
  VARIABLES,
  VARIABLE_KEYS,
  getVariablesForEntity,
  findUnknownVariables,
};
