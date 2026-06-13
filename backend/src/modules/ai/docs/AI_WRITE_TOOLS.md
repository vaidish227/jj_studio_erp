# AI Assistant — Write Tools (V3)

V1 and V2 made the assistant a **viewer**. V3 makes it a **doer** — for a
deliberately small, safety-gated set of operations.

## Safety model

Every write goes through a **two-phase** flow:

```
   user message
       │
       ▼
   model decides   ──── calls a write tool (e.g. updateTaskStatus)
       │
       ▼
   tool.dryRun()   ──── permission + lifecycle + ownership checks
       │                ↓ on failure  → SSE tool_result {ok:false, error:'denied'/'invalid_transition'/…}
       ▼
   AIToolCall doc created with status='pending_confirmation'
   pendingExpiresAt = now + 5 minutes
       │
       ▼
   SSE tool_result {status:'pending_confirmation', toolCallId, proposalDescription, expiresAt}
       │
       ▼
   UI renders <ActionConfirmCard> with Confirm + Cancel buttons + countdown
       │
       ▼  user clicks Confirm
   POST /api/ai/actions/:toolCallId/confirm
       │
       ▼
   executor.confirmAction()
       ├─ re-check: doc.status === 'pending_confirmation'
       ├─ re-check: doc.userId === req.user.id
       ├─ re-check: doc.pendingExpiresAt > now
       ├─ re-check: tool.permission is still in ctx.permissions
       │            (perms may have changed between propose and confirm)
       ▼
   tool.apply(args, ctx)  ──── runs the actual mutation + logActivity()
       │
       ▼
   AIToolCall.status = 'confirmed_ok' (or 'confirmed_error')
   resultPreview, confirmedAt, latencyMs persisted
```

**Why the second permission check?** Between propose and confirm, an admin
could have demoted the user. We re-validate at the moment the mutation
actually happens. This is the same model browsers use for CSRF tokens — the
intent is captured at one moment, the side effect at another, and the
authority must hold at both.

## Confirmation card

The card is rendered inline in chat (not a modal). It shows:

- A one-line, human-readable description of what's about to happen.
- A live countdown until the proposal auto-expires.
- Confirm (gold) and Cancel (plain) buttons.
- On click, animates through `confirming → done` / `error` with the result.

States the card can be in:

| State | Trigger | Appearance |
|---|---|---|
| `pending` | Initial — proposal arrived | Amber card with both buttons |
| `confirming` | User clicked Confirm | Buttons disabled + spinner |
| `cancelling` | User clicked Cancel | Buttons disabled + spinner |
| `done` | apply() returned ok | Green check + result summary |
| `cancelled` | Cancel succeeded | Muted "Cancelled" line |
| `expired` | Countdown hit 0 | Muted "Expired" line |
| `error` | apply() returned error / threw | Red banner + Dismiss + Retry |

Five minutes is intentional — long enough that a distracted user can come
back, short enough that a stale proposal can't be confirmed days later in a
totally different context.

## Tool catalog (V3.1)

All five tools live in `backend/src/modules/ai/tools/`.

| Tool | Permission | Wraps | Lifecycle rules |
|---|---|---|---|
| `updateTaskStatus(taskId, status, reason?)` | `tasks.update` (assignee) **or** `tasks.approve` (approval-side transitions) | Task.status | Transition matrix from `Task.controller.js`; `on_hold` requires `reason`; `approved`/`released_to_site`/`revision_requested`/`pending_client_approval` require `tasks.approve` |
| `toggleChecklistItem(taskId, itemIndex, isCompleted)` | `tasks.update` | Task.checklist[i].isCompleted | Only the assignee may tick their own checklist (unless caller has `tasks.approve`/`*`) |
| `reassignTask(taskId, toUserId\|toUserName, reason)` | `tasks.reassign` | Task.assignedTo + reassignedFrom/At/Reason | Name lookup refuses if > 1 active user matches; reassigning to the current assignee is a no-op |
| `requestTaskRevision(taskId, instructions, deadline?)` | `tasks.approve` | Task.status='revision_requested' + revisionInstructions + revisionDeadline | Source status must be `pending_review`, `pending_client_approval`, or `approved` |
| `addTaskNote(taskId, note)` | `tasks.update` | Task.notes (timestamped append) | Assignee or approver only |

