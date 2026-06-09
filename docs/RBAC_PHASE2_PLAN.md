# RBAC Phase 2 — Implementation Plan (Planning Only)

> **Status:** Planning/analysis only. No code, middleware, seeds, roles, or migrations changed.
> **Builds on:** Phase 1 (Permission Registry as single source of truth; Module → Section → Action UI).

---

## 0. Critical pre-work finding — enforcement coverage is uneven

Before designing expansion, a coverage audit of the live routes reveals that **enforcement is inconsistent across modules**:

| Area | Backend guard today | Implication |
|---|---|---|
| **CRM** — `/api/leads`, `/api/clients`, `/api/followup`, `/api/metting` | **None** — only global `verifyToken` (see `app.js:23-36`; the route files carry no `requirePermission`) | Any authenticated user can call lead/meeting/MOM/follow-up/convert APIs. `crm.*` permissions gate **only the frontend nav/UI**, not the API. |
| **PMS** — Task/Drawing/Project/Planner/etc. | `requirePermission(...)` per route | Properly gated. |
| **Proposal / KIT / Mail / WhatsApp** | `requirePermission(...)` | Properly gated. |
| **CRM Proposal** (`crm/routes/Proposal.route.js`) | `requirePermission('proposal.*')` | Gated. |

**Consequence for Phase 2:** Adding granular CRM permissions is **new enforcement**, not a split of existing checks. It will *tighten* access where today there is none — e.g. a Designer or Accounts user can currently hit `/api/leads` (frontend hides it, API allows it). When we add `requirePermission('crm.lead.read')`, those roles get 403 unless granted. **This must be a deliberate, announced behavior change**, rolled out behind the back-compat shim (Section 3) so current holders of `crm.read` keep working and only genuinely-unauthorized roles are newly blocked.

This finding reshapes the plan: Phase 2 is **two tracks** — (A) *close the CRM enforcement gap* (higher risk, needs the most care), and (B) *granular split of already-guarded modules* (lower risk, the shim makes it transparent).

---

## 1. Permission Gap Resolution — reconciled-but-unassigned permissions

These exist and are grantable after Phase 1, but few/no roles hold them. Recommendation = a **seed/role data change** (Phase 2, additive), not enforcement.

| Permission(s) | Current state | Recommended roles | Business justification | Risk |
|---|---|---|---|---|
| `template.read` | Enforced on `/api/Template` (proposal quotation templates); held by **admin only** (`*`) | manager, sales, accounts (read) | Sales/managers build proposals from quotation templates; they need to at least read them. Today they get 403 unless admin. | **Low** (additive read) |
| `template.create/update/delete` | Same; admin only | manager (full) | Managers maintain the quotation template library. | **Low–Med** (write to shared templates) |
| `proposal.send` | Enforced on proposal send route; held by **admin only** (manager/sales have read/create/update/approve but **not send**) | manager, sales | Sending a proposal to a client is core to both roles; currently only admin can send. | **Med** (outbound client email/eSign) |
| `planner.read` | manager ✓, md ✓, designer ✓, supervisor ✓ | (already well-assigned) | — | — |
| `planner.edit/assign/delete/baseline/import/export` | **manager only** | Consider `planner.edit` for **supervisor** (site schedule updates); confirm **md** stays read/dashboard | Supervisors adjust on-site task schedules; MD reviews only. | **Low** |
| `projects.customize_plan` | admin, md only (manager does **not** have it) | Decision: keep MD/admin-only, or extend to manager? | Plan customization at initiation is a senior action; likely intended MD-only. | **Low** (confirm intent) |
| `pd.review.respond` | md ✓, manager ✓ | (assigned) | — | — |
| `settings.checklists.manage`, `settings.workflows.manage` | manager ✓ | confirm md? | Template administration. | **Low** |
| `ai.chat / ai.admin / ai.docs.*` | **No role holds these** (AI gated by env flag + ad-hoc `AppLayout` check) | `ai.chat` → all internal roles (md, manager, sales, designer, supervisor, accounts) if AI enabled; `ai.admin`/`ai.docs.manage` → manager/admin | AI assistant is meant for staff; today only admin (wildcard) formally holds `ai.chat`. | **Low** (feature-flagged) |

