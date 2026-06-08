# Permission Presets / Role Templates — Implementation Plan (Planning Only)

> **Not implemented.** No schema changes, no role migrations, no permission/enforcement/alias changes. Existing roles remain untouched. Presets are a *role-authoring convenience* that produce permission arrays the existing `PUT /api/roles/:id` flow already accepts.

---

## 1. Architecture

### Where presets are stored
A new **static, version-controlled** module: `backend/src/modules/auth/permissions/presets.js` — the same pattern as the Phase-1 registry. Presets are code (not a DB collection) for v1: reviewable in PRs, no admin-editing surface, no audit/migration burden. (DB-editable presets are a possible later enhancement.)

### How presets are exposed to the frontend
A read-only endpoint **`GET /api/roles/presets`** (admin/md), returning the preset list `{ version, presets: [{ key, label, description, permissions:[...] }] }`. The role editor fetches it once (like `/api/roles/registry`).

### Versioning
- Presets live in git → full history/diff for free.
- The payload includes an integer `PRESETS_VERSION` (bumped on edit) for cache-busting and so the UI can show "templates updated".
- Presets are **descriptive, not binding**: a role created from a preset stores a plain permission array and is **not linked** to the preset. Editing a preset later never retroactively changes existing roles (no drift, no migration).

### How registry and presets interact
- Every preset permission **must be a registry leaf** (`flattenPermissions()`); a unit test enforces `presetPerms ⊆ registry`.
- Presets **bundle** registry leaves; they never define new permissions. The registry stays the single source of truth for *what permissions exist*; presets are *curated selections* of them.

```js
// presets.js (illustrative)
const PRESETS_VERSION = 1;
const PRESETS = [
  { key:'base_staff', label:'Base Staff', description:'Floor every internal user needs',
    permissions:['dashboard.read','calendar.read','activity.read','clients.read','tasks.read','ai.chat','ai.docs.read'] },
  ...
];
module.exports = { PRESETS, PRESETS_VERSION };
```

---

## 2. Preset Definitions (final)

10 presets. All strings verified ⊆ current registry.

| Preset | Permissions |
|---|---|
| **base_staff** | `dashboard.read, calendar.read, activity.read, clients.read, tasks.read, ai.chat, ai.docs.read` |
| **crm_sales** | `crm.read/create/update, crm.tab.{clients,leads,meetings,converted,lost}, crm.lead.read, proposal.read/create/update/send, proposal.tab.templates, template.read, kit.read/create/update, kit.tab.templates, mail.read/send, whatsapp.read/send` |
| **proposal_management** | `proposal.read/create/update/approve/send, proposal.tab.{templates,approval}, template.read/create/update/delete` |
| **field_execution** | `projects.read, tasks.read/update/submit, pms.tab.{tasks,drawings,team}, drawings.read/upload, design.comment, designer.dashboard, site_logs.read/create, site_visits.read/create, materials.read/create/update, purchase_orders.read, milestones.read, approvals.read/create, planner.read` |
| **design_review** | `drawings.read/approve/release, design.comment, pd.review.respond, approvals.read/respond, pms.tab.drawings` |
| **pms_management** | `projects.read/create/update/customize_plan, projects.tab.{assign,review}, tasks.read/create/update/delete/approve/reassign/override_gate, milestones.read/create/update/delete, planner.read/edit/assign/delete/import/export/baseline/dashboard, pms.tab.{tasks,drawings,team}, pms.whatsapp.manage` |
| **site_operations** | `site_logs.read/create, site_visits.read/create/update, materials.read/create/update/delete, purchase_orders.read/create/update` |
| **finance_accounts** | `finance.read/create/update, reports.read/export, proposal.read, template.read, clients.read, dashboard.read` |
| **communication_admin** | `mail.read/send/manage, whatsapp.read/send/manage, communication.settings.manage, pms.whatsapp.manage` |
| **administration** | `settings.read/manage, settings.tab.{users,roles}, settings.checklists.manage, settings.workflows.manage, users.read/create/update/delete/manage, ai.docs.manage` |
| **external_vendor** | `vendor.read/update` |
| **external_client** | `client_portal.read` |

> Refinement from verification: `designer.dashboard` moved into **field_execution** (designers need it without the approve/release powers of design_review).

### Mapping: current system roles → presets (verified against live DB)