Each tool exports the same contract:

```js
module.exports = {
  name: '<camelCase>',
  permission: '<perm.string>',
  isWrite: true,                     // <-- the flag the executor checks
  description: '…',                  // shown to the model
  parameters: { /* JSON Schema */ },
  async dryRun(args, ctx) { /* validate; return {ok, proposalDescription, args, preview} */ },
  async apply(args, ctx)  { /* mutate + logActivity; return {ok, summaryText, uiHint, data} */ },
};
```

## Adding a new write tool

1. Create `backend/src/modules/ai/tools/<myTool>.tool.js` following the contract above.
2. Both `dryRun` and `apply` must perform the same authorization checks. The
   apply side is the truth — don't trust dryRun.
3. Inside `apply`, call `logActivity({...viaAI: true})` so the activity log
   shows the change came from the assistant. Use a proper `entityType` enum
   value and a real `projectId` (PMSActivityLog requires it).
4. Register in `services/tools.registry.js` under the "Write" section.
5. Add a friendly label + icon to `frontend/src/modules/ai/components/ToolMessage.jsx#TOOL_META`.
6. Add a few sample queries to the system prompt or `prompts/fewShot.js`
   if the model needs guidance to pick the new tool.
7. Grant the underlying permission to the appropriate roles.

## Audit trail

Two artifacts persist for every write:

1. **`AIToolCall`** captures the full lifecycle:
   - `status` transitions: `pending_confirmation → confirmed_ok / confirmed_error / cancelled / denied`
   - `proposalDescription`, `pendingExpiresAt`, `confirmedAt`, `cancelledAt`
   - `args` (sanitized) + `resultPreview` (≤ 2 KB)
2. **`PMSActivityLog`** captures the *effect* of the write — the same row a
   manual edit would have produced. `metadata.viaAI: true` marks it as
   AI-initiated so you can audit cross-cutting via:

   ```js
   PMSActivityLog.find({ 'metadata.viaAI': true })
   ```

## Disabling write tools

Three escape valves:

- **Per-tool**: remove the entry from `tools.registry.js#TOOLS`. The model
  loses access immediately on next request.
- **Per-user**: revoke the underlying permission (`tasks.update`,
  `tasks.approve`, etc.). The tool is exposed to the schema but every
  invocation returns `denied`.
- **Per-deployment**: comment out the action routes in `routes/ai.route.js`.
  Proposals are still created but the Confirm button 404s.

## What's deliberately not in V3.1

| Action | Why deferred |
|---|---|
| Send mail / WhatsApp | Externally visible side effects — needs spam/PII review |
| Update project status | Kickstart workflow has many implicit invariants |
| Update client approval | Externally signed off; AI shouldn't move it |
| Delete anything | Irreversible. Not worth the blast radius. |
| Bulk operations ("approve all my tasks") | Confirmation UX assumes single-action proposals |

Each is a future V3.x extension following the same two-phase pattern.

## Verification cookbook

A quick way to sanity-check write tools end-to-end:

```js
// In a node REPL, against your dev DB:
const tool = require('./src/modules/ai/tools/updateTaskStatus.tool');
const ctx = { userId: '<a-real-user-id>', permissions: ['*'] };
const proposal = await tool.dryRun({ taskId: '<a-real-task-id>', status: 'in_progress' }, ctx);
console.log(proposal);   // expect { ok:true, proposalDescription, args, preview }
const applied = await tool.apply(proposal.args, ctx);
console.log(applied);    // expect { ok:true, summaryText, data:{taskId, status:'in_progress'} }
```
