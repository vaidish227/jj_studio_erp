# RBAC Phase 2 — CRM Enforcement Plan (Planning Only)

> **No enforcement implemented.** Dependency map, route plan, alias table, per-role impact, and rollback for the approved staged CRM rollout. Aliases and legacy permissions are **retained** throughout.

---

## A. CRM Dependency Map

`/api/leads/*` and `/api/clients/*` share one controller (`CRMClient.controller`). All four endpoint groups are consumed through `shared/services/crmService.js`. Key fact: **dashboard pages carry no internal permission checks** (`grep` for `hasPermission`/`role` in `dashboard/pages` → none), so any role reaching them fires CRM reads.

### A.1 Client / Lead READ — `/clients/get`, `/clients/get/:id`, `/clients/dashboard`
| Consumer | Module | Roles that reach it | Notes / risk |
|---|---|---|---|
| `ClientsListPage` | CRM | manager, sales | Core CRM list |
| `LeadDetailsPage`, `useLeadDetails`, `useLeadList`, `LeadCard` | Leads | manager, sales | Core |
| **`ClientSearchSelect` → `CreateProjectModal`** | **PMS** | **manager, MD** | ⚠️ **MD holds neither `crm.read` nor `clients.read`** — project creation client-picker breaks unless MD gets `crm.lead.read` (matches approved MD=Read) |
| `ProposalClientsPage`, `ProposalListPage`, `CreateProposalPage`, `ApprovedClientDetails`, `ApprovalDashboard`, `SentProposalDashboard` | Proposal | manager, sales, **accounts** (read) | Accounts holds `clients.read` → alias covers |
| `CampaignBuilderPage`, `TemplateEditorPage` | KIT | manager, sales | Audience pickers |
| `DashboardPage`, `CRMDashboardPage`, `HotLeadsPanel`, `SalesPipeline`, `useCRMDashboard` | Dashboard | manager, sales, **designer, supervisor, accounts** (any `dashboard.read`) | ⚠️ no page gating; `/clients/dashboard` = "CRM Reports" |
| `useClientInfo`, `useEnquiry`, `useLeadFlow`, `useLeadStatusManager` | Shared | manager, sales | |
| `ToolMessage` (AI client lookups) | AI | AI users | |

### A.2 Meetings — `/metting/*`
| Consumer | Module | Roles | Notes |
|---|---|---|---|
| `MeetingsPage`, `RecordMOMModal` | Leads | manager, sales | Meeting + MOM |
| `LeadDetailsPage` (schedule/reschedule) | Leads | manager, sales | |
| Dashboard "today meetings" widget (if rendered) | Dashboard | any `dashboard.read` | ⚠️ verify in Stage 1 |

### A.3 Follow-ups — `/followup/*`
| Consumer | Module | Roles | Notes |
|---|---|---|---|
| `useFollowups`, `FollowUpsPage` | Dashboard | manager, sales, **designer, supervisor, accounts** | ⚠️ dashboard renders follow-ups widget unconditionally |
| `LeadDetailsPage` | Leads | manager, sales | |

### A.4 Writes — create/update/status/convert/import/meeting-write/mom/followup-write
| Consumer | Module | Roles | Notes |
|---|---|---|---|
| `EnquiryFormPage`, `ClientInfoFormPage`, `ImportClientsModal` | CRM | manager, sales | Create / enrich / bulk import |
| `LeadDetailsPage`, `useLeadStatusManager`, `useLeadFlow` | Leads | manager, sales | Lifecycle / status |
| `SalesPipeline` (drag-drop status) | Dashboard | any `dashboard.read` | ⚠️ designer/supervisor can currently move leads → 403 after write-stage (intended) |
| `CreateProposalPage` (markInterested / convert triggers) | Proposal | manager, sales | |

**Vendor / Client portals:** no consumer of these endpoints found in vendor/client UI — confirm in Stage 1, then their loss of access is purely the security fix.

---

## B. Route-by-Route Enforcement Plan

Guards added **with aliases active**. Stage column = approved rollout order.