| Role | Presets to compose | Fit (vs live role) |
|---|---|---|
| **admin** | *Full Access* (`*`) | exact (wildcard) |
| **sales** | base_staff + crm_sales | **0 missing**, 4 harmless extras (calendar/activity/crm.lead.read/kit.tab.templates) |
| **accounts** | base_staff + finance_accounts | **0 missing**, 3 extras (calendar/activity/tasks.read) |
| **designer** | base_staff + field_execution | **0 missing**, exact-ish |
| **vendor** | external_vendor | **exact** |
| **client** | external_client | **exact** |
| **manager** | base_staff + crm_sales + proposal_management + pms_management + design_review + field_execution + site_operations + administration + communication_admin | within **6/99** (residuals: `kit.manage, clients.update, vendor.*, reports.read` — added manually) |
| **md** | base_staff + pms_management + design_review | composite — presets give ~80%; read-only residuals (`crm.lead.read, reports.*, *.read`) added manually |
| **supervisor** | base_staff + field_execution + site_operations | composite — adjust (`crm.read, projects.update, tasks.create` added; some field perms trimmed) |

**Key point:** presets reproduce the simple roles cleanly and get composite roles (manager/MD/supervisor) ~80–95% of the way, with the admin finishing in the matrix. Presets are **starting points, never exact role definitions** — which is the intended design.

---

## 3. Frontend Changes

| File | Change |
|---|---|
| `modules/settings/pages/RolesPermissionsPage.jsx` | Add **"Apply preset ▾"** control in the sticky role-summary header (role mode only); render diff preview + apply. |
| `modules/settings/components/...` | New `PresetMenu.jsx` (dropdown of presets with counts) + `PresetDiffPreview.jsx`. |
| `modules/settings/hooks/useRolesPermissions.js` | Load presets (`getPresets()`); add `applyPreset(presetKey)` that unions the preset into `draftPermissions` (reuses existing `togglePermissionSet` semantics, additive). |
| `modules/settings/services/settingsService.js` | Add `getPresets()` → `GET /api/roles/presets`. |
| (Create Role modal, in the same page file) | Add **"Start from template"** multi-select; on submit, the new role's `permissions` = union of selected presets. |

### Apply-Preset workflow
1. Admin selects a role → clicks **Apply preset ▾** → picks a preset.
2. **Diff preview** shows `+N permissions (X new, Y already granted)` with the new ones listed.
3. **Apply** unions the preset into the working draft (does **not** save). The matrix updates; the Save bar appears.
4. Admin can apply **multiple** presets (union accumulates) and freely adjust before saving.

### Diff preview design
```
Apply "Field / Execution" to Manager?
  +22 permissions  ·  14 new, 8 already granted
  New: projects.read, tasks.submit, drawings.upload, site_logs.create, …(+10)
  [Cancel]  [Apply 14]
```

### Combining multiple presets
- Each apply is an **additive union** into the draft (idempotent — re-applying adds nothing new).
- Presets never remove permissions; de-selection is manual via the matrix.
- Create Role modal: selecting N templates pre-fills the union; the resulting matrix is fully editable before first save.

---

## 4. Backend Changes

| File | Change | Notes |
|---|---|---|
| `auth/permissions/presets.js` | **NEW** — `PRESETS` + `PRESETS_VERSION` | Static data |
| `settings/controllers/Roles.controller.js` | **MODIFY** — add `getPresets` handler | Returns `{ version, presets }` |
| `settings/routes/Roles.route.js` | **MODIFY** — add `GET /registry`-style `GET /presets` (admin/md) | New read route |

- **No `Role`/`User` model changes.** No schema change. No enforcement/alias/registry change.
- Optional: extend the existing registry invariant test to assert every preset permission ∈ registry.

---

## 5. Validation Plan

1. **Preset accuracy (unit):** every preset permission exists in the registry (`presetPerms ⊆ flattenPermissions()`); no duplicate keys; `PRESETS_VERSION` is an integer.
2. **Permission count verification:** reproduce the coverage harness — for each system role's intended preset composition, assert union covers the role within the documented residuals (regression guard against silent preset drift).
3. **Apply-preset behavior (unit/UI):** `applyPreset` unions correctly, is idempotent, never removes; multi-preset union equals set-union; Create-from-template seeds the expected array.
4. **Regression:** existing roles **unchanged** (presets never auto-apply or persist); `checkRoles.js` counts identical before/after the feature ships; frontend `npm run build` clean; `GET /api/roles/presets` returns valid payload; `GET /api/roles` and role save flow unaffected.
5. **Manual smoke:** create a new role "from template" → matrix matches union → save → reload round-trips; apply a preset to an existing role → review diff → save → only intended permissions added.

## 6. Rollback Plan
- Remove `presets.js` + the `getPresets` controller/route + the FE menu/components.
- **Zero data impact:** presets never persist anything themselves. Any role created/edited with a preset is just a normal role with a normal permission array — it remains valid and untouched after rollback.
- No migration to reverse, no role data to restore.

---

## Constraints honored
No DB schema change · no role migration · no permission change · no enforcement change · no alias change · existing roles untouched. Planning only — awaiting approval to implement.
