# AI Assistant — Memory Model

Two distinct memory surfaces:

## 1. Short-term memory — conversation history

Loaded per-turn by `memory.service.loadHistory(conversationId, budget)`.

- Pulls the most recent ~10 turns from `AIMessage`.
- Reconstructs the OpenAI-format messages (assistant with `tool_calls`, tool
  with `tool_call_id` linkage).
- Fits into `aiConfig.budget.history` (default **2500 tokens** in V2; was
  4000 in V1 — V2 reallocated 1500 tokens to retrieved RAG chunks).
- Always preserves the latest user turn. Drops oldest non-system turns first.
  When a `tool` message would be kept, its parent assistant `tool_calls`
  message is kept too (or both dropped together) — OpenAI rejects orphan
  tool messages.

This memory resets on a new conversation. It does **not** persist preferences
across conversations.

## 2. Long-term memory — user facts

Stored in `AIUserFact { userId, fact, source, confidence, expiresAt }`.

### Two sources

- **`source: 'explicit'`** — the user added the fact themselves via
  `POST /api/ai/user-facts`. Confidence: 1.0. Never expires unless deleted.
- **`source: 'summarized'`** — the nightly summarizer extracted it from
  recent conversations. Confidence: 0.7. Expires after 60 days unless the
  summarizer re-emits it.

Schema enforces uniqueness on `(userId, fact)` — upserts are idempotent.

### Injection

`userFactsService.loadFactsForUser(userId, { budget: 500 })` is called by the
orchestrator alongside RAG retrieval. The facts are rendered into the system
prompt under "Known user facts" with this instruction:

> Use them to frame answers, but don't recite them back unless asked.

### Nightly summarizer

`cron/userFactsSummarizer.js` schedules at **03:15 server-local** daily.
For each user active in the last 24 hours:

1. Pull the user's last 20 conversations (look-back: 14 days).
2. Build a compact transcript (capped at ~6000 chars).
3. Ask `gpt-4o-mini` with a JSON-mode response format to distil 0–7 short
   facts about durable preferences, workflow habits, and recurring focus.
4. Upsert each fact with a 60-day TTL.

The summarizer is **conservative on purpose**: it filters out facts < 8 chars
and > 200 chars, and the prompt explicitly forbids PII, one-off questions,
and IDs.

### Manual trigger (admin)

```http
POST /api/ai/admin/summarize-facts
Authorization: Bearer <ai.admin>
```

Returns `{ totalUsers, totalFacts }`.

### Why not a vector store for user facts?

Facts are small in volume (< 50 per user), short, and need exact-string
dedupe. A simple Mongo collection is cheaper and easier to inspect than a
vector index. We can always migrate later if facts grow significantly.

## Memory & RBAC

- A user only sees their own facts. `GET /api/ai/user-facts` is owner-scoped.
- The summarizer runs per user — facts are never mixed across users.
- Admin's `ai.admin` permission can trigger the summarizer but not inspect
  another user's facts (deliberately — facts are personal).

## Privacy

When `AI_PII_HASH_MODE=true`, user message content is hashed before storage,
but **user facts** still store the model-distilled fact string in clear. The
distillation prompt explicitly forbids PII; in practice this means a fact
like *"prefers task lists in table form"* is fine, while *"phone is 99999"*
would be filtered. If you tighten compliance further, add a regex filter in
`userFactsService.summarizeUserFacts` before the upsert step.

## Disabling

- **Disable the summarizer entirely**: don't import `startUserFactsSummarizer`
  in `backend/src/index.js`, or set `OPENAI_API_KEY=""` (the cron self-skips).
- **Disable injection per-request**: pass an empty list — the simplest hook
  is to short-circuit `loadFactsForUser` for a flagged user.
- **Wipe one user's facts**: `AIUserFact.deleteMany({ userId })`.
