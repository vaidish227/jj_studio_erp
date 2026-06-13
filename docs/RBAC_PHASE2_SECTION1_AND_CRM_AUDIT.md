# RBAC Phase 2 — Section 1 (Gap Resolution) + CRM Access Audit

> **Planning only.** No routes, middleware, seeds, roles, permissions, or migrations changed.
> Current role assignments below are taken from `backend/src/scripts/seedRoles.js` and confirmed against the live DB (Phase-1 QA harness: counts match exactly).

---

## Part 1 — Permission Gap Resolution (currently unassigned / under-assigned)

### 1.1 `template.*` — Quotation Templates
- **Current enforcement:** Enforced. `/api/Template/*` (`proposal/routes/Template_route.js`) → `requirePermission('template.read|create|update|delete')`.
- **Current role assignments:** **None.** Only `admin` (via `*`). No system role holds `template.*`.
- **Recommended assignments:** `manager` → read/create/update/delete; `sales` → read; `accounts` → read (optional).
- **Business justification:** Quotation templates drive proposal creation. Managers curate the template library; sales apply templates when quoting.
- **Risk level:** Read **Low** · Write **Low–Medium** (writes to a shared library).
- **Impact if granted:** Managers/sales can manage & use templates through the API and Quotation-Templates UI.
- **Impact if NOT granted:** Template management stays admin-only. **Likely an active bug today:** any non-admin opening "Quotation Templates" hits 403, so the feature is effectively broken for managers/sales right now.

### 1.2 `proposal.send` — Send proposal to client
- **Current enforcement:** Enforced on the proposal **send** route (`requirePermission('proposal.send')`).
- **Current role assignments:** **None.** Only `admin` (`*`). Manager has `proposal.read/create/update/approve`; sales has `proposal.read/create/update` — **neither has `send`**.
- **Recommended assignments:** `manager`, `sales`.
- **Business justification:** Emailing a proposal / triggering eSign is the core sales close step.
- **Risk level:** **Medium** (outbound client communication + eSign).
- **Impact if granted:** Sales/managers can send proposals and start eSign.
- **Impact if NOT granted:** Only admin can send → hard bottleneck. **Likely active friction today** — sales clicking "Send" get 403.

### 1.3 `ai.*` — AI Assistant (`chat`, `admin`, `docs.read`, `docs.manage`)
- **Current enforcement:** Enforced on `/api/ai/*`; frontend additionally gated by `VITE_ENABLE_AI` + an `ai.chat` check in `AppLayout`.
- **Current role assignments:** **None.** Only `admin` (`*`).
- **Recommended assignments (if AI is enabled):** `ai.chat` + `ai.docs.read` → md, manager, sales, designer, supervisor, accounts; `ai.admin` + `ai.docs.manage` → manager (+ admin).
- **Business justification:** The assistant is a staff productivity tool; everyone using the ERP should be able to chat with it.
- **Risk level:** **Low** (feature-flagged; chat/read). `ai.admin` **Medium** (usage/cost dashboards).
- **Impact if granted:** Staff can use AI; the feature actually becomes usable beyond admin.
- **Impact if NOT granted:** AI remains dormant for all non-admin users even when the feature flag is on.

### 1.4 `planner.*` — PMS master sheet
- **Current enforcement:** Enforced on `/api/pms/planner/*`.
- **Current role assignments:** `manager` → full (read/edit/assign/delete/baseline/dashboard/import/export); `md` → read + dashboard; `designer` → read; `supervisor` → read.
- **Recommended assignments:** Largely fine. **Optional:** add `planner.edit` (+ maybe `planner.assign`) to `supervisor` if supervisors adjust on-site schedules. Confirm MD stays read/dashboard only.
- **Business justification:** Supervisors manage live site sequencing; MD reviews.
- **Risk level:** **Low.**
- **Impact if granted (supervisor edit):** Supervisors can update planner rows.
- **Impact if NOT granted:** Status quo — supervisors are read-only on the planner.

### 1.5 Other reconciled permissions (status check)
| Permission | Current assignment | Recommendation | Risk |
|---|---|---|---|
| `projects.customize_plan` | admin, md (manager does **not** have it) | Confirm **MD/admin-only** (senior initiation action) or extend to manager — business call | Low |
| `pd.review.respond` | md, manager | Already assigned — no action | — |
| `settings.checklists.manage`, `settings.workflows.manage` | manager | Confirm whether MD should also manage templates | Low |
| `proposal.tab.templates` (page visibility) | manager, sales | Pairs with §1.1 `template.*` grants | Low |