**Deliverable for this item:** an updated `seedRoles.js` proposal (NOT applied yet) plus a one-shot, idempotent "grant additive" migration for existing custom roles. All additive — no permission removed.

---

## 2. Granular Permission Expansion — proposed model

Grammar: `module.section.action`. Each new permission lists the **route(s)** it would guard and the **legacy alias** that keeps current roles working during rollout (Section 3).

### CRM  *(Track A — currently unguarded)*
| New permission | Guards (route) | Legacy alias (shim) | Recommended roles |
|---|---|---|---|
| `crm.lead.read` | `GET /api/leads/*`, `/api/clients (get)` | `crm.read` | admin, manager, sales, supervisor |
| `crm.lead.create` | `POST /api/leads/createlead`, `/api/clients/create`, `bulk-import` | `crm.create` | admin, manager, sales |
| `crm.lead.update` | `PUT /api/leads/update`, `PATCH updatestatus` | `crm.update` | admin, manager, sales |
| `crm.lead.delete` | `DELETE /api/leads/delete` | `crm.delete` | admin, manager |
| `crm.lead.assign` | (assignment endpoint / `updatestatus`) | `crm.update` | admin, manager |
| `crm.lead.convert` | `POST /api/leads/convert/:id` | `crm.update` | admin, manager, sales |
| `crm.lead.qualify` | `PATCH /api/leads/mark-interested` | `crm.update` | admin, manager, sales |
| `crm.lead.import` | `POST /api/clients/bulk-import` | `crm.create` | admin, manager |
| `crm.followup.read` | `GET /api/followup/*` | `crm.read` | admin, manager, sales |
| `crm.followup.create` | `POST /api/followup/create` | `crm.create` | admin, manager, sales |
| `crm.followup.update` | `PUT /api/followup/update`, `updatestatus` | `crm.update` | admin, manager, sales |
| `crm.followup.delete` | `DELETE /api/followup/delete` | `crm.delete` | admin, manager |
| `crm.meeting.read` | `GET /api/metting/*` | `crm.read` | admin, manager, sales |
| `crm.meeting.create` | `POST /api/metting/create` | `crm.create` | admin, manager, sales |
| `crm.meeting.update` | `PUT /api/metting/update` (reschedule) | `crm.update` | admin, manager, sales |
| `crm.meeting.delete` | `DELETE /api/metting/delete` | `crm.delete` | admin, manager |
| `crm.mom.read` | `GET /api/metting/mom/:id` | `crm.read` | admin, manager, sales |
| `crm.mom.create` | `PUT /api/metting/mom/:id` | `crm.update` | admin, manager, sales |

### PMS  *(Track B — already guarded; split is transparent via aliases)*
| New permission | Guards | Legacy alias | Recommended roles |
|---|---|---|---|
| `pms.project.assign` | project team assign endpoints | `projects.tab.assign` / `projects.update` | admin, md, manager |
| `pms.task.assign` | task assign / `projects.tab.assign` | `tasks.reassign`/`projects.tab.assign` | admin, md, manager |
| `pms.drawing.approve` | `PATCH /drawings/approve` | `drawings.approve` | admin, md, manager |
| `pms.drawing.release` | `PATCH /drawings/release` | `drawings.release` | admin, md, manager |
| `pms.sitevisit.manage` | SiteVisit create/update | `site_visits.create/update` | admin, manager, supervisor, designer |
| `pms.project.closure` | Handover routes (`/api/pms/handover`) | `projects.update` | admin, md, manager |

*(Existing `tasks.*`, `drawings.*`, `milestones.*`, `planner.*` stay as-is; new strings above are additive sub-actions where the current model is too coarse — e.g. project closure currently rides on generic `projects.update`.)*

