# RBAC Phase 2 — Stage 3 Monitoring & Validation (No code changes)

> Observation phase after Stage 2 CRM read enforcement. No Stage 4, no alias removal, no new permissions.

## 1. What is actually enforced (recap)
All ~16 guarded CRM read endpoints share a **single** permission: `crm.lead.read`, with alias `[clients.read, crm.read]`. Because the guard is identical across every endpoint, **per-endpoint behavior == per-role behavior** — there is no endpoint-specific variation to monitor; only role-level outcomes matter.

## 2. Proactive validation (already provable statically)
Since every guarded route uses the same alias-aware check, the Stage-2 resolution harness result covers **all** endpoints for **all** roles:

| Target role | Resolves `crm.lead.read` | Via | All CRM read endpoints |
|---|---|---|---|
| Managing Director | ALLOW | direct grant | 200 |
| Manager | ALLOW | alias `clients.read` | 200 |
| Sales Executive | ALLOW | alias `clients.read` | 200 |
| Designer | ALLOW | alias `clients.read` | 200 |
| Supervisor | ALLOW | alias `clients.read` | 200 |
| Accounts | ALLOW | alias `clients.read` | 200 |
| Vendor / Client | DENY | — | 403 (intended) |

**Conclusion:** no internal target role can experience an access failure on any guarded read endpoint — the authorization layer is proven. The only things that require *live* observation are runtime behaviors the static check can't see (data-shape errors, a missed consumer calling an endpoint with an unexpected token, UI widgets that render differently).

## 3. What to watch (live)
| Signal | How | Expected |
|---|---|---|
| **403s on `/leads`,`/clients`,`/metting`,`/followup`** | server logs | Only from vendor/client tokens (none exist yet) or an unauthenticated/expired token |
| **MD project creation** | manual: MD → Create Project → client picker | Loads (uses `/clients/get`) |
| **Dashboards** (Designer/Supervisor/Accounts) | manual logins | Load; CRM widgets populate via `clients.read` alias |
| **Proposal / Meeting / Follow-up flows** | manual: Manager/Sales | All reads succeed |

## 4. Optional instrumentation (proposed, NOT applied)
A minimal, additive denial log in `requirePermission` would make 403s observable without external tooling:
```js
// inside requirePermission, on the deny branch (illustrative — not applied):
console.warn(`[authz] 403 ${req.method} ${req.originalUrl} role=${req.user?.role} perm=${permission}`);
```
This is read-only logging (no behavior change). Say the word and I'll add it as a tiny separate change for the monitoring window, then remove it after.

## 5. Validation sign-off checklist (for you, over the observation window)
- [ ] No unexpected 403s for MD / Manager / Sales / Designer / Supervisor / Accounts
- [ ] MD client picker works
- [ ] All role dashboards load
- [ ] Proposal / Meeting / Follow-up reads work
- [ ] Vendor/Client correctly blocked (when such users exist)

Once this is clean, the approved next priorities are **analysis-only**: AI rollout → granular design review → CRM write-enforcement planning.
