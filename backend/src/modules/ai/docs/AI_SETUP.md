# AI Assistant — Setup Guide

This document is the operator's runbook for bringing the AI module online.

## 1. Install dependencies

From the repo root:

```bash
cd backend
npm install            # picks up: openai, gpt-tokenizer, ajv, ajv-formats

cd ../frontend
npm install            # picks up: react-markdown, remark-gfm
```

## 2. Configure environment variables

Append to `backend/.env`:

```env
OPENAI_API_KEY=sk-...                # required to enable the assistant
OPENAI_BASE_URL=https://api.openai.com/v1

AI_MODEL_DEFAULT=gpt-4o-mini         # used for ~80% of queries
AI_MODEL_COMPLEX=gpt-4o              # auto-selected for long / aggregation queries
AI_EMBEDDING_MODEL=text-embedding-3-small   # V2 RAG only

AI_MAX_TOKENS=1500                   # response cap
AI_TEMPERATURE=0.2                   # low for deterministic ERP answers
AI_RATE_LIMIT_PER_MIN=20             # per-user/minute
AI_HISTORY_TURNS=10                  # conversation memory window
AI_HARD_TIMEOUT_MS=60000             # full-request hard stop
AI_MAX_TOOL_ITERATIONS=5             # safety stop for tool-call loops
AI_INPUT_CHAR_LIMIT=4000
AI_PII_HASH_MODE=false               # set true to hash stored user messages
```

If `OPENAI_API_KEY` is empty, the assistant degrades gracefully — the chat
endpoint returns a friendly SSE `error` event and the rest of the ERP boots
normally.

## 3. Grant permissions to existing roles

Run the one-shot seed (idempotent — safe to re-run):

```bash
node backend/scripts/seed-ai-permissions.js                # grants ai.chat to everyone non-system
node backend/scripts/seed-ai-permissions.js --with-admin   # also grants ai.admin to admin/md
```

Admins with `permissions: ['*']` already have everything by virtue of the
wildcard — they do not need re-seeding.

## 4. Start the dev servers

```bash
# terminal 1
cd backend && npm run dev

# terminal 2
cd frontend && npm run dev
```

A new floating sparkle button appears in the bottom-right corner of every
authenticated page for users with `ai.chat`.

## 5. Smoke test

Open the chat and try:

- "Show my pending tasks"
- "What is overdue?"
- "My dashboard summary"
- "मेरे काम क्या हैं"
- "Show task <id> details" (paste an ObjectId from your DB)
- "project PRJ-2025-0001 summary"

You should see:

1. Streaming tokens (character-by-character).
2. A "Running Get My Tasks…" chip while the tool runs.
3. A clickable structured card with status, priority, due date, project tag.
4. Clicking a card navigates to `/projects/:id?taskId=...`.

## 6. Health check (admin only)

```bash
curl -H "Authorization: Bearer <admin token>" \
     http://localhost:5000/api/ai/health
# -> {"ok": true, "latencyMs": 412}
```

## 7. Cost / usage metrics (admin only)

```bash
curl -H "Authorization: Bearer <admin token>" \
     'http://localhost:5000/api/ai/admin/metrics?from=2026-05-01&to=2026-05-31'
```

## 8. Disabling the assistant

Either:

- Unset `OPENAI_API_KEY` and restart backend — the FAB still renders but every
  chat request returns a friendly "not configured" message.
- Or revoke `ai.chat` from a role: `Role.updateOne({ name }, { $pull: { permissions: 'ai.chat' } })`.

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| FAB doesn't render | User lacks `ai.chat` permission | Run the seed script or grant manually |
| "AI is not yet configured" | `OPENAI_API_KEY` is empty | Set env var and restart |
| `openai package not installed` | `npm install` skipped | Re-run `npm install` in `backend/` |
| Streaming hangs at "Thinking…" | Reverse proxy buffering SSE | Disable buffering (NGINX: `proxy_buffering off;`) |
| 429 Rate limit exceeded | Burst over `AI_RATE_LIMIT_PER_MIN` | Lower per-user usage or raise the env var |
| Tool returns "denied" for a designer asking for HR data | Working as designed — RBAC scope | No action; this is the correct refusal |
