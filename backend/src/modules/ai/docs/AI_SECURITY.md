# AI Assistant — Security Model

The assistant is a privileged surface — it can read live ERP data on the
caller's behalf. The threat model treats every layer as adversarial.

## Authentication & authorization

| Layer | Check |
|---|---|
| Transport | HTTPS in production; JWT in `Authorization: Bearer` |
| Route entry | `verifyToken` (global in `app.js`) populates `req.user` |
| Route guard | `requirePermission('ai.chat')` (or `ai.admin` for admin endpoints) lazily loads `req.permissions` from `Role.permissions ∪ User.customPermissions` |
| Rate limit | `aiRateLimit.middleware` — per-user, per-minute, in-memory |
| Conversation ownership | Every `/conversations/:id` route asserts `conv.userId === req.user.id` OR caller holds `ai.admin` / `*` |
| Tool catalog | `tools.registry.openaiSchema(userPermissions)` only exposes tools the caller is permitted to invoke |
| Tool execution | `tools.executor.run()` re-checks `ctx.permissions ⊇ tool.permission` (defense in depth — never trust the model) |
| Tool handler | HARD-scopes the Mongo query by `ctx.userId` OR runs an explicit ownership check before returning data |

Wildcard `'*'` in `Role.permissions` continues to grant everything (admin
shortcut). Inactive users (`User.isActive === false`) are rejected by
`loadPermissions` — they cannot reach the AI.

## Prompt injection defense

- The user message is **never** concatenated into the system prompt. It always
  arrives as a separate `role: 'user'` turn — the model cannot promote a user
  string into instructions.
- Tool arguments are strictly validated by ajv against each tool's JSON Schema
  with `removeAdditional: 'all'`. Unknown keys are silently dropped before the
  handler runs.
- Tool outputs are sanitized (`utils/sanitize.js`):
  - strings capped at 2000 chars,
  - object depth capped at 6,
  - `$`-prefixed Mongo operator keys stripped,
  - `__proto__`, `prototype`, `constructor` keys dropped.
- Markdown rendered on the client deliberately **does not** enable raw HTML.

## Data scoping rules (RBAC)

Every tool handler enforces one of these patterns:

1. **Owner-only** (default): `Task.find({ assignedTo: ctx.userId })`.
2. **Owner + wider role**: `getTaskDetails` allows the assignee/approver/reassigner;
   anyone else must hold `tasks.approve`, `tasks.reassign`, `projects.read`, or `*`.
3. **Team scope**: `getOverdueTasks(scope: 'team')` requires `tasks.approve`,
   `projects.read`, or `*`. Otherwise we silently fall back to owner-only? **No** —
   we return an explicit `denied` so the model relays the refusal.

A test matrix (designer / supervisor / manager / admin × every tool) is part
of the integration test plan.

## Audit trail

Three independent log surfaces capture every interaction:

1. **AIToolCall** — per tool invocation. Fields: `toolName`, `args` (sanitized),
   `resultPreview` (~2 KB cap), `status` (`ok` / `denied` / `error` / `invalid_args` / `timeout` / `not_found`),
   `permissionCheckPassed`, `latencyMs`, `userId`, `createdAt`.
2. **PMSActivityLog** — `entityType: 'ai_query'`, `action: <toolName>`,
   `actorId`, `description`, `metadata: { args, status, latencyMs }`. Goes
   through the same `shared/activityLogger.js` used by the rest of the ERP.
3. **AIMetric** — per `/chat` request. Fields: `requestId`, `userId`,
   `conversationId`, `model`, `promptTokens`, `completionTokens`, `costUsd`,
   `latencyMs`, `toolCount`, `errorCode`.

All three writes are fire-and-forget — an audit failure can never block the
chat loop or surface to the user.

## Cost / abuse controls

- `AI_MAX_TOKENS=1500` caps the response length.
- `AI_RATE_LIMIT_PER_MIN=20` caps requests per user.
- `AI_MAX_TOOL_ITERATIONS=5` prevents a runaway tool loop (a malformed schema
  could otherwise have the model retry indefinitely).
- `AI_HARD_TIMEOUT_MS=60000` aborts the upstream OpenAI request on client
  disconnect (no orphan billing).
- Admin `/api/ai/admin/metrics` exposes a daily/model/tool rollup for cost
  monitoring. A V3 cron will trigger a kill-switch when daily spend exceeds a
  configured threshold.

## PII handling

When `AI_PII_HASH_MODE=true`, user-message content is stored as
`sha256(content).slice(0, 8) + content.slice(0, 40)` so audit logs remain
linkable but raw text is not persisted. Ships disabled in V1.

## Threats explicitly out of scope for V1

- Server-side write actions via tool calling (e.g. "mark task done"). V1 is
  read-only by design; the model is instructed to refuse and point the user
  to the relevant ERP screen.
- Encryption-at-rest beyond what MongoDB Atlas already provides.
- Multi-tenant isolation (the ERP is currently single-tenant).
