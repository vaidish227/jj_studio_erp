# AI Assistant — Development Log

| | |
|---|---|
| **Names** | Vaidish and Adarsh |
| **Date** | 2026-05-26 |
| **Working duration** | Full-day session — Phase 1 (V1), Phase 2 (V2), Phase 2.1 hardening, Phase 3.1 (write tools) |
| **Scope** | New `ai` module on both backend and frontend, additive only — zero changes to existing CRM/PMS/Mail/WhatsApp routes or behavior |
| **Branch** | `ADA_26MAY_AI` |

---

## 1. Overview of the Day

Built a production-grade ChatGPT/Copilot-style AI assistant inside the JJ Studio ERP, in four shipping waves:

- **V1 (Phase 1)** — Foundation: streaming chat, intent + tool-calling, conversation memory, RBAC, audit, full UI.
- **V2 (Phase 2)** — Knowledge: RAG over an internal SOP corpus with Atlas Vector Search, citations, long-term user-facts memory, nightly summarizer.
- **V2.1** — Polish: bug fixes surfaced by real chat transcripts (silent failures, wrong scoping defaults, missing diagnostics) + 4 new read tools (Leads, Clients, Project Search, Activity Search) + UX upgrades.
- **V3.1** — Write capability: 5 confirmation-gated write tools that mutate tasks. Two-phase propose → confirm flow with a 5-minute proposal TTL.

**Main outcome:** the assistant moved from "no AI at all" → "world-class enterprise AI copilot": multi-tool, RAG-grounded, permission-aware, audit-logged, and now able to *do* work, not just answer questions.

---

## 2. Tasks Performed (Chronological)

### Phase 1 — V1 MVP (foundation)

