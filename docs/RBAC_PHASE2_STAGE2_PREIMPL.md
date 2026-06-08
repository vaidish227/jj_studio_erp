# RBAC Phase 2 — Stage 2 Pre-Implementation Report + AI Impact Assessment

> **No code changed.** This is the pre-implementation report for the approved scope. Awaiting final approval before editing.
> **Live user base (for impact):** admin 1 · md 1 · manager 1 · supervisor 1 · designer 6 · **sales 0 · accounts 0 · vendor 0 · client 0** — 10 active users total.

---

## PART 1 — AI Permission Impact Assessment (Decision 5)

AI is additionally gated by the `VITE_ENABLE_AI` frontend flag + an `ai.chat` check in `AppLayout`, so granting permissions does **not** expose AI unless the flag is on — safe to grant ahead of rollout.

| Permission | Backend routes it guards (`ai/routes/ai.route.js`) | Recommended roles | Users affected (current) | Cost / usage implication |
|---|---|---|---|---|
| **`ai.chat`** | `/chat` (SSE), `/polish-text` (the "AI" polish button, e.g. Record-MOM summary), `/conversations*` CRUD, `/feedback`, `/actions/:id/confirm\|cancel`, `/user-facts*` | md, manager, sales, designer, supervisor, accounts | **9** (md 1, manager 1, supervisor 1, designer 6; admin already via `*`) | **Primary cost driver** — each chat/polish is an LLM token call. Bounded by `aiRateLimit.middleware`. ~9 staff users = manageable. |
| **`ai.docs.read`** | `GET /documents`, `/documents/:id`, `/documents/:id/chunks` (RAG knowledge base read) | md, manager, sales, designer, supervisor, accounts | 9 | Negligible (DB reads; retrieval already runs inside chat). |
| **`ai.docs.manage`** | `POST/PUT/DELETE /documents`, `/documents/:id/reembed` | manager, admin | **2** (manager 1, admin 1) | Modest, infrequent — re-embedding calls the embeddings API per document on upload/edit. |
| **`ai.admin`** | `/health`, `/admin/metrics`, `/admin/summarize-facts` | admin only | **1** | Metrics negligible; `summarize-facts` is an admin-triggered LLM summarizer (controlled). |

**Assessment summary:** Granting `ai.chat`+`ai.docs.read` to the 6 internal roles affects **9 current users**, all staff; cost is LLM-usage-based and already rate-limited. `ai.docs.manage` (2 users) adds occasional embedding cost. `ai.admin` stays admin-only. No external role gets AI. **Recommendation: safe to apply with the env flag controlling exposure.** (These grants are *not* in the Stage 2 code change below — they can be applied together with, or separately from, Stage 2 on your word.)

---

## PART 2 — Stage 2 (CRM Read Enforcement) Pre-Implementation Report

### 2.1 Exact files to be modified

**Backend — alias infrastructure + new read permission**
| File | Change | Backward-compat |
|---|---|---|
| `auth/permissions/registry.js` | **MODIFY** — add `crm.lead.read` leaf under CRM → Leads ("Read — API"). Auto-included in `ALL_PERMISSIONS`; appears in the matrix. | Additive |
| `auth/permissions/aliases.js` | **NEW** — `{ 'crm.lead.read': ['clients.read', 'crm.read'] }` + `aliasesFor(perm)` helper | New file |
| `middleware/auth.middleware.js` | **MODIFY** — make `requirePermission`/`hasPermission` alias-aware: pass if perms include the permission, `*`, **or any alias**. | Existing perms have no alias entries → identical behavior; purely additive OR-branch |

**Backend — route guards (READ endpoints only)**
| File | Endpoints guarded with `requirePermission('crm.lead.read')` |
|---|---|
| `crm/routes/Lead.route.js` | `GET /getlead`, `GET /get/:id`, `GET /total`, `GET /coverted` |
| `crm/routes/Client.route.js` | `GET /get`, `GET /get/:id`, `GET /dashboard`, `GET /totalclient` |
| `crm/routes/Metting.routes.js` | `GET /get`, `GET /get/:leadId`, `GET /getmetting`, `GET /gettotal`, `GET /mom/:id` |
| `crm/routes/FollowUp.route.js` | `GET /get`, `GET /get/:leadId`, `GET /total` |

