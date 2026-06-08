# Permission Presets / Role Templates — Design Proposal (Planning Only)

> Analysis + proposal. **Not implemented.** Presets are a *role-authoring convenience*: they produce permission arrays the existing save flow already consumes — no enforcement, model, or migration change.

---

## 1. Current state & the problem

Authoring a role today means toggling individual permissions across a ~120-leaf matrix, or **Clone**-ing an existing role and editing. There are no reusable building blocks, so:
- New roles are built from scratch or by cloning a role that's "close enough" (then over/under-granting).
- Common intent ("a field user", "a read-only viewer") has to be reconstructed by hand each time.

### Data: overlap analysis of the 8 non-admin roles
- **Common base** (held by ≥5/8 roles): `dashboard.read`, `clients.read`, `tasks.read`, `ai.chat`, `ai.docs.read`.
- **Role similarity (Jaccard):** designer↔supervisor **59%**, md↔designer 40%, md↔supervisor 35%, manager↔(md 31% / designer 27% / sales 26%). Sales, Accounts, Vendor/Client are distinct.
- **Module footprint clusters:** CRM/Proposal/KIT → Sales & Manager; Projects/Tasks/Drawings/Site → MD/Designer/Supervisor; Finance → Accounts; Settings → Manager.

→ These clusters map cleanly onto a small set of reusable **presets**.

---

## 2. Preset Architecture

**A preset = a named, version-controlled bundle of permission strings** (all of which are registry leaves). Properties:
- **Composable:** a role = `Base Staff` + one or more functional presets (e.g. `Base` + `Field Execution`). Applying a preset is an **additive, non-destructive** toggle into the working draft — the admin reviews and can adjust before saving.
- **Suggestion, not law:** presets seed/extend a draft; they never lock a role or auto-mutate stored roles.
- **Single source of truth:** defined alongside the registry (`permissions/presets.js`), validated so every preset permission exists in the registry.

```js
// backend/src/modules/auth/permissions/presets.js  (illustrative)
{
  key: 'field_execution',
  label: 'Field / Execution',
  description: 'On-site project execution — tasks, drawings, site ops',
  permissions: ['projects.read','tasks.read','tasks.update','tasks.submit',
    'pms.tab.tasks','pms.tab.drawings','drawings.read','site_logs.read',
    'site_visits.read','site_visits.create','materials.read','planner.read', ...]
}
```

Served via `GET /api/roles/presets` (mirrors the Phase-1 registry pattern); the role editor renders an "Apply preset" menu.

---

## 3. Suggested Templates (data-derived)

| Preset | Intent | Core permissions (registry leaves) |
|---|---|---|
| **Base Staff** | Floor every internal user needs | `dashboard.read`, `calendar.read`, `activity.read`, `clients.read`, `tasks.read`, `ai.chat`, `ai.docs.read` |
| **CRM / Sales** | Lead-to-proposal pipeline | `crm.read/create/update`, `crm.tab.*`, `crm.lead.read`, `proposal.read/create/update/send`, `proposal.tab.templates`, `template.read`, `kit.read/create/update`, `kit.tab.templates`, `mail.read/send`, `whatsapp.read/send` |
| **Proposal Management** | Approve & curate quotations | `proposal.read/create/update/approve/send/delete`, `proposal.tab.templates/approval`, `template.read/create/update/delete` |
| **Field / Execution** *(designer↔supervisor 59%)* | On-site task & drawing work | `projects.read`, `tasks.read/update/submit`, `pms.tab.tasks/drawings/team`, `drawings.read/upload`, `design.comment`, `site_logs.read/create`, `site_visits.read/create`, `materials.read/create/update`, `purchase_orders.read`, `milestones.read`, `approvals.read/create`, `planner.read` |
| **Design Review** | Approve/release drawings | `drawings.read/approve/release`, `design.comment`, `pd.review.respond`, `approvals.read/respond`, `pms.tab.drawings` |
| **PMS Management** | Run projects | `projects.read/create/update`, `projects.tab.assign/review`, `tasks.*`, `milestones.*`, `planner.*`, `pms.tab.*`, `pms.whatsapp.manage` |
| **Finance / Accounts** | Billing & reporting | `finance.read/create/update`, `reports.read/export`, `proposal.read`, `template.read`, `clients.read` |
| **Administration** | System & user config | `settings.read/manage`, `settings.tab.users/roles`, `settings.checklists.manage`, `settings.workflows.manage`, `users.*` |
| **Read-only Viewer** | Oversight, no writes | curated `*.read` set (`dashboard.read`, `crm.lead.read`, `projects.read`, `reports.read`, …) |
| **External (Vendor / Client)** | Portal only | `vendor.read/update` / `client_portal.read` |

The 9 system roles can each be expressed as `Base Staff` + 1–2 of these (e.g. Sales = Base + CRM/Sales; Designer = Base + Field/Execution; Manager = Base + CRM/Sales + PMS Management + Design Review + Administration).

---

## 4. UI Proposal

Builds on the Phase-1 matrix; two entry points:

1. **Create Role modal → "Start from template"**: multi-select presets → the new role's matrix is pre-filled with the union. Admin adjusts, then saves.
2. **Role editor matrix header → "Apply preset ▾"**: adds a preset bundle to the current draft (additive), showing `+N permissions`. A small **diff preview** ("this preset adds X, all already-granted") before applying. Composable — apply several.

```
┌─ Manager · 99/120 ───── [Apply preset ▾] [Save] [Discard] ─┐
│  Apply preset ▾                                            │
│   ▸ Base Staff            (+7, 0 new)                       │
│   ▸ CRM / Sales           (+18, 3 new)   [Preview] [Apply] │
│   ▸ Field / Execution     (+14, 14 new)                    │
│  …                                                          │
└────────────────────────────────────────────────────────────┘
```
Non-destructive: presets only *add* to the draft; nothing is removed without the admin un-ticking it. Presets are clearly labeled "suggested starting points."

---

## 5. Backend Impact
- **New** `permissions/presets.js` (static bundles, validated ⊆ registry).
- **New** `GET /api/roles/presets` (admin/md) — returns the preset list.
- **No** schema change, **no** enforcement change, **no** change to `Role`/`User` models. Presets produce arrays the existing `PUT /api/roles/:id` already accepts.
- Optional invariant test: every preset permission exists in the registry.

## 6. Migration Impact
**None.** Presets do not touch existing roles; they are purely an authoring aid for new/edited roles. No data migration, no re-seed required. (Optional, opt-in future nicety: a "reconcile this role to preset X" diff tool — explicitly admin-initiated, not automatic.)

## 7. Rollback Strategy
Remove `presets.js` + the `/presets` endpoint + the UI menu. **Zero data impact** — presets never persist anything on their own; any role created/edited with a preset is just a normal role with a normal permission array. No migration to reverse.

---

## 8. Risk
- **Low.** Additive, non-destructive, no enforcement surface. Worst case is an admin applies a preset and saves an over-broad role — mitigated by the diff preview + the fact that the matrix shows exactly what will be saved.
- Keep presets curated in code (version-controlled) for v1; a DB-editable preset library is a possible later enhancement (adds an admin surface + audit needs).