---

## Part 2 — CRM Access Audit (decision required before any enforcement)

### 2.1 The core structural fact
`/api/leads/*` **and** `/api/clients/*` are both served by **one controller** (`CRMClient.controller`) and are mounted with **only** `verifyToken` — **no `requirePermission`** (`app.js:23-36`). Therefore:
- **Today, every authenticated user has FULL API access** to leads, meetings, MOM, follow-ups, conversion, deletion, and bulk import — regardless of role.
- `crm.*` permissions gate **only the sidebar/UI**, not the API.
- Because leads and converted clients share the controller, **read endpoints must remain reachable by `clients.read` holders** (Designer, Supervisor, Accounts) or those roles lose client-profile data they depend on for projects/billing.

### 2.2 Current state matrix

| Role | Current UI Access (CRM) | Current API Access (CRM) |
|---|---|---|
| **Admin** | Full | **Full** (wildcard) |
| **Managing Director** | None (no `crm.read` in sidebar) | **Full** (unguarded) |
| **Manager** | Full (read/create/update + all tabs; no delete button) | **Full** (unguarded) |
| **Sales Executive** | Full (read/create/update + all tabs; no delete button) | **Full** (unguarded) |
| **Designer** | None (no `crm.read`) — but holds `clients.read` | **Full** (unguarded) |
| **Supervisor** | Partial — CRM parent visible (`crm.read`) but no child tabs (`crm.tab.*` ungranted) | **Full** (unguarded) |
| **Accounts** | None — but holds `clients.read` | **Full** (unguarded) |
| **Vendor** | None | **Full** (unguarded) ⚠️ external |
| **Client** | None | **Full** (unguarded) ⚠️ external |

⚠️ **The headline risk:** external **Vendor** and **Client** roles can currently call internal lead/meeting/MOM/follow-up APIs directly.

### 2.3 Recommended access matrix (per CRM capability)

Legend: ✓ full · **R** read-only · ✗ none. ("Client read" = retains converted-client profile reads via `clients.read`, distinct from lead-pipeline actions.)

| Role | Leads (view) | Create | Edit | Delete | Assign | Convert | Meetings | MOM | Follow-ups | CRM Reports |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **Admin** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Managing Director** | R | ✗ | ✗ | ✗ | ✗ | ✗ | R | R | R | ✓ |
| **Manager** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Sales Executive** | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | R |
| **Designer** | ✗ (keeps *client* read) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Supervisor** | R (keeps *client* read) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Accounts** | R (keeps *client* read) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | R |
| **Vendor** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Client** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

### 2.4 Per-capability: current → recommended + rationale

| Capability | Current behavior | Recommended behavior | Business rationale |
|---|---|---|---|
| **Leads (view)** | All authenticated roles (incl. vendor/client) | Admin/Manager/Sales full; MD/Supervisor/Accounts read; Designer/Vendor/Client none | Pipeline visibility for sales + oversight; close external access |
| **Lead Creation** | All roles | Admin/Manager/Sales | Only sales-side staff create leads |
| **Lead Editing** | All roles | Admin/Manager/Sales | Lead owners edit; others read |
| **Lead Deletion** | All roles | Admin/Manager | Destructive — restrict to managers+ |
| **Lead Assignment** | All roles (rides on edit; no dedicated endpoint) | Admin/Manager | Managers distribute leads to sales |
| **Lead Conversion** | All roles | Admin/Manager/Sales | Converting a lead to a client/project is a sales action |
| **Meetings** | All roles | Admin/Manager/Sales full; MD read | Sales schedule/run client meetings |
| **MOM** | All roles | Admin/Manager/Sales full; MD read | Minutes captured by the meeting owner |
| **Follow-ups** | All roles | Admin/Manager/Sales full; MD read | Sales own follow-up cadence |
| **CRM Reports** | All roles (CRM dashboard unguarded) | Admin/Manager/MD full; Sales/Accounts read | Pipeline analytics for management + finance |