### Proposal  *(Track B)*
| New / existing permission | Guards | Legacy alias | Recommended roles |
|---|---|---|---|
| `proposal.proposal.create` (=existing `proposal.create`) | create routes | — | manager, sales |
| `proposal.proposal.update` | update | — | manager, sales |
| `proposal.proposal.approve` | approve | — | manager (md?) |
| `proposal.proposal.send` (=`proposal.send`, see §1) | send | `proposal.update` | manager, sales |
| `proposal.proposal.download` *(new)* | PDF export / `/api/esign` download | `proposal.read` | manager, sales, accounts |
| `proposal.template.read/create/update/delete` (=`template.*`, see §1) | `/api/Template` | `proposal.update` | manager (full), sales (read) |

### Remaining modules (same pattern, lower urgency)
- **KIT:** `kit.campaign.activate/pause` (alias `kit.update`), `kit.automation.enable/test` (alias `kit.manage`), `kit.template.create/update/delete` (alias `kit.tab.templates`/`kit.manage`), `kit.analytics.export` (alias `kit.read`).
- **Design & Drawings:** `design.drawing.download` (alias `drawings.read`), `design.drawing.request_revision` (alias `design.comment`), `design.dlr.create/approve` (currently reuse `site_logs.*`).
- **Site Ops:** `site.po.send_to_vendor` (alias `purchase_orders.update`), `site.material.mark_procured` (alias `materials.update`).
- **Settings:** `settings.responsibilities.read/manage` (today hardcoded `role==='admin'/'md'` — no permission; introduce real perms), `settings.roles.manage` (alias `settings.tab.roles`).
- **Reports:** `reports.pms.read`, `reports.crm.read`, `reports.kit.read` (today all collapse onto `reports.read`).

**Estimated new strings:** ~90–110, taking the registry from 118 → ~210–230.

---

## 3. Enforcement Strategy

### 3.1 The back-compat shim (keeps existing permissions working)
Introduce an **alias map** consumed by a new guard `requirePermission` enhancement (or a sibling `requireGranular`):

```
// permissions/aliases.js  (illustrative — Phase 2)
// new granular permission  ->  legacy permissions that also satisfy it
{
  'crm.lead.assign':   ['crm.update'],
  'crm.meeting.create':['crm.create'],
  'crm.mom.create':    ['crm.update'],
  'proposal.proposal.send': ['proposal.send', 'proposal.update'],
  ...
}
```

`requirePermission('crm.lead.assign')` passes if the user holds **`crm.lead.assign` OR any alias OR `*`**. Result: a Manager who today has `crm.update` is *automatically* authorized for all the new `crm.*` sub-actions — **zero role changes required to keep working**. Once roles are migrated to granular strings (Section 4) and verified, aliases are removed module-by-module.

### 3.2 Route protection (backend)
- **Track A (CRM):** add `requirePermission('crm.lead.read')` etc. to the currently-unguarded routes, *with aliases active*. Because aliases include `crm.read`/`crm.create`/`crm.update`/`crm.delete`, every role that holds the coarse `crm.*` keeps full access; only roles with **no** CRM permission (designer, accounts, vendor, client) get newly blocked — which is the intended tightening. **Flag this list explicitly for sign-off before enabling.**
- **Track B (PMS/Proposal/etc.):** swap the coarse `requirePermission('x.y')` for the granular string with the coarse one as its alias — transparent.

### 3.3 API protection
Same mechanism; controllers that do in-body `hasPermission(...)` checks (e.g. gate override) get the alias-aware helper.