| Method & Path | Capability | Proposed guard (granular) | Alias (also passes) | Stage |
|---|---|---|---|---|
| `GET /clients/get`, `/clients/get/:id` | Clients/Leads Read | `crm.lead.read` | `clients.read` | **2** |
| `GET /leads/getlead`, `/leads/get/:id` | Leads Read | `crm.lead.read` | `clients.read` | **2** |
| `GET /clients/dashboard`, `/clients/totalclient`, `/leads/total` | CRM Reports (read) | `crm.lead.read` | `clients.read` | **2** (kept permissive; true reports-restriction deferred) |
| `GET /metting/get`, `/get/:leadId`, `/getmetting`, `/gettotal` | Meetings Read | `crm.lead.read` | `clients.read` | **2** |
| `GET /metting/mom/:id` | MOM Read | `crm.lead.read` | `clients.read` | **2** |
| `GET /followup/get`, `/get/:leadId`, `/total` | Follow-ups Read | `crm.lead.read` | `clients.read` | **2** |
| `POST /clients/create`, `/leads/createlead` | Lead Create | `crm.lead.create` | `crm.create` | **4** |
| `POST /clients/bulk-import` | Lead Import | `crm.lead.import` | `crm.create` | **4** |
| `PUT /clients/update/:id`, `/leads/update/:id` | Lead Edit | `crm.lead.update` | `crm.update` | **4** |
| `PATCH /clients/status/:id`, `/leads/updatestatus/:id` | Lead Edit / Status | `crm.lead.update` | `crm.update` | **4** |
| `PATCH /leads/mark-interested/:id` | Lead Qualify | `crm.lead.qualify` | `crm.update` | **4** |
| `POST /leads/convert/:id` | Lead Convert | `crm.lead.convert` | `crm.update` | **4** |
| `DELETE /clients/delete/:id`, `/leads/delete/:id` | Lead Delete | `crm.lead.delete` | `crm.delete` | **4** |
| `POST /clients/timeline/:id`, `/leads/automation/*`, `show-project`, `advance-payment` | Lead Edit (side effects) | `crm.lead.update` | `crm.update` | **4** |
| `POST /metting/create` | Meeting Create | `crm.meeting.create` | `crm.create` | **4** |
| `PUT /metting/update/:id` | Meeting Edit | `crm.meeting.update` | `crm.update` | **4** |
| `DELETE /metting/delete/:id` | Meeting Delete | `crm.meeting.delete` | `crm.delete` | **4** |
| `PUT /metting/mom/:id` | MOM Create/Edit | `crm.mom.create` | `crm.update` | **4** |
| `POST /followup/create` | Follow-up Create | `crm.followup.create` | `crm.create` | **4** |
| `PUT /followup/update/:id`, `PATCH /followup/updatestatus/:id` | Follow-up Edit | `crm.followup.update` | `crm.update` | **4** |
| `DELETE /followup/delete/:id` | Follow-up Delete | `crm.followup.delete` | `crm.delete` | **4** |

> **Assignment caveat:** there is no dedicated assign endpoint (`crm.lead.assign` rides on update today). A real assign permission needs a new endpoint — tracked as a separate sub-task, not part of this rollout.

---

## C. Alias Mapping Table

`permissions/aliases.js` (new in Phase 2). `requirePermission(new)` passes if user holds **the new perm OR any alias OR `*`**.

| Granular permission | Aliases (legacy that still authorize) |
|---|---|
| `crm.lead.read` | `clients.read`, `crm.read` |
| `crm.lead.create` | `crm.create` |
| `crm.lead.update` | `crm.update` |
| `crm.lead.delete` | `crm.delete` |
| `crm.lead.qualify` | `crm.update` |
| `crm.lead.convert` | `crm.update` |
| `crm.lead.import` | `crm.create` |
| `crm.meeting.read` | `clients.read`, `crm.read` |
| `crm.meeting.create` | `crm.create` |
| `crm.meeting.update` | `crm.update` |
| `crm.meeting.delete` | `crm.delete` |
| `crm.mom.read` | `clients.read`, `crm.read` |
| `crm.mom.create` | `crm.update` |
| `crm.followup.read` | `clients.read`, `crm.read` |
| `crm.followup.create` | `crm.create` |
| `crm.followup.update` | `crm.update` |
| `crm.followup.delete` | `crm.delete` |

**Why `clients.read` is in every CRM read alias:** all six internal roles already hold `clients.read`, so the read stage produces **zero 403s** for internal users. Only Vendor/Client (neither alias) are blocked.

---

## D. Impact Analysis per Role

Current `clients.read` / `crm.*` holdings → effect at each stage.