### 2.5 "Do not remove access" safeguards (mandatory before enforcement)
1. **Split read by resource, not endpoint.** Guard `/api/clients/*` *read* with **`clients.read` OR `crm.lead.read`** (alias) so Designer/Supervisor/Accounts keep converted-client reads. Guard *lead-pipeline* writes (`/api/leads`, `/api/followup`, `/api/metting`) with `crm.*`.
2. **Caller audit first.** Enumerate every frontend caller of `/api/clients/*` and `/api/leads/*` (project detail, proposals, dashboards) and confirm each caller's role retains the needed read via the alias.
3. **Enable behind the alias shim** (Phase-2 §3): holders of coarse `crm.read/create/update/delete` are auto-authorized; only roles with **no** CRM permission (designer/vendor/client) are newly blocked — exactly the intended tightening.
4. **Assignment caveat:** there is no dedicated assign endpoint today (assignment rides on update/status). True `crm.lead.assign` granularity needs a dedicated endpoint or a conditional check — call this out as an implementation sub-task, not a same-day change.
5. **Roll out read-only first** (view/reports), then writes, monitoring 403s.

### 2.6 Net effect of recommended model
- **No change** to Admin/Manager/Sales real usage (they keep everything they actually use; Sales merely won't delete/assign).
- **MD/Supervisor/Accounts:** gain *formal* read access matching their real need; lose only the *latent, unintended* write access they never used via UI.
- **Designer:** keeps client-profile reads (`clients.read`); loses latent lead-write API access (intended).
- **Vendor/Client:** lose unintended internal CRM API access — **the primary security win.**

---

## Part 3 — Track B implementation plan + estimated impact (PMS / Proposal / KIT)

Track B modules are **already route-guarded**, so the granular split is **transparent**: each new `module.section.action` carries the existing coarse permission as an alias, and current roles keep working with **zero role changes**.

### 3.1 Mechanism (shared)
- New file `permissions/aliases.js` — `{ newPerm: [legacyPerm, ...] }`.
- Enhance `requirePermission` (or add `requireGranular`) to pass if the user holds the new perm **or any alias or `*`**.
- Add new strings to `registry.js` (auto-grows `ALL_PERMISSIONS`, instantly grantable, shown in the Phase-1 matrix).

### 3.2 Scope & impact by module

**PMS** — new strings (alias):
- `pms.task.assign` (`projects.tab.assign`/`tasks.reassign`), `pms.project.assign` (`projects.update`), `pms.drawing.approve` (`drawings.approve`), `pms.drawing.release` (`drawings.release`), `pms.sitevisit.manage` (`site_visits.create/update`), `pms.project.closure` (`projects.update`).
- Routes touched: ~6–8 (Task, Drawing, Project, Handover, SiteVisit). **Impact: transparent** (aliases). New strings: ~6.

**Proposal** — new/promoted strings (alias):
- `proposal.send` (already exists; assign per §1.2), `proposal.download` (`proposal.read`), `template.read/create/update/delete` (assign per §1.1; alias `proposal.update`), optional `proposal.reject`/`proposal.bulk_approve` (`proposal.approve`).
- Routes touched: ~4–6 (Proposal, Template, Esign). **Impact: transparent.** New strings: ~4–6.

**KIT** — new strings (alias):
- `kit.campaign.activate`/`pause` (`kit.update`), `kit.automation.enable`/`test` (`kit.manage`), `kit.template.create/update/delete` (`kit.tab.templates`/`kit.manage`), `kit.analytics.export` (`kit.read`).
- Routes touched: ~4–6 (kit.route). **Impact: transparent.** New strings: ~6–8.

### 3.3 Estimated effort & risk (Track B)
| Module | New strings | Routes touched | Role changes needed | Risk |
|---|---|---|---|---|
| PMS | ~6 | 6–8 | none (aliases) | **Low / transparent** |
| Proposal | ~4–6 | 4–6 | grant `template.*`+`send` (§1) | **Low** |
| KIT | ~6–8 | 4–6 | none (aliases) | **Low / transparent** |
| **Total** | **~16–20** | **~14–20** | §1 grants only | **Low** |

Plus shared: `aliases.js` (new), `requirePermission` enhancement (small, backward-compatible — extra OR branch), registry additions, tests (alias resolution, with/without route tests, idempotent expansion).

### 3.4 Recommended order
1. Approve the **CRM access model** (Part 2) — the only item with a real behavior change.
2. Apply **§1 grants** (template/send/ai/planner) — additive, fixes likely-active 403s.
3. Implement **Track B** behind aliases (transparent).
4. Implement **CRM enforcement** (Track A) behind aliases + read/clients safeguards, read-only first.
5. Migrate roles to granular strings; remove aliases per-module after verification.

---

## Constraints honored
No `requirePermission` added to CRM routes, no middleware/route-protection/seed/role/permission/migration changes. Analysis and recommendation only.