### 3.4 Component visibility (frontend)
- Replace scattered `hasPermission('crm.update')` button checks with section helpers: `useCan('crm.lead.assign')` (alias-aware on the client too, via the registry's optional alias data).
- `<PermissionGate permission="crm.meeting.create">` for the relevant buttons.

### 3.5 Menu visibility (frontend)
- Phase-1 left `navigation.js` untouched. Phase 2 introduces **derived visibility**: a nav item shows if the user holds **any action in its section** (`hasAnyInSection('crm.meeting.*')`) rather than a single hand-picked string. Keep current `item.permission` as a fallback during rollout.

### 3.6 Backward compatibility summary
1. New strings are **additive**; nothing removed in the same step.
2. Alias map means **existing role arrays keep authorizing** the new checks.
3. Migration (Section 4) rewrites role arrays to granular strings.
4. Aliases removed only after per-module verification.
5. Frontend `localStorage` permissions remain valid (coarse strings still satisfy aliases) until users re-login or the (recommended) refresh endpoint lands.

---

## 4. Migration Strategy

### 4.1 Introducing new permissions
- Add them to the registry (single source of truth) → `ALL_PERMISSIONS` auto-grows → instantly grantable in the UI. (Same mechanism Phase 1 used.)

### 4.2 Mapping existing roles
- A one-shot **expansion script** (`scripts/migratePermissions.js`, dry-run + apply): for each role/user, expand coarse → granular using the inverse of the alias map. Example: a role with `crm.update` gains `crm.lead.update, crm.lead.assign, crm.lead.convert, crm.lead.qualify, crm.meeting.update, crm.mom.create, crm.followup.update`. Coarse strings retained until aliases are dropped.
- System roles re-authored in `seedRoles.js` (granular) per the §1/§2 recommendations.

### 4.3 Rollback strategy
- **Backup first:** snapshot every `Role.permissions` and `User.customPermissions` to a dated collection (`role_perms_backup_<ts>`).
- Script supports `--dry-run`, `--apply`, `--rollback`.
- Because aliases stay active during rollout, rollback = restore arrays + leave aliases in place; no enforcement breaks.

### 4.4 Testing strategy
- **Invariant tests:** every granular string in routes/seed exists in the registry; alias map keys ⊆ registry; alias values ⊆ legacy set; alias graph has no cycles.
- **Resolution tests:** `requirePermission(new)` passes for holders of the alias; fails for non-holders.
- **Route tests (per new perm):** with→200 / without→403, focused on **Track A CRM** (the genuine behavior change) — explicitly assert which roles gain/lose access.
- **Migration tests:** seed legacy data → expand → assert effective access is a **superset** (no loss); run twice → idempotent.
- **Regression checklist:** re-run the Phase-1 QA harness; confirm all 9 roles' effective reachable-route set is unchanged (Track B) or changed only as signed-off (Track A).

---

## 5. UX Improvements (Role & Permission admin)

| Improvement | Status today | Recommendation | Priority |
|---|---|---|---|
| **Role cloning** | ✅ Exists (Clone in role menu) | Keep; surface presets alongside | — |
| **Permission presets** | ❌ | Add "Sales Starter / Designer Starter / Read-only" templates to seed a new role's matrix in one click | **High** (biggest admin time-saver as the catalogue grows to ~220) |
| **Permission comparison** | ❌ | Side-by-side diff of two roles (or role vs user effective) — highlights add/missing | **Med** |
| **Permission export** | ❌ | Export a role's matrix (CSV/JSON) for audit/handoff; flag export-class actions | **Med** |
| **Permission audit view** | ❌ (no audit log yet) | Pairs with the deferred `PermissionAudit` log — show "who changed what, when" timeline per role/user | **Med** (depends on audit log, a deferred item) |
| **In-session refresh** | ❌ (re-login required) | `GET /api/auth/me/permissions` + refetch on focus/after save | **High** (admin edits apply live) |
| **Bulk column select** | ❌ | "Tick all View" / "Tick all Create" across a module | **Low** |

---

## Recommended Phase 2 sequencing (for your selection)
1. **§1 gap resolution** (assign `template.*`, `proposal.send`, AI, planner tweaks) — smallest, highest immediate value, pure additive data change.
2. **Alias map + Track B granular split** (PMS/Proposal) — transparent, no behavior change.
3. **Track A: CRM enforcement** — *the* security improvement, but a deliberate tightening; needs explicit role sign-off.
4. **UX: presets + in-session refresh.**
5. Migration + alias removal once verified.

**Deferred (unchanged from Phase 1 guardrails):** `deniedPermissions`, audit log, role inheritance, ownership/resource-level scoping.

---

## Constraints honored
No middleware, enforcement, seeds, roles, or migrations were changed. No new permissions were added to code. This document is analysis and planning only.