1. **Deep exploration** of the existing codebase (3 parallel Explore agents): backend stack, frontend stack, RBAC, domain models. Confirmed Node + Express 5 + MongoDB Atlas + React 19 + Vite + Tailwind. No existing AI/LLM code.
2. **Clarifying decisions with the user**: OpenAI only, MongoDB Atlas Vector Search, SSE streaming, phased rollout.
3. **Architecture planning** — saved a comprehensive plan at `C:\Users\SoftTech\.claude\plans\you-are-a-senior-stateful-treasure.md`.
4. **Scaffolded `backend/src/modules/ai/`** — models, services, controllers, routes, tools, prompts, middleware, utils, validators, config, docs.
5. **Added 4 new permissions** (`ai.chat`, `ai.admin`, `ai.docs.read`, `ai.docs.manage`) to `Role.model.js`.
6. **Added env vars** to `backend/.env` (OpenAI key, model selection, limits) and backend deps (`openai`, `gpt-tokenizer`, `ajv`, `ajv-formats`).
7. **Built core services**: `openai.service` (SDK wrapper + streaming), `stream.service` (SSE), `cost.service` (token → USD pricing).
8. **Built 6 V1 read tools**: `getMyTasks`, `getTaskDetails`, `getOverdueTasks`, `getChecklist`, `getProjectSummary`, `getDesignerDashboard` — all hard-scoped by `ctx.userId`.
9. **Built `tools.registry` + `tools.executor`** — permission check, ajv validation, sanitization, timeout, audit log.
10. **Built `memory.service`** — load short-term history, fit into token budget, preserve tool_call pairs.
11. **Built `promptBuilder.service` + `systemPrompt.js`** — assembles OpenAI message array, model picker heuristic (gpt-4o-mini vs gpt-4o).
12. **Built `orchestrator.service`** — the main streaming + tool-call loop.
13. **Built middleware** — `aiRateLimit` (in-memory, 20/min/user), `aiAudit` (request-id stamping).
14. **Built controllers** — `ai.controller` (streamChat + health), `conversation.controller` (CRUD + feedback), `admin.controller` (metrics).
15. **Mounted route at `/api/ai`** in `app.js`.
16. **Created `seed-ai-permissions.js`** — one-shot grant of AI permissions to all roles.
17. **Scaffolded `frontend/src/modules/ai/`** — services, context, components.
18. **Added frontend deps** — `react-markdown`, `remark-gfm`.
19. **Built `aiService.js`** — fetch + ReadableStream SSE parser (deliberately NOT `EventSource` because it can't send `Authorization` header).
20. **Built `AIChatContext`** — open/close, messages, streaming, send/stop, conversation loading.
21. **Built UI components** — `ChatLauncher` (FAB), `ChatPanel` (drawer), `MessageList`, `MessageBubble`, `MarkdownRenderer`, `ToolMessage`, `TaskCard`/`ProjectCard`/`DashboardCard`/`ChecklistCard`, `InputBox`, `FeedbackButtons`, `ConversationSidebar`.
22. **Mounted launcher** in `AppLayout.jsx` permission-gated.
23. **Wrote V1 docs**: `AI_SETUP.md`, `AI_ARCHITECTURE.md`, `AI_SECURITY.md`, `AI_PROMPTS.md`.
24. **Ran `npm install`** to pick up new backend + frontend deps.

### Phase 2 — V2 RAG + Memory

25. **Verified Atlas tier (M10+)** + chose "scaffold-first / ingest-later" path.
26. **Built 3 new models**: `AIDocument`, `AIDocumentChunk` (1536-d embedding + scope metadata), `AIUserFact`.
27. **Extended `AIMessage`** with `citations[]` (n, documentId, chunkId, title, source, excerpt, score).
28. **Built `embedding.service`** — batched `text-embedding-3-small` calls + cosine helper.
29. **Built `ingestion.service`** — markdown-aware chunker (split on headings, ~500 tokens, 60 overlap), idempotent by content hash, persists chunks with denormalized scope metadata.
30. **Built `rag.service`** — `$vectorSearch` with permission filter; auto-falls-back to `$text` + in-process cosine if vector search is unavailable or returns < k.
31. **Built `userFacts.service`** — short-term/long-term memory; nightly summarizer that distils facts from conversations.
32. **Updated `systemPrompt`** to include "Knowledge base" and "Known user facts" sections.
33. **Updated `promptBuilder` + `orchestrator`** — parallel retrieve + load facts + load history; emit `citations` SSE event; persist citations on assistant message.
34. **Rebalanced token budget** — history 4000 → 2500 tokens, opened 3500 for RAG chunks, 500 for user facts.
35. **Built `documents.controller`** — admin CRUD for the knowledge base.
36. **Built `userFacts.controller`** — list/add/remove per user; admin trigger for summarizer.
37. **Extended `ai.route.js`** with `/documents`, `/user-facts`, and `/admin/summarize-facts`.
38. **Built `setup-vector-index.js`** — creates `ai_vector_idx` via Atlas `createSearchIndex`.
39. **Built `seed-ai-documents.js`** — 5 starter SOP docs (Task Lifecycle, Client Approvals Checklist, Designer Workflow, Drawing Release, AI Capabilities).
40. **Built `userFactsSummarizer.js`** cron — daily at 03:15.
41. **Wired cron + vector-index startup banner** in `backend/src/index.js`.
42. **Built `SourcesPanel.jsx`** + updated `MessageBubble.jsx` to render citations.
43. **Wrote V2 docs**: `AI_RAG.md`, `AI_MEMORY.md`.

### Phase 2.1 — Polish (based on real chat transcripts)

44. **Diagnosed user's chat transcript** — identified RAG was silently not running, model was hallucinating permission denials, empty results were bare text.
45. **Orchestrator: always emit `citations` event** even with 0 hits, plus `ragRan` + `ragHits` flag in `done`. Lets the UI tell "RAG ran, no sources" from "RAG not run".
46. **Built `vectorIndex.service`** — startup banner + `/health` endpoint reports `{status: ready|building|missing|unsupported}`.
47. **Extended `/api/ai/health`** to return OpenAI status, vector index status, document count, model config.
48. **Strengthened system prompt** — when KB chunks are retrieved, model MUST cite [n]; "no tool for that" rule prevents fake permission denials.
49. **Built clickable `[n]` citation markers** — `MarkdownRenderer` transforms `[1]` into a chip that scrolls/highlights the matching SourcesPanel entry via `forwardRef`.
50. **Built `RagStatusPill`** — small pill below assistant messages showing "0 KB sources matched" or "knowledge base not searched".
51. **Tool chips with friendly names + icons** — "My tasks" / "Project search" / "Recent activity" instead of bare "Tool".
52. **Empty-state cards** for every `uiHint` with contextual messaging.
53. **Fixed silent `PMSActivityLog` failure** — removed buggy `entityType: 'ai_query'` write that was failing the required-field validation. `AIToolCall` is the authoritative audit surface.
54. **Built 4 new read tools**: `getLeads`, `getClients`, `searchProjects`, `searchActivity`.
55. **Built 3 new frontend cards**: `LeadCard`, `ProjectListCard`, `ActivityCard`.
56. **Date-grouped conversation sidebar** — Today / Yesterday / This week / This month / Older with sticky headers.

### Phase 2.1.1 — Live verification + bug fixes

57. **Diagnosed via live DB queries**: 0 docs ingested, only `admin` had any AI perms, leads exist in `CRMClient` (not `Lead`), leads have no `assignedTo`.
58. **Auto-widen scope** on `getLeads`, `getClients`, `searchActivity`, `searchProjects`, `getOverdueTasks`: if caller holds `crm.read`/`activity.read`/`projects.read`/`*`, default scope to `team`/`all` instead of `me`. Fixes "I'm admin but see 0 leads".
59. **Fixed `String(undefined)` ObjectId crash** in 4 tools — `.filter(Boolean)` doesn't drop `"undefined"`. Replaced with `.filter(x => x.foo).map(x => String(x.foo))`.
60. **Ran setup scripts live**:
    - `seed-ai-permissions --with-admin` → 9 roles updated, 2 admin
    - `seed-ai-documents` → 5 docs, 15 chunks ingested
    - `setup-vector-index` → Atlas building `ai_vector_idx` (cosine, 1536d)
61. **Verified end-to-end**: RAG retrieval for "client approval checklist" → 5 hits, top result *Client Approvals Checklist* at score 0.74. `getLeads` returns the 2 leads correctly.

### Phase 3.1 — Write tools

62. **Decided "always confirm"** UX with user.
63. **Extended `AIToolCall` schema** — added `pending_confirmation`/`cancelled`/`confirmed_ok`/`confirmed_error` statuses + `isWrite`, `proposalDescription`, `confirmedAt`, `cancelledAt`, `pendingExpiresAt` fields.
64. **Refactored `tools.executor.js`** to two-phase: read tools as before; write tools call `dryRun()` only on first invocation, persist a pending proposal, return a `pending_confirmation` result.
65. **Added `confirmAction()` + `cancelAction()`** — re-validate permission/expiry, run `tool.apply()`, update audit row.
66. **Built 5 write tools** following the new `{name, permission, isWrite:true, dryRun, apply}` contract:
    - `updateTaskStatus` — full transition matrix from Task.controller
    - `toggleChecklistItem` — embedded checklist item
    - `reassignTask` — supports id OR name fragment (refuses ambiguous matches)
    - `requestTaskRevision` — only valid from `pending_review`/`pending_client_approval`/`approved`
    - `addTaskNote` — timestamped append to `notes`
67. **Built `actions.controller`** + 2 routes — `POST /actions/:toolCallId/confirm` + `POST /actions/:toolCallId/cancel`.
68. **Updated `orchestrator`** to propagate proposal fields (`status`, `toolCallId`, `proposalDescription`, `expiresAt`) on the `tool_result` SSE event, and tells the LLM the action is pending.
69. **Updated system prompt** — explicit instructions for write tools: "After proposing a write, say 'Proposed:...' — do NOT say 'Done'".
70. **Built `ActionConfirmCard.jsx`** — amber proposal card with live countdown, Confirm/Cancel buttons, transitions through `pending → confirming → done`/`cancelled`/`expired`/`error`.
71. **Updated `ToolMessage.jsx`** to render the ConfirmCard when `uiHint === 'actionProposal'`.
72. **Updated `AIChatContext`** to capture proposal fields on the `tool_result` event.
73. **Live tested `updateTaskStatus.dryRun`** — valid transition ✓, invalid transition rejected with allowed list ✓, not-found rejected ✓.
74. **Wrote V3 docs**: `AI_WRITE_TOOLS.md`.

---

## 3. Files Created / Modified

### 3.1 Backend — `backend/src/modules/ai/` (all NEW)

**Models** (`backend/src/modules/ai/models/`):

| File | Purpose | Key fields |
|---|---|---|
| `AIConversation.model.js` | Conversation header | userId, title, status, totalTokens, totalCostUsd, lastMessageAt |
| `AIMessage.model.js` | Role-tagged turn | role, content, toolCalls, toolCallId, uiPayload, uiHint, **citations[]** (V2) |
| `AIToolCall.model.js` | Per-tool audit | toolName, args, status, latencyMs, **+ V3 write fields**: isWrite, proposalDescription, pendingExpiresAt, confirmedAt, cancelledAt |
| `AIMetric.model.js` | Per-request metrics | requestId, model, promptTokens, completionTokens, costUsd, latencyMs, toolCount |
| `AIFeedback.model.js` | Thumb up/down | messageId, userId, rating (-1/1), reason |
| `AIDocument.model.js` (V2) | KB document header | title, source, sourceType, **ownerScope: {type, value}**, chunkCount, contentHash, status |
| `AIDocumentChunk.model.js` (V2) | Embeddable chunk | documentId, chunkIndex, text, **embedding: [Number](1536)**, metadata (denormalized scope) |
| `AIUserFact.model.js` (V2) | Long-term memory | userId, fact, source (explicit/summarized), confidence, expiresAt TTL |

**Services** (`backend/src/modules/ai/services/`):

| File | Purpose |
|---|---|
| `openai.service.js` | Thin OpenAI SDK wrapper — streamChat, chatComplete, embed, ping |
| `stream.service.js` | SSE helpers — `openSseChannel(res)` returns `{emit, close, isClosed, onAbort}` |
| `orchestrator.service.js` | Main loop — load history + RAG + facts → stream → tool loop → persist |
| `tools.registry.js` | Single source of truth for tools, filters by user perms, exports OpenAI schema |
| `tools.executor.js` | Permission check + ajv validation + timeout + sanitize + audit. **V3**: two-phase write flow with `confirmAction`/`cancelAction` |
| `memory.service.js` | Load chronological history, fit to token budget, preserve tool_call pairs |
| `promptBuilder.service.js` | Build message array, pick model (mini vs full) |
| `cost.service.js` | Token → USD via pricing table |
| `embedding.service.js` (V2) | Batched embeddings + cosine similarity |
| `ingestion.service.js` (V2) | Markdown-aware chunker + embed + persist (idempotent) |
| `rag.service.js` (V2) | `$vectorSearch` with scope filter + keyword fallback |
| `userFacts.service.js` (V2) | Load facts + explicit add/remove + LLM summarizer |
| `vectorIndex.service.js` (V2.1) | Probe Atlas index status — used by /health + startup banner |

**Tools** — `backend/src/modules/ai/tools/`:

| File | Type | Permission | Purpose |
|---|---|---|---|
| `getMyTasks.tool.js` | read | tasks.read | My tasks by status/priority |
| `getTaskDetails.tool.js` | read | tasks.read | Full task detail with checklist + project + assignee |
| `getOverdueTasks.tool.js` | read | tasks.read | Overdue with auto-widen scope (V2.1) |
| `getChecklist.tool.js` | read | tasks.read | Embedded checklist + % done |
| `getProjectSummary.tool.js` | read | projects.read | Status, team, tasks-by-status, approvals |
| `getDesignerDashboard.tool.js` | read | tasks.read | Personal dashboard rollup |
| `getLeads.tool.js` (V2.1) | read | crm.read | CRM funnel leads with auto-widen scope |
| `getClients.tool.js` (V2.1) | read | clients.read | Converted clients with auto-widen scope |
| `searchProjects.tool.js` (V2.1) | read | tasks.read (own) / projects.read (all) | Free-text search |
| `searchActivity.tool.js` (V2.1) | read | activity.read | PMSActivityLog audit reader |
| `updateTaskStatus.tool.js` (V3.1) | **write** | tasks.update / tasks.approve | Status transition with lifecycle validation |
| `toggleChecklistItem.tool.js` (V3.1) | **write** | tasks.update | Tick/untick a checklist item |
| `reassignTask.tool.js` (V3.1) | **write** | tasks.reassign | Reassign by id or unique name match |
| `requestTaskRevision.tool.js` (V3.1) | **write** | tasks.approve | Send back to designer with instructions/deadline |
| `addTaskNote.tool.js` (V3.1) | **write** | tasks.update | Append timestamped note |

**Controllers** (`backend/src/modules/ai/controllers/`):

| File | Endpoints handled |
|---|---|
| `ai.controller.js` | `POST /chat` (SSE), `GET /health` |
| `conversation.controller.js` | List/get/rename/delete + feedback |
| `admin.controller.js` | `/admin/metrics` (daily/by-model/by-tool rollup) |
| `documents.controller.js` (V2) | KB CRUD + `/documents/:id/reembed` + `/chunks` |
| `userFacts.controller.js` (V2) | Per-user CRUD + admin summarizer trigger |
| `actions.controller.js` (V3.1) | `POST /actions/:toolCallId/confirm` + `/cancel` |

**Routes**: `routes/ai.route.js` — single router mounted at `/api/ai`.

**Middleware** (`backend/src/modules/ai/middleware/`):

| File | Purpose |
|---|---|
| `aiRateLimit.middleware.js` | In-memory `Map<userId, {count, windowStart}>` — 20/min/user, no Redis |
| `aiAudit.middleware.js` | Stamps `req.aiAudit = {requestId, startTs}` |

**Validators**: `validators/chat.validator.js` — Joi schemas for chat, feedback, rename.

**Prompts** (`backend/src/modules/ai/prompts/`):

| File | Purpose |
|---|---|
| `systemPrompt.js` | Builds system prompt; injects user context, KB chunks, user facts, write-tool rules |
| `fewShot.js` | Empty in V1; reserved for V3 prompt tuning |
| `toolDescriptions.js` | Reserved for V3 (small-model adaptation) |

**Cron**: `cron/userFactsSummarizer.js` — nightly at 03:15.

**Config**: `config/aiConfig.js` — frozen env-driven config + OpenAI pricing table.

**Utils** (`backend/src/modules/ai/utils/`):

| File | Purpose |
|---|---|
| `tokenizer.js` | `gpt-tokenizer` wrapper + `fitHistoryToBudget()` |
| `sanitize.js` | Cap strings, strip `$`-operators, drop `__proto__`, `previewForAudit()` |
| `loadPermissions.js` | Mirrors `auth.middleware`'s logic for non-request contexts |

**Docs** (`backend/src/modules/ai/docs/`):

| File | Topic |
|---|---|
| `AI_SETUP.md` | Operator runbook — install, env, seed, smoke test |
| `AI_ARCHITECTURE.md` | Request flow, file map, streaming protocol, token budget |
| `AI_SECURITY.md` | 4-layer authz, prompt injection defense, audit |
| `AI_PROMPTS.md` | System-prompt design + iteration log |
| `AI_RAG.md` (V2) | Atlas index, ingestion, retrieval, citations |
| `AI_MEMORY.md` (V2) | Short-term + long-term memory model |
| `AI_WRITE_TOOLS.md` (V3) | Safety model, tool catalog, how to add a new write tool |

### 3.2 Backend scripts — `backend/scripts/` (all NEW)

| File | Purpose |
|---|---|
| `seed-ai-permissions.js` | One-shot — grants `ai.chat` + `ai.docs.read` to non-system roles; `--with-admin` adds `ai.admin` + `ai.docs.manage` |
| `seed-ai-documents.js` | Ingests 5 starter SOPs; `--reset` archives + re-ingests |
| `setup-vector-index.js` | Creates `ai_vector_idx` (1536d cosine + scope filters) via Atlas `createSearchIndex` |

### 3.3 Backend — MODIFIED (additive only)

| File | Change |
|---|---|
| `backend/src/app.js` | Mount `app.use('/api/ai', aiRoutes)` after PMS block |
| `backend/src/index.js` | Start `userFactsSummarizer` cron + vector-index startup banner |
| `backend/src/modules/auth/models/Role.model.js` | Appended 4 AI permissions to `ALL_PERMISSIONS` |
| `backend/.env` | Added OPENAI_API_KEY + AI_MODEL_*, AI_*_LIMIT, AI_PII_HASH_MODE |
| `backend/package.json` | Added `openai`, `gpt-tokenizer`, `ajv`, `ajv-formats` |

### 3.4 Frontend — `frontend/src/modules/ai/` (all NEW)

**Context** — `context/AIChatContext.jsx` — open/close, messages, streaming, send/stop, conversations, citations + RAG state.

**Services** (`services/`):

| File | Purpose |
|---|---|
| `aiService.js` | `streamChat({message, conversationId, onEvent, onToken, onDone, onError})` — fetch + ReadableStream SSE parser |
| `conversationsService.js` | Axios wrapper for CRUD + feedback |

**Components** (`components/`):

| File | Type | Purpose |
|---|---|---|
| `ChatLauncher.jsx` | Page-level | FAB; mounts ChatPanel; ESC to close |
| `ChatPanel.jsx` | Page-level | Right drawer; sidebar + chat area |
| `ConversationSidebar.jsx` | Page-level | Date-grouped past conversations (V2.1) |
| `MessageList.jsx` | Page-level | Virtualized scroller + empty-state starters |
| `MessageBubble.jsx` | Reusable | Role-styled bubble; renders markdown for assistant; mounts SourcesPanel + RagStatusPill + FeedbackButtons |
| `MarkdownRenderer.jsx` | Reusable | `react-markdown` + GFM, **transforms `[n]` to clickable chips** (V2.1) |
| `ToolMessage.jsx` | Reusable | Renders tool call lifecycle (pending/ok/error/proposal) + dispatches to result card by `uiHint` |
| `TaskCard.jsx` | Reusable | Clickable list of tasks; status badge, priority flag, due date |
| `ProjectCard.jsx` | Reusable | Single project summary; team, tasks, approvals |
| `DashboardCard.jsx` | Reusable | 3-stat grid + status counts + upcoming list |
| `ChecklistCard.jsx` | Reusable | Progress bar + line-by-line items |
| `LeadCard.jsx` (V2.1) | Reusable | Lead list with status badge + phone/city/budget |
| `ProjectListCard.jsx` (V2.1) | Reusable | Project search results |
| `ActivityCard.jsx` (V2.1) | Reusable | Audit log timeline |
| `InputBox.jsx` | Page-level | Auto-grow textarea + send/stop button + char counter |
| `FeedbackButtons.jsx` | Reusable | Thumb up/down per assistant message |
| `SourcesPanel.jsx` (V2) | Reusable | Collapsible citation list; `forwardRef` exposes `highlight(n)` for inline marker scroll |
| `RagStatusPill.jsx` (V2.1) | Reusable | "0 KB sources matched" or "knowledge base not searched" indicator |
| `ActionConfirmCard.jsx` (V3.1) | Reusable | Amber Confirm/Cancel card with 5-min countdown for write proposals |

### 3.5 Frontend — MODIFIED (additive)

| File | Change |
|---|---|
| `frontend/src/shared/layouts/AppLayout/AppLayout.jsx` | Mount `<AIChatProvider><ChatLauncher /></AIChatProvider>` gated on `hasPermission('ai.chat')` |
| `frontend/package.json` | Added `react-markdown` + `remark-gfm` |

### 3.6 Plan & log files (top-level)

| File | Purpose |
|---|---|
| `C:\Users\SoftTech\.claude\plans\you-are-a-senior-stateful-treasure.md` | Approved architecture plan from start of session |
| `docs/AI_DEVELOPMENT_LOG_2026-05-26.md` | This document |

---

## 4. File Relationships & Data Flow

### 4.1 Backend dependency graph (simplified)

```
backend/src/app.js
   └─ requires `./modules/ai/routes/ai.route`
        ├─ requires `../middleware/auth.middleware`  (existing — verifyToken/requirePermission)
        ├─ requires `../middleware/aiRateLimit.middleware`
        ├─ requires `../middleware/aiAudit.middleware`
        ├─ requires `../controllers/ai.controller`
        │      ├─ requires `../services/stream.service`     (SSE helpers)
        │      ├─ requires `../services/orchestrator.service`
        │      │      ├─ requires `./openai.service`        (OpenAI SDK wrapper)
        │      │      ├─ requires `./tools.registry`
        │      │      │      └─ requires `../tools/*.tool.js` (15 tools)
        │      │      ├─ requires `./tools.executor`
        │      │      │      ├─ requires `./tools.registry`
        │      │      │      └─ requires `../models/AIToolCall.model`
        │      │      ├─ requires `./memory.service`
        │      │      │      ├─ requires `../models/AIConversation.model`
        │      │      │      └─ requires `../models/AIMessage.model`
        │      │      ├─ requires `./rag.service`            (V2)
        │      │      │      ├─ requires `./embedding.service`
        │      │      │      └─ requires `../models/AIDocumentChunk.model`
        │      │      ├─ requires `./userFacts.service`      (V2)
        │      │      │      └─ requires `../models/AIUserFact.model`
        │      │      ├─ requires `./promptBuilder.service`
        │      │      │      └─ requires `../prompts/systemPrompt`
        │      │      ├─ requires `./cost.service`
        │      │      └─ requires `../models/AIMetric.model`
        │      └─ requires `../services/vectorIndex.service` (health probe)
        ├─ requires `../controllers/conversation.controller`
        ├─ requires `../controllers/admin.controller`
        ├─ requires `../controllers/documents.controller`   (V2)
        │      └─ requires `../services/ingestion.service`
        ├─ requires `../controllers/userFacts.controller`   (V2)
        └─ requires `../controllers/actions.controller`     (V3)
               └─ requires `../services/tools.executor`     (confirmAction/cancelAction)

backend/src/index.js
   └─ requires `./modules/ai/cron/userFactsSummarizer`     (V2 nightly)
   └─ requires `./modules/ai/services/vectorIndex.service` (startup banner)
```

### 4.2 Request flow (one chat turn)

```
React user submits text
  → aiService.streamChat() fires POST /api/ai/chat with Bearer token
    → Express
      → verifyToken (global middleware) → req.user = {id, email, role}
      → requirePermission('ai.chat') → req.permissions = role + custom
      → aiRateLimit → 429 if over budget
      → aiAudit → req.aiAudit = {requestId, startTs}
      → ai.controller.streamChat
        → stream.service.openSseChannel(res) → returns {emit, close}
        → orchestrator.service.run({user, message, conversationId, sse})
          1. memory.getOrCreateConversation()
          2. emit('meta', {conversationId})
          3. persist user AIMessage
          4. Promise.all([rag.retrieve, userFacts.loadFactsForUser, memory.loadHistory])
          5. emit('citations', {ragRan, ragHits, citations[]})  ← always, even []
          6. promptBuilder.buildMessages(sys, history, retrieved, facts, user msg)
          7. tools.registry.openaiSchema(user.permissions) → filter by permissions
          8. openai.streamChat({model, messages, tools, stream:true})
          9. for await chunk:
               delta.content → emit('token', {delta})
               delta.tool_calls → accumulate
               finish_reason='tool_calls':
                 for each call:
                   tools.executor.run(name, args, ctx)
                     ├─ READ: handler → sanitize → audit → return data
                     └─ WRITE: tool.dryRun() → save pending AIToolCall →
                                return {status: 'pending_confirmation', toolCallId}
                   emit('tool_result', {...result, +write fields if proposal})
                   feed compact JSON back as 'role: tool' message
                 loop
               finish_reason='stop' → break
          10. persist citations on final assistant AIMessage
          11. memory.bumpConversation()
          12. AIMetric.create()
          13. emit('done', {conversationId, messageId, tokens, costUsd, ragRan, ragHits})
          14. sse.close()
```

### 4.3 Write-tool confirm flow (out-of-band)

```
ActionConfirmCard.onConfirm
  → POST /api/ai/actions/:toolCallId/confirm
    → verifyToken + requirePermission('ai.chat')
    → actions.controller.confirm
      → executor.confirmAction({toolCallId, ctx})
        ├─ AIToolCall.findById → must exist, isWrite, status='pending_confirmation'
        ├─ userId match
        ├─ pendingExpiresAt > now
        ├─ ctx.permissions still includes tool.permission
        ├─ tool.apply(args, ctx)
        │    └─ Task.updateOne + logActivity({entityType:'task', viaAI:true})
        └─ AIToolCall.status = 'confirmed_ok' + confirmedAt + resultPreview
      ← JSON response → card switches to 'done' state
```

### 4.4 Frontend data flow

```
AuthContext (existing)
  ↓ user, permissions, hasPermission
AppLayout.jsx (mounts permission-gated)
  ↓
AIChatProvider
  ↓ exposes {messages, send, stop, conversationId, conversations, ...}
ChatLauncher (FAB) ─ ChatPanel
                       ├─ ConversationSidebar (groups by Today/Yesterday/…)
                       ├─ MessageList (.map → MessageBubble | ToolMessage)
                       │     MessageBubble
                       │       ├─ MarkdownRenderer (clickable [n] markers)
                       │       ├─ SourcesPanel (forwardRef.highlight(n))
                       │       ├─ RagStatusPill
                       │       └─ FeedbackButtons
                       │     ToolMessage
                       │       ├─ <chip>
                       │       ├─ ActionConfirmCard (if uiHint='actionProposal')
                       │       └─ TaskCard | ProjectCard | DashboardCard |
                       │         ChecklistCard | LeadCard | ProjectListCard | ActivityCard
                       └─ InputBox (Enter to send, Shift+Enter newline, Stop while streaming)
```

`aiService.streamChat` is the single I/O surface for SSE; `conversationsService` for CRUD + actions; both rely on `localStorage.auth_token`.

---

## 5. Components Breakdown

### 5.1 Frontend components

| Name | Type | Purpose | Inputs | Used by |
|---|---|---|---|---|
| `ChatLauncher` | Page-level | FAB + drawer trigger | (none — reads from `useAIChat`) | `AppLayout.jsx` |
| `ChatPanel` | Page-level | Right drawer shell with header + sidebar + chat | (none) | `ChatLauncher` |
| `ConversationSidebar` | Page-level | Past conversations grouped by date | (none — context) | `ChatPanel` |
| `MessageList` | Page-level | Renders all messages + scroll-to-bottom + empty-state starters | (none — context) | `ChatPanel` |
| `MessageBubble` | Reusable | One assistant or user bubble | `message: {id, role, content, status, citations, ragRan, ragHits}` | `MessageList` |
| `ToolMessage` | Reusable | One tool-call lifecycle (pending/ok/error/proposal) | `message: {role, toolName, status, uiHint, summaryText, data, +write fields}` | `MessageList` |
| `MarkdownRenderer` | Reusable | Sanitized markdown with clickable `[n]` chips | `children: string`, `onCitationClick?: (n) => void` | `MessageBubble` |
| `SourcesPanel` | Reusable (forwardRef) | Collapsible citation list, `ref.highlight(n)` scrolls to entry | `citations: Array<{n, title, source, excerpt, sourceUrl}>` | `MessageBubble` |
| `RagStatusPill` | Reusable | "0 KB sources matched" or "knowledge base not searched" | `ragRan, ragHits, hasCitations` | `MessageBubble` |
| `FeedbackButtons` | Reusable | Thumb up/down per assistant message | `messageId: string` | `MessageBubble` |
| `TaskCard` | Reusable | Clickable task list | `items: TaskItem[]`, `mode?: 'list'\|'details'` | `ToolMessage` |
| `ProjectCard` | Reusable | Single-project summary | `project: ProjectSummary` | `ToolMessage` |
| `DashboardCard` | Reusable | Dashboard overview | `dashboard: DashboardData` | `ToolMessage` |
| `ChecklistCard` | Reusable | Checklist with progress bar | `checklist: ChecklistData` | `ToolMessage` |
| `LeadCard` | Reusable | CRM lead list | `items: LeadItem[]` | `ToolMessage` |
| `ProjectListCard` | Reusable | Project search results | `items: ProjectItem[]` | `ToolMessage` |
| `ActivityCard` | Reusable | Audit log timeline | `items: ActivityItem[]` | `ToolMessage` |
| `ActionConfirmCard` | Reusable | Write-proposal Confirm/Cancel with countdown | `message: {toolCallId, proposalDescription, expiresAt}` | `ToolMessage` |
| `InputBox` | Page-level | Composer | (none — context) | `ChatPanel` |

### 5.2 Backend "components" (services + tools)

Each **service** is a stateless module exporting pure functions. Each **tool** is a stateless module exporting `{name, permission, description, parameters, handler}` (read) or `{..., isWrite: true, dryRun, apply}` (write). Composition happens in `orchestrator.service`.

---

## 6. Reusable Components

These are the ones genuinely reusable in future ERP screens, not just inside the AI module:

| Component | Why reusable | Future uses |
|---|---|---|
| `MarkdownRenderer` | Sanitized markdown with safe HTML disabled + GFM tables + clickable citation chips | Render any user-generated rich text (CRM notes, project descriptions, comments). The `onCitationClick` prop is optional so non-AI use cases just pass children. |
| `TaskCard` | Status badge + priority + due date + overdue flag — already matches the existing PMS card pattern | Could replace duplicate task-list rendering in PMS module |
| `LeadCard` / `ProjectListCard` | Compact list-row pattern with status badge + metadata | Any list view (Materials, Vendors, POs, Mail logs) — copy the file, swap the badge map |
| `ActivityCard` | Generic audit-trail row | Wherever PMSActivityLog is shown |
| `ActionConfirmCard` | Two-phase confirm UI with countdown + state machine (pending/confirming/done/error) | Any destructive action UX in the ERP — extract to `shared/components/ConfirmCard` with props instead of `message`. Specifically reusable if you later add bulk operations. |
| `SourcesPanel` | Collapsible numbered list with `forwardRef.highlight(n)` | Any "supporting evidence" or "linked items" UI |
| `RagStatusPill` | Tiny indicator pattern | Useful template for any "this answer is sourced from X" indicators |
| `FeedbackButtons` | Thumbs up/down + API call | Any user-rated content in the ERP |

The backend's reusable units:

- **`sanitize.js`** — capping strings, stripping Mongo operators, dropping prototype-pollution keys. Useful anywhere you receive untrusted JSON.
- **`tokenizer.js#fitHistoryToBudget()`** — preserves tool-call message pairs; generic enough to use for any LLM context-trimming.
- **`stream.service.openSseChannel()`** — works for any SSE endpoint, not just AI.
- **`logActivity` (existing)** — we reused it from `shared/activityLogger.js` for the AI's write-tool audit trail.

---

## 7. APIs / Services / Integrations

### 7.1 Endpoints added under `/api/ai`

| Method | Path | Perm | Body / Query | Returns |
|---|---|---|---|---|
| POST | `/chat` | `ai.chat` | `{message, conversationId?}` | **SSE stream**: `meta`, `token`, `citations`, `tool_call`, `tool_result`, `error`, `done` |
| GET | `/conversations` | `ai.chat` | `?limit&offset` | `{items, total}` — owner-scoped |
| GET | `/conversations/:id` | `ai.chat` | — | `{conversation, messages[]}` |
| POST | `/conversations/:id/rename` | `ai.chat` | `{title}` | `{ok}` |
| DELETE | `/conversations/:id` | `ai.chat` | — | `{ok}` (soft delete) |
| POST | `/feedback` | `ai.chat` | `{messageId, rating: -1\|1, reason?}` | `{ok}` |
| GET | `/user-facts` | `ai.chat` | — | `{facts[]}` — owner-scoped |
| POST | `/user-facts` | `ai.chat` | `{fact}` | `{fact}` |
| DELETE | `/user-facts/:id` | `ai.chat` | — | `{ok}` |
| GET | `/documents` | `ai.docs.read` | `?status&search&limit&offset` | `{items, total}` |
| GET | `/documents/:id` | `ai.docs.read` | — | `{document}` |
| GET | `/documents/:id/chunks` | `ai.docs.read` | — | `{chunks[]}` |
| POST | `/documents` | `ai.docs.manage` | `{title, body, ownerScope, source, sourceType, sourceUrl}` | `{document, chunkCount}` |
| PUT | `/documents/:id` | `ai.docs.manage` | (updates) | `{document}` or full re-ingest |
| DELETE | `/documents/:id` | `ai.docs.manage` | — | `{ok}` |
| POST | `/documents/:id/reembed` | `ai.docs.manage` | — | `{updated}` |
| POST | `/actions/:toolCallId/confirm` | `ai.chat` | — | `{ok, summaryText, data, ...}` (apply result) |
| POST | `/actions/:toolCallId/cancel` | `ai.chat` | — | `{ok, status:'cancelled'}` |
| GET | `/health` | `ai.admin` | — | `{ok, openai, vectorIndex, documents, models}` |
| GET | `/admin/metrics` | `ai.admin` | `?from&to` | rolled-up requests/tokens/cost/latency |
| POST | `/admin/summarize-facts` | `ai.admin` | — | `{totalUsers, totalFacts}` |

### 7.2 External integrations

- **OpenAI**:
  - Chat completions (`gpt-4o-mini` default, `gpt-4o` for long/aggregation queries) with `stream: true` and `stream_options: {include_usage: true}` for billing.
  - Embeddings (`text-embedding-3-small`, 1536 dims) for RAG.
  - JSON mode (`response_format: {type: 'json_object'}`) used in the user-facts summarizer.
- **MongoDB Atlas Vector Search**:
  - Index `ai_vector_idx` on `ai_document_chunks.embedding`, 1536d cosine, with `metadata.ownerScopeType` and `metadata.ownerScopeValue` declared as filter fields.
  - Created idempotently by `setup-vector-index.js` using the driver's `collection.createSearchIndex()`.

### 7.3 SSE wire format

```
event: meta
data: {"conversationId":"...","requestId":"..."}

event: citations
data: {"ragRan":true,"ragHits":5,"citations":[{"n":1,"documentId":"...","chunkId":"...","title":"...","excerpt":"..."}]}

event: token
data: {"delta":"Hello "}

event: tool_call
data: {"id":"call_xxx","name":"getMyTasks","args":{"status":"pending"}}

event: tool_result
data: {"id":"call_xxx","name":"getMyTasks","ok":true,"summaryText":"4 pending tasks","uiHint":"taskList","data":[...]}

# Write-tool proposal — extra fields:
event: tool_result
data: {"id":"call_xxx","name":"updateTaskStatus","ok":true,"status":"pending_confirmation","toolCallId":"<mongoId>","proposalDescription":"Change task X status: not_started → in_progress","expiresAt":"...","uiHint":"actionProposal"}

event: done
data: {"conversationId":"...","messageId":"...","tokens":1234,"costUsd":0.0021,"ragRan":true,"ragHits":5,"citationCount":5}
```

---

## 8. State Management / Logic

### 8.1 Frontend state

**`AIChatContext` (React Context API)** — single source of truth for the chat drawer:

```js
{
  isOpen, open(), close(), toggle(),
  conversationId, conversations,
  messages,                  // [{id, role, content, status, citations, ragRan, ragHits, ...}]
  streaming, error,
  send(text), stop(),
  startNewConversation(),
  loadConversation(id),
  refreshConversations(),
}
```

Streaming model: while an assistant turn is in flight we keep a single "draft" message at the tail of `messages` with `id: 'draft-…'`. Token deltas append to its `content`. `tool_call` events insert a `role: 'tool_pending'` message; the matching `tool_result` mutates that into `role: 'tool'` with the result.

Auth state comes from existing `AuthContext` (unchanged): `user`, `permissions`, `hasPermission()`.

### 8.2 Backend state

Three Mongo-backed surfaces:

- **`ai_conversations`** + **`ai_messages`** — chat history + tool results
- **`ai_tool_calls`** — per-tool audit (includes V3 proposal lifecycle)
- **`ai_metrics`** — per-request usage for the admin dashboard
- **`ai_documents`** + **`ai_document_chunks`** — RAG corpus
- **`ai_user_facts`** — long-term memory
- **`ai_feedback`** — thumb up/down

Rate limiting is **in-process** (`Map<userId, {count, windowStart}>`). On process restart the counter resets — acceptable until multi-process scaling.

### 8.3 Critical logic

- **Token budget** (`aiConfig.budget`): system 1500 · tools 1000 · history 2500 · retrieved chunks 3500 · user facts 500 · response reserve 1500 ≈ 10.5k effective context.
- **Tool fit-to-budget** (`tokenizer.fitHistoryToBudget`): walks newest-to-oldest, preserves the latest user turn, never drops a `role:'tool'` message without its parent `role:'assistant' + tool_calls` message (OpenAI rejects orphans).
- **Permission resolution** (`auth.middleware.loadPermissions`): role permissions ∪ User.customPermissions. `'*'` wildcard short-circuits everything. We mirror this in `utils/loadPermissions.js` for non-request contexts (cron jobs).
- **Tool scope auto-widening** (V2.1): when the caller has a wider permission (e.g. `crm.read` / `projects.read` / `*`), tools that would otherwise scope to `assignedTo: userId` default to `team`/`all`. Fixes "admin gets 0 because no data is assigned to them".
- **Write-tool two-phase logic** (`tools.executor`):
  - On first invocation → `dryRun()` only → persist `AIToolCall {status: 'pending_confirmation', pendingExpiresAt: now+5min}`.
  - On `/confirm` POST → re-check ownership + expiry + permission → `apply()` → update audit row.
- **RAG fallback**: `rag.service` tracks `vectorSearchAvailable` (tri-state). On first `$vectorSearch` error containing "vectorSearch"/"search index", flips to false and falls back to `$text` + in-process cosine for the rest of the process lifetime.

---

## 9. Challenges Faced

| # | Challenge | Resolution |
|---|---|---|
| 1 | **`EventSource` cannot send `Authorization` header**, but our auth is Bearer-token | Built a custom fetch + ReadableStream + TextDecoder SSE parser in `aiService.js`. Wire format is still standard SSE — drop-in for any future SSE source. |
| 2 | **OpenAI tool-call deltas arrive in pieces** (`function.arguments` is partial JSON across chunks) | Accumulated `tool_calls[i]` by index in a `Map`, parsed JSON only after `finish_reason === 'tool_calls'`. If JSON parse fails, return `{_raw: string}` to the handler — never crashes the loop. |
| 3 | **`$vectorSearch.filter` uses different syntax than Atlas Search**'s `compound` clause | Initially wrote compound syntax — wrong. Caught during review and rewritten to plain MQL (`{$or: [...]}`); the filter fields must be declared in the index definition. |
| 4 | **Atlas vector index builds asynchronously** (PENDING for ~1-2 minutes after `createSearchIndex`) | Wrote a tier-aware fallback path: keyword `$text` + in-process cosine re-rank. Service self-detects via the error message and flips a flag. Live verification confirmed retrieval working even while index was PENDING. |
| 5 | **Silent `PMSActivityLog` write failures** — `entityType: 'ai_query'` is not in the enum AND `projectId` is `required: true`. Every AI tool call's audit write was being swallowed by try/catch. | Removed the duplicate write to `PMSActivityLog` from `tools.executor` — `AIToolCall` is the authoritative audit surface for AI. For V3 write tools, however, we DO write to `PMSActivityLog` with a real `projectId` and proper `entityType: 'task'` so existing audit reports surface AI-driven mutations. |
| 6 | **`String(undefined)` is `"undefined"` (truthy)**, which crashed Mongo `$in` cast | Replaced `.filter(Boolean)` with `.filter(x => x.field).map(x => String(x.field))` across 4 tools that hydrate user/project lookups. |
| 7 | **Hard-scoping by `assignedTo: ctx.userId` returned 0** for admin users querying leads that had no `assignedTo` set | Auto-widen default scope to `team`/`all` when caller holds the wider permission. Updated tool descriptions so the model knows the default behaves correctly. |
| 8 | **Model hallucinated permission denials** ("you don't have access to leads") when the real cause was "no tool exists" | Tightened system prompt: only relay denials when a tool actually returned `error:'denied'`; explicit "no tool for that — try the {module} screen" rule. |
| 9 | **Model answered KB-able questions from training data** (generic interior-design checklist instead of the actual 6 JJ Studio approval types) | Strengthened the KB section of the system prompt: "MUST answer FROM the snippet" + "Do NOT use generic industry knowledge if a JJ Studio snippet is available". |
| 10 | **User couldn't tell if RAG ran or not** — silent 0 results | Always emit `citations` event with `{ragRan, ragHits, citations[]}` even when empty. Added `RagStatusPill` UI showing "0 KB sources matched" or "knowledge base not searched". |
| 11 | **First duplicate `OPENAI_API_KEY=` line in `.env`** (mine added empty at bottom; user pasted real key above) — some dotenv versions let the later (empty) one win | Removed my redundant empty line; user's real key on line 11 is now authoritative. |
| 12 | **`Cannot find module 'ajv'` crash** on first run after I added the dep | Ran `npm install` — 23 backend packages installed (openai, gpt-tokenizer, ajv, ajv-formats + transitive). |
| 13 | **Mongoose duplicate-index warnings** for `Role.name`, `Project.trackingId`, `CRMClient.trackingId` | Confirmed pre-existing in the codebase (both `unique:true` AND `schema.index()` declared). Not AI-related, harmless. Noted for future cleanup. |
| 14 | **`crypto.randomUUID` availability** varies by Node version | Defensive helper: `crypto?.randomUUID || Math.random().toString(36).slice(2)`. |

---

## 10. Improvements / Refactoring Done

- **Two-phase tool execution** in `tools.executor` cleanly separates read (one call) from write (propose → confirm) without duplicating permission/validation logic — both phases share `getValidator` and the same audit helper.
- **Reused existing patterns** instead of inventing new ones: provider/queue/cron pattern from mail/whatsapp modules; activity logging via `shared/activityLogger`; permission middleware unchanged; route mounting style identical to other modules. Zero churn for existing engineers.
- **Idempotent setup scripts** — `seed-ai-permissions`, `seed-ai-documents`, `setup-vector-index` are all safe to re-run. The doc seeder dedupes by content hash; permissions use `$addToSet`; vector index check-then-create.
- **System prompt iteratively tightened** based on observed failure modes (KB enforcement, no-fake-denial, write-pending-clarity).
- **Removed dead code**:
  - Unused import in `ai.controller.js`
  - Unused destructured `{v4: uuidv4}` from crypto in orchestrator
  - Misleading `PMSActivityLog` write that was silently failing on every AI call
- **`forwardRef` + `useImperativeHandle`** in `SourcesPanel` keeps the parent-child contract surgical — only the `highlight(n)` method is exposed.
- **Defensive null-handling** across all tools — `.filter(x => x.fieldName)` before any `String(x.fieldName)` chain.
- **Audit-trail consistency** — V3 write tools log to BOTH `AIToolCall` (full lifecycle: pending/confirmed/cancelled/error) AND `PMSActivityLog` (with `metadata.viaAI: true`) so existing project-activity reports surface AI-driven changes automatically.
- **Sanitized tool args** before persisting — caps strings at 500 chars, depth at 5, strips Mongo `$`-operators.

---

## 11. Pending Work / Next Steps

### 11.1 Immediate (V3.2 candidates)

| Item | Why it matters | Rough effort |
|---|---|---|
| Drawing write tools (`approveDrawing`, `releaseDrawing`, `requestDrawingRevision`) | Mirrors task tools, big designer-workflow unlock | ~3 hours |
| `updateLeadStatus` + `addFollowUp` + `assignLead` | Closes the loop on CRM write coverage | ~2 hours |
| `updateProjectStatus` with kickstart-awareness | Significant — many invariants | ~3-4 hours |
| Persist `toolName` on `AIMessage` | Reloaded conversations currently show tool-result cards without the right chip | ~30 min |
| Persist `proposalDescription` + `toolCallId` on the assistant `AIMessage` for write turns | So reloaded conversations can show "this was proposed" cleanly | ~30 min |

### 11.2 Medium term (V3.x)

| Item | Why |
|---|---|
| **Admin metrics dashboard** in React (`/settings/ai-metrics`) | All data exists in `AIMetric` + `AIToolCall` — just needs visualization + daily cost-cap kill switch |
| **Pre-classifier for top-20% FAQ queries** | Saves ~$0.0015 + ~700ms per cached query when volume grows |
| **Response cache** (`AIResponseCache`, 6h TTL) keyed by normalized-query hash | For deterministic KB-only queries |
| **Multi-agent / analytics sub-agent** | For aggregation-heavy queries like "breakdown of all projects by designer" |
| **Hindi/Hinglish few-shot** in `prompts/fewShot.js` | Once we collect real failure-mode examples |
| **PDF ingestion** | Convert PDFs → markdown → existing ingestion pipeline |
| **Bulk operations** with per-item confirm | "approve all my pending tasks" |
| **Mail/WhatsApp send tools** | Highest sensitivity — needs separate PII/spam review |

### 11.3 Tech debt

- Mongoose duplicate-index warnings in `Role`, `Project`, `CRMClient` (pre-existing — remove one of `unique:true` or `schema.index({trackingId:1})`)
- Multi-process rate limiting (current is per-process; would need Redis to scale horizontally)
- Consider switching to encrypted-at-rest for `AIMessage.content` if compliance tightens (today only `AI_PII_HASH_MODE` toggles a SHA-256 prefix)

### 11.4 Suggestions

- **Ingest your real SOPs** to replace the 5 starter docs. The cleaner the source markdown, the better the chunk boundaries.
- **Run the seed scripts in production** with `--with-admin` so admins/MD get `ai.admin` and `ai.docs.manage` automatically.
- **Monitor `AIMetric.costUsd`** for the first week and set a daily cap (`AI_DAILY_COST_CAP_USD` env var) once you have a baseline.

---

## 12. Notes for Future Reference

### 12.1 Important learnings

1. **Tool-calling > fine-tuning for ERPs** — every query passes through the existing RBAC layer; data is fresh; schema changes don't force retraining. Document this in the architecture doc so it doesn't get re-debated.
2. **Always emit diagnostic events even when there's "nothing to report"** — `ragRan: false, ragHits: 0, citations: []` is far more useful than the absence of an event. Saves hours of "is this thing working?" debugging.
3. **`String(undefined) === "undefined"`** — bites you anywhere you build Mongo `$in: [...ids]` arrays. Filter on the field, then map. Always.
4. **Two-phase confirmation is worth the code** — five LOC of `dryRun`/`apply` separation buys explicit audit, expiry, and re-permission-check guarantees that would otherwise require ad-hoc tokens.
5. **System-prompt rule precedence matters** — the model applies rules in order. The "no tool for that" rule was triggering BEFORE the "use the KB if available" rule when both were applicable. We had to make them mutually exclusive (KB rule only kicks in when chunks are present).
6. **Atlas `$vectorSearch.filter` uses MQL**, NOT Atlas Search `compound` syntax. Filter fields must be declared explicitly in the index. Catch this in code review.
7. **Mongoose `find({_id: {$in: [...]}})` casts every element** — a single `undefined` in the array crashes the entire query.
8. **Don't trust `.filter(Boolean)` for ObjectIds** — strings are always truthy.
9. **OpenAI billing accuracy requires `stream_options: {include_usage: true}`** — without it, the streamed response carries no usage data and you're left estimating from token counts.

### 12.2 Things to remember

- **The vector index `ai_vector_idx` is fundamental** — when it's PENDING, RAG transparently uses the keyword + cosine fallback. Don't panic if `setup-vector-index.js` reports PENDING — it usually goes READY in 1-2 min for small corpora.
- **`AIToolCall.isWrite` is the V3 marker** — if you query the audit log, `{isWrite: true, status: 'confirmed_ok'}` is "AI did something that changed state and the user approved it".
- **`PMSActivityLog.metadata.viaAI: true`** is the cross-cutting filter for "all changes made via the AI". Use this to build the V3 admin dashboard later.
- **`hasPermission('ai.chat')` in the layout is the master switch** — flipping the permission off cleanly removes the FAB for that user.
- **The 5-minute proposal TTL** is a soft limit (checked at confirm time, not enforced by a TTL index — we want to keep the audit row forever).
- **Permission re-check at confirm time** is intentional — if you remove `tasks.update` from a role, in-flight proposals from that role become un-confirmable. This is the desired behavior.
- **All write tools log activity with a real `projectId`** — they look up the task's project first, then pass it to `logActivity({entityType: 'task', viaAI: true})`.
- **Frontend write proposals carry TWO IDs**: the OpenAI `call_xxx` id (transient, in-message) and the Mongo `AIToolCall._id` (persistent, used for /confirm). The AIChatContext swaps the former for the latter on `tool_result`.

### 12.3 Files to look at first when debugging

| Symptom | Look at |
|---|---|
| Chat hangs at "Thinking…" | `orchestrator.service.js` loop + `aiService.js` SSE parser |
| Tool returns nothing when it should | `tools.executor.js` permission/validation gates → tool's `handler` Mongo query |
| Citations not appearing | `rag.service.js` (any "unavailable" warning in logs?) + `seed-ai-documents.js` run? + `AIDocumentChunk.countDocuments()` |
| Permission denials when they shouldn't happen | `seed-ai-permissions.js` run? + check `Role.findOne({name}).permissions` |
| Cost spike | `AIMetric` aggregations + `aiConfig.limits.maxTokens` |
| Write didn't apply | `AIToolCall.findById(toolCallId)` — what's the `status` and `errorCode`? |
| Atlas index not used | `vectorIndex.service.probe()` or run `db.ai_document_chunks.aggregate([{$listSearchIndexes:{}}])` |

### 12.4 One-line cheat sheet

```powershell
# Operate the AI module
node backend/scripts/seed-ai-permissions.js --with-admin   # grant perms
node backend/scripts/setup-vector-index.js                 # create Atlas vector index
node backend/scripts/seed-ai-documents.js                  # seed 5 starter SOPs
node backend/scripts/seed-ai-documents.js --reset          # archive + re-ingest

# Health probe (admin only)
curl -H "Authorization: Bearer <token>" http://localhost:5000/api/ai/health

# Manual user-facts summarize (admin only)
curl -X POST -H "Authorization: Bearer <token>" http://localhost:5000/api/ai/admin/summarize-facts
```