**Backend — approved grants (Decisions 1 & 2)**
| File | Change |
|---|---|
| `scripts/seedRoles.js` + re-run | `md` += `crm.lead.read`; `manager` += `proposal.send`, `template.read/create/update/delete`; `sales` += `proposal.send`, `template.read`; `accounts` += `template.read` |

**Frontend**
| File | Change |
|---|---|
| `shared/constants/permissions.js` | **MODIFY (optional)** — add `CRM_LEAD_READ: 'crm.lead.read'` for constant parity. No behavior change. |

> **Not touched in Stage 2:** all write endpoints (create/update/delete/convert/qualify/assign), sidebar/`navigation.js`/`PermissionGate` (menu & component visibility deferred), `user.model.js`, no migration, no `deniedPermissions`, no alias removal.

### 2.2 Route list being protected (READ only — ~16 endpoints)
Leads read · Clients read · CRM dashboard/stats read · Meetings read · MOM read · Follow-ups read. **All GET.** No write route is touched.

### 2.3 Alias mappings introduced
```
crm.lead.read  ->  [ clients.read, crm.read ]
```
Rationale: every internal role already holds `clients.read` (manager, sales, designer, supervisor, accounts) or `crm.read`; MD is granted `crm.lead.read` directly. Result: **0 internal 403s**; only Vendor/Client (neither alias) are denied.

### 2.4 Expected role impact (with live user counts)
| Role | Users | Holds today | Stage 2 read effect |
|---|---|---|---|
| Admin | 1 | `*` | No change |
| **Managing Director** | 1 | none of `crm.*`/`clients.read` | **+`crm.lead.read` granted** → reads + project client-picker work |
| Manager | 1 | `crm.read`, `clients.read` | No change (alias) |
| Designer | 6 | `clients.read` | No change — reads kept via `clients.read` alias |
| Supervisor | 1 | `crm.read`, `clients.read` | No change (alias) |
| Sales | 0 | (`crm.read`,`clients.read` when created) | No change |
| Accounts | 0 | (`clients.read` when created) | No change |
| Vendor | 0 | none | Would be denied (no current users; correct for future) |
| Client | 0 | none | Would be denied (no current users; correct for future) |

**Net:** **0 current users lose any access.** MD (1 user) gains the read it needs. Vendor/Client denial is forward-looking (no such users exist yet).

### 2.5 Validation plan
1. **Backup** every `Role.permissions` to a dated collection before the MD/grants change.
2. **Unit:** `aliasesFor('crm.lead.read')` → `[clients.read, crm.read]`; alias-aware `requirePermission` passes for a `clients.read`-only user, for a `crm.read`-only user, and for `*`; **regression:** a non-aliased permission (e.g. `tasks.approve`) behaves exactly as before.
3. **Route (integration):** for each guarded GET, simulate each role → expect **200** for admin/md/manager/designer/supervisor (+ sales/accounts when present), **403** for synthetic vendor/client tokens.
4. **Manual smoke (the real risks):**
   - Log in as **MD** → open **Create Project → client picker loads** (the dependency that drove this).
   - Log in as **Designer** → dashboard + any project client reads still load (via `clients.read`).
   - Log in as **Manager** → CRM list, meetings, follow-ups all load.
5. **Re-run** Phase-1 QA harness + `checkRoles.js` → confirm role permission counts grew only by the approved grants; no count shrank.
6. **3-day 403 watch** (Stage 3) before any write enforcement is even proposed.

### 2.6 Rollback plan
- **Read guards:** delete the `requirePermission('crm.lead.read')` line from each of the 4 route files → instant revert to `verifyToken`-only (today's behavior). One line per route; no data restore.
- **Alias-aware middleware:** additive and backward-compatible; can remain or be reverted independently without breaking any route.
- **Grants:** additive strings; remove from seed + re-run (or pull from role docs). Dated backup available.
- **No migrations, no `deniedPermissions`, no inheritance, no alias removal** anywhere in Stage 2 — every step is independently and trivially reversible.

---

## Awaiting
Final approval to implement **Part 2 (Stage 2 reads + Decision 1 & 2 grants)**, and your word on whether to apply the **Part 1 AI grants** in the same change or separately. No code will be modified until you approve.
