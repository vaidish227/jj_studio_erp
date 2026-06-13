# RBAC Phase 2 — Stage 4 (CRM Write Enforcement) — IMPLEMENTED

> **Status: implemented.** Builds on Stage 2 (read enforcement) using the same
> alias-aware `requirePermission`. Aliases keep existing roles working; the only
> deliberate tightening is on roles that today hold **no** `crm.*` write
> permission. No migration, no `deniedPermissions`, no alias removal.

---

## 1. What changed

| File | Change |
|---|---|
| `auth/permissions/registry.js` | Added granular CRM write leaves: lead create/update/delete/qualify/convert/import, meeting create/update/delete, mom create, follow-up create/update/delete. Auto-included in `ALL_PERMISSIONS` and grantable in the matrix UI. |
| `auth/permissions/aliases.js` | Added 13 alias entries mapping each granular write → its coarse legacy (`crm.create` / `crm.update` / `crm.delete`). |
| `crm/routes/Lead.route.js` | Guarded `createlead`, `update`, `updatestatus`, `automation/thank-you`, `show-project`, `advance-payment`, `mark-interested`, `delete`, `convert`. |
| `crm/routes/Client.route.js` | Guarded `create`, `createclient`, `bulk-import`, `update`, `status`, `delete`, `timeline`. |
| `crm/routes/Metting.routes.js` | Guarded `create`, `update`, `delete`, `mom` (PUT). |
| `crm/routes/FollowUp.route.js` | Guarded `create`, `update`, `updatestatus`, `delete`. |
| `scripts/seedRoles.js` | Manager += `crm.delete` (retains delete after enforcement; create/update already covered by alias). **Re-run required.** |
| `frontend/shared/constants/permissions.js` | Added granular write constants for parity (no behavior change). |

No middleware change — `requirePermission`/`hasPermission` were already alias-aware from Stage 2.

## 2. Route → permission → alias map

| Method & Path | Granular guard | Alias (also passes) |
|---|---|---|
| `POST /leads/createlead`, `/clients/create`, `/clients/createclient` | `crm.lead.create` | `crm.create` |
| `POST /clients/bulk-import` | `crm.lead.import` | `crm.create` |
| `PUT /leads/update/:id`, `/clients/update/:id` | `crm.lead.update` | `crm.update` |
| `PATCH /leads/updatestatus/:id`, `/clients/status/:id` | `crm.lead.update` | `crm.update` |
| `POST /leads/automation/thank-you/:id`, `/clients/timeline/:id` | `crm.lead.update` | `crm.update` |
| `PATCH /leads/show-project/:id`, `/leads/advance-payment/:id` | `crm.lead.update` | `crm.update` |
| `PATCH /leads/mark-interested/:id` | `crm.lead.qualify` | `crm.update` |
| `POST /leads/convert/:id` | `crm.lead.convert` | `crm.update` |
| `DELETE /leads/delete/:id`, `/clients/delete/:id` | `crm.lead.delete` | `crm.delete` |
| `POST /metting/create` | `crm.meeting.create` | `crm.create` |
| `PUT /metting/update/:id` | `crm.meeting.update` | `crm.update` |
| `DELETE /metting/delete/:id` | `crm.meeting.delete` | `crm.delete` |
| `PUT /metting/mom/:id` | `crm.mom.create` | `crm.update` |
| `POST /followup/create` | `crm.followup.create` | `crm.create` |
| `PUT /followup/update/:id`, `PATCH /followup/updatestatus/:id` | `crm.followup.update` | `crm.update` |
| `DELETE /followup/delete/:id` | `crm.followup.delete` | `crm.delete` |

## 3. Per-role impact (after `seedRoles.js` re-run)

| Role | create/update writes | delete | Net effect |
|---|---|---|---|
| Admin (`*`) | ✅ | ✅ | No change |
| Manager (`crm.create/update` + **new `crm.delete`**) | ✅ via alias | ✅ via new grant | No change (delete preserved by grant) |
| Sales (`crm.create/update`) | ✅ via alias | ❌ (lacked `crm.delete` before too) | No change vs intended matrix |
| MD (`crm.lead.read` only) | ❌ | ❌ | **Loses** CRM writes — intended (MD = read-only) |
| Designer (6 users — `clients.read` only) | ❌ | ❌ | **Loses** lead writes (e.g. SalesPipeline drag) — *intended tightening* |
| Supervisor (`crm.read`, `clients.read`) | ❌ | ❌ | **Loses** lead writes (had none via UI) |
| Accounts (`clients.read`) | ❌ | ❌ | **Loses** lead writes (had none) |
| Vendor / Client | ❌ | ❌ | Blocked (intended) |

> ⚠️ **Designer is the one live-user risk.** 6 designers are active. If the
> Designer dashboard renders the **SalesPipeline drag-drop** (a lead status
> write) or any CRM write widget, those actions will now return **403**. Decide:
> (a) accept the 403s (writes were never part of the Designer role), or
> (b) hide the write widgets for Designer/Supervisor (frontend UX follow-up).
> Reads are unaffected — designers keep `clients.read`.

## 4. Deploy steps
1. **Backup** `Role.permissions` to a dated collection.
2. **Re-run** `node backend/src/scripts/seedRoles.js` (applies Manager `crm.delete`).
3. Smoke test: Manager create/edit/delete lead+meeting+follow-up; Sales create/edit/convert (no delete); MD blocked on writes; Designer reads OK.
4. Watch server logs for unexpected 403s (expect only MD/Designer/Supervisor/Accounts writes + Vendor/Client).

## 5. Rollback
- Per route: delete the `requirePermission('crm.*.*')` write line → reverts to Stage-2 behavior (read-guarded, write-open).
- Manager `crm.delete`: additive; remove from seed + re-run to undo.
- Aliases/registry additions are inert without the route guards.

## 6. Not in this stage (still remaining)
- `crm.lead.assign` (no dedicated assign endpoint exists — needs new route).
- Track B granular split (PMS / Proposal / KIT / etc.).
- Migration script + alias removal.
- Frontend write-widget hiding for read-only roles (Designer/Supervisor).