| Role | Holds today | Stage 2 (reads) | Stage 4 (writes) | Action needed |
|---|---|---|---|---|
| **Admin** | `*` | No change | No change | — |
| **Managing Director** | none of `crm.*`/`clients.read` | ⚠️ **would lose** client-picker read | n/a (no CRM writes) | **Grant `crm.lead.read`** (approved MD=Read) before Stage 2 |
| **Manager** | `crm.read/create/update`, `clients.read/update` | No change (alias) | No change (alias `crm.*`); + grant delete/assign per matrix | Optional: grant `crm.lead.delete`, `crm.lead.assign` |
| **Sales Executive** | `crm.read/create/update`, `clients.read` | No change (alias) | Keeps create/edit/convert; **no delete/assign** (already lacks `crm.delete`) | None (matches matrix) |
| **Designer** | `clients.read` (no `crm.*`) | No change — keeps reads via `clients.read` | **Loses** lead writes (e.g. SalesPipeline drag) — intended | None |
| **Supervisor** | `crm.read`, `clients.read` | No change (alias) | Loses lead writes (had none via UI) | None |
| **Accounts** | `clients.read` (no `crm.*`) | No change — keeps reads | Loses lead writes (had none) | None |
| **Vendor** | none | **Blocked** (intended security fix) | Blocked | Verify no vendor-portal caller (Stage 1) |
| **Client** | none | **Blocked** (intended security fix) | Blocked | Verify no client-portal caller (Stage 1) |

**Single required pre-Stage-2 data change:** grant **MD `crm.lead.read`**. Everything else is covered by aliases.

---

## E. Stage 1 Verification Outputs (to produce before any enforcement)
1. **Dependency map** (Section A) — confirm by grepping each consumer.
2. **Vendor/Client caller check** — confirm zero calls to these endpoints from vendor/client portals.
3. **Dashboard widget audit** — confirm which roles' dashboard renders `SalesPipeline` (write) and follow-up/meeting widgets; if Designer/Supervisor render them, plan to **hide the widget** (UX) rather than rely on 403s.

## F. Stage 3 Reports (after read enforcement, before writes)
- **403 report:** instrument `requirePermission` to log `{user, role, perm, path}` on denial; expect denials only from Vendor/Client (and any missed consumer).
- **Role impact report:** per role, list of CRM endpoints successfully reached vs denied.
- **Access validation report:** confirm Manager/Sales/Designer/Supervisor/Accounts/MD reach all reads they need; confirm Vendor/Client fully blocked.

## G. Rollback Plan
- **Reads (Stage 2):** to roll back, remove the `requirePermission` line from the affected route(s) — reverts to `verifyToken`-only (today's behavior). Aliases/legacy perms untouched, so no data restore needed.
- **Writes (Stage 4):** same — drop the guard per route to revert.
- **MD grant:** additive; to undo, remove `crm.lead.read` from the MD role (no other role affected).
- **No migrations, no `deniedPermissions`, no alias removal** during the whole rollout — so every step is a one-line route revert. Aliases are removed only in a **separate, later** phase after full verification and sign-off.
- Keep a dated backup of role arrays before the MD grant (consistent with prior phases).

---

## H. `ai.*` — per-permission role recommendation (do NOT grant yet)

| Permission | Guards | Recommended roles | Rationale | Risk |
|---|---|---|---|---|
| `ai.chat` | Use the assistant (`/api/ai/chat`) | md, manager, sales, designer, supervisor, accounts (all internal staff) | Core productivity tool for all staff; exclude external vendor/client | **Low** (feature-flagged) |
| `ai.docs.read` | Read AI knowledge base | manager, sales, designer, supervisor, accounts (staff who benefit from KB answers) | Lets the assistant cite internal docs for these users | **Low** |
| `ai.docs.manage` | Upload/edit knowledge base | manager (+ admin) | KB content ownership; curated, not open to all | **Medium** (shapes AI answers org-wide) |
| `ai.admin` | AI usage/cost dashboards & metrics | admin (optionally manager) | Operational/cost oversight | **Medium** (cost visibility) |

Suggested: enable `ai.chat`+`ai.docs.read` broadly to internal roles; keep `ai.docs.manage`/`ai.admin` narrow. Pending your go-ahead.

---

## Constraints honored
No CRM route guards added, no middleware/route-protection changes, no role/seed/permission/migration changes, no `deniedPermissions`, no inheritance, no ownership logic. Analysis and planning only.
