# AI Permission Change Proposal (Analysis Only — not applied)

> Standalone follow-up to Phase 2 Stage 2. **No AI grants applied.** Provides the access matrix and feature inventory for review before any change.
> **Live user base:** admin 1 · md 1 · manager 1 · supervisor 1 · designer 6 · sales 0 · accounts 0 · vendor 0 · client 0 (10 active).
> **Gate:** AI is also behind the `VITE_ENABLE_AI` frontend flag + an `ai.chat` check in `AppLayout` — granting permissions does not expose AI unless the flag is on.

---

## 1. AI Feature Inventory → protecting permission

Source: `backend/src/modules/ai/routes/ai.route.js`.

| Feature | Endpoints | Protected by |
|---|---|---|
| **AI Chat** | `POST /chat` (SSE), `GET/POST/DELETE /conversations*`, `POST /feedback` | `ai.chat` |
| **MOM Polish** | `POST /polish-text` (the "AI" polish button on Record-MOM summary) | `ai.chat` |
| **AI Actions** (write-tool confirm/cancel) | `POST /actions/:toolCallId/confirm`, `/cancel` | `ai.chat` *(underlying tool permission re-checked inside the executor)* |
| **User Facts** (long-term memory) | `GET/POST/DELETE /user-facts*` | `ai.chat` |
| **Document Knowledge Base — read** | `GET /documents`, `/documents/:id`, `/documents/:id/chunks` | `ai.docs.read` |
| **Document Knowledge Base — manage** | `POST/PUT/DELETE /documents`, `POST /documents/:id/reembed` | `ai.docs.manage` |
| **Admin Metrics / Ops** | `GET /health`, `GET /admin/metrics`, `POST /admin/summarize-facts` | `ai.admin` |

So: `ai.chat` gates **all interactive AI** (chat, polish, actions, user-facts); `ai.docs.read`/`ai.docs.manage` gate the **knowledge base**; `ai.admin` gates **ops/metrics**.

---

## 2. AI Access Matrix

Current behavior: **no role holds any `ai.*` explicitly** — only `admin` (via `*`). So today AI is effectively admin-only (and further gated by the env flag).

| Role | ai.chat | ai.docs.read | ai.docs.manage | ai.admin |
|---|:--:|:--:|:--:|:--:|
| Admin | ✓ (via `*`) | ✓ | ✓ | ✓ |
| Managing Director | **+grant** | **+grant** | ✗ | ✗ |
| Manager | **+grant** | **+grant** | **+grant** | ✗ |
| Sales Executive | **+grant** | **+grant** | ✗ | ✗ |
| Designer | **+grant** | **+grant** | ✗ | ✗ |
| Supervisor | **+grant** | **+grant** | ✗ | ✗ |
| Accounts | **+grant** | **+grant** | ✗ | ✗ |
| Vendor | ✗ | ✗ | ✗ | ✗ |
| Client | ✗ | ✗ | ✗ | ✗ |

### Per-permission detail

| Permission | Current behavior | Recommended behavior | Users affected (current) | Usage impact | Cost impact |
|---|---|---|---|---|---|
| **ai.chat** | Admin-only | All 6 internal roles | **9** (md 1, mgr 1, sup 1, designer 6) | Staff can chat, polish MOM text, run AI actions, store user facts | **Primary cost driver** — LLM tokens per message; **bounded by `aiRateLimit` middleware** |
| **ai.docs.read** | Admin-only | All 6 internal roles | **9** | Assistant can cite internal KB docs for these users | Negligible (DB reads; retrieval already runs in chat) |
| **ai.docs.manage** | Admin-only | Manager (+admin) | **2** (mgr 1, admin 1) | Manager curates the KB | Modest, infrequent — embeddings API per doc on upload/edit/reembed |
| **ai.admin** | Admin-only | Admin only | **1** | Ops metrics, health, fact-summarizer | Negligible; `summarize-facts` is an admin-triggered LLM job |

---

## 3. Rollout recommendation (when approved)
- Apply as a **standalone change** (separate from Stage 2) — smaller blast radius, clean audit trail, independent rollback.
- Mechanism: add the strings to `seedRoles.js` for the listed roles + re-run (additive; all `ai.*` already valid registry leaves from Phase 1). No middleware/route changes needed (AI routes already enforce `ai.*`).
- Keep `VITE_ENABLE_AI` as the master exposure switch during rollout.
- Rollback: remove the `ai.*` strings from the affected roles + re-run; additive, no migration.

## 4. Risks
- **Cost:** `ai.chat` to 9 users raises potential LLM spend proportional to usage — mitigated by the existing rate limiter; recommend confirming the rate-limit ceiling before broad enablement.
- **KB integrity:** `ai.docs.manage` shapes AI answers org-wide — correctly limited to Manager/Admin.
- No external role (vendor/client) receives any AI access.

**No grants applied. Awaiting approval to proceed as a standalone AI change.**
