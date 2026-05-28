# AI Development Log — 27/05/26

**Name:** Vaidish and Adarsh
**Date:** 27/05/26
**Branch:** ADA_27MAY_V3.1
**Project:** JJ Studio ERP — AI Agent Tool Expansion

---

## 1. Overview of the Day

### Summary
Expanded the AI agent's capability surface inside the JJ Studio ERP by adding **8 new tools** (3 read-only + 5 write tools) covering the Dashboard module and CRM Leads sub-module. All tools follow the existing 2-phase write pattern (dryRun → user confirmation → apply), respect role-based permissions, and append to the central tool registry without disturbing existing tools.

### Main Goals
- Establish a strict **module-by-module rollout strategy** for AI tools to avoid breaking existing functionality.
- Deliver complete AI coverage for the **Dashboard** (Phase 1).
- Deliver core CRUD-style AI coverage for **CRM Leads** (Phase 2A).
- Preserve all pre-existing tools (no deletions, no modifications).

### Outcomes
- Tool registry grew from **29 → 37 tools**.
- AI assistant can now serve full dashboard queries and the entire lead-lifecycle (view, create, update, convert, advance-payment).
- Memory system updated so the next session can resume cleanly at Phase 2B.

---

## 2. Tasks Performed (Step-by-Step)

| # | Task | What | Why |
|---|------|------|-----|
| 1 | Agreed on rollout strategy | Confirmed module-by-module order: Dashboard → CRM → PMS → HRM → Finance → Inventory → Mail → Communication → Settings | Prevent scattered/conflicting tools and broken functionality |
| 2 | Audited existing AI tools | Mapped 28 existing tools against ERP modules; produced a gap-list | Identify what's covered vs. missing per module |
| 3 | Planned Phase 1 (Dashboard) | Designed 3 read tools mirroring `useDashboardData.js` output | Match exactly what the dashboard UI shows |
| 4 | Implemented Phase 1 | Created `getDashboardStats`, `getSalesPipeline`, `getDashboardFollowUps` | Cover the 3 dashboard panels |
| 5 | Registered Phase 1 tools | Appended 3 imports + entries to `tools.registry.js` | Make tools discoverable by the orchestrator |
| 6 | Verified Phase 1 load | Ran a Node smoke-test to confirm all 3 tools load without syntax errors | Catch errors before runtime |
| 7 | Planned Phase 2 (CRM) | Broke CRM into 4 sub-phases (2A Leads, 2B Meetings, 2C FollowUps, 2D Proposals) | Keep iterations small and testable |
| 8 | Audited CRM controllers | Read `Lead.route.js`, `CRMClient.controller.js`, and existing CRM tools to ground the design in real endpoints | Avoid guessed/incorrect implementations |
| 9 | Implemented Phase 2A | Created `getLeadDetails`, `createLead`, `updateLead`, `convertLead`, `recordAdvancePayment` | Cover the full lead lifecycle |
| 10 | Registered Phase 2A tools | Appended 5 imports + entries to `tools.registry.js` | Activate the new tools |
| 11 | Verified Phase 2A load | Smoke-tested each tool's `permission`, `handler`/`dryRun`/`apply` signatures | Confirm write tools use the 2-phase pattern correctly |
| 12 | Saved progress to memory | Wrote `feedback_tool_creation_strategy.md` and `project_ai_tools_phase_progress.md`; updated `MEMORY.md` | Enable seamless resume tomorrow |

---

## 3. Files Created / Modified

### Phase 1 — Dashboard Tools (NEW)

#### 3.1 `backend/src/modules/ai/tools/getDashboardStats.tool.js` — NEW
- **Purpose:** Return the 6 headline counters shown on the dashboard.
- **Key functionality:**
  - Runs 7 parallel `countDocuments` queries (active leads, converted, lost, contacted, meeting_done, proposal_sent, pending follow-ups).
  - Returns `stats: { totalLeads, converted, lostLeads, followups, inProgress, interested }`.
  - Scope-aware: managers see team-wide, others see only their own.
- **Permission:** `crm.read`
- **Trigger phrases:** *"dashboard stats"*, *"overview"*, *"how is sales going"*

#### 3.2 `backend/src/modules/ai/tools/getSalesPipeline.tool.js` — NEW
- **Purpose:** Return the 3 pipeline buckets (new leads, scheduled meetings, proposal-sent leads).
- **Key functionality:**
  - Parallel queries across `CRMClient` + `Meeting` collections.
  - Returns top N per bucket (default 5, max 20) + totals.
  - Each item carries a clickable `url` deep-link.
- **Permission:** `crm.read`

#### 3.3 `backend/src/modules/ai/tools/getDashboardFollowUps.tool.js` — NEW
- **Purpose:** Return pending follow-ups sorted by due date with urgency badges.
- **Key functionality:**
  - IST-anchored day calculations (badges: `OVERDUE` / `TODAY` / `TOMORROW` / `UPCOMING`).
  - Optional `onlyOverdue` filter.
  - Populates `leadId` and `assignedTo` for rich context.
- **Permission:** `crm.read`

### Phase 2A — CRM Lead Tools (NEW)

#### 3.4 `backend/src/modules/ai/tools/getLeadDetails.tool.js` — NEW
- **Purpose:** Return full single-lead view (contact, project, status, timeline, advance payment, assignee).
- **Key functionality:**
  - Uses `resolveLead` (ObjectId / trackingId / name fragment).
  - Returns last N timeline events (default 10, max 50).
  - Owner-or-elevated authorization.
- **Permission:** `crm.read`

#### 3.5 `backend/src/modules/ai/tools/createLead.tool.js` — NEW (WRITE)
- **Purpose:** Create a new CRM lead (mirrors `createClientEnquiry`).
- **Key functionality:**
  - Validates required `name` + `phone`.
  - Duplicate check on phone/email — refuses if a lead already exists.
  - Auto-seeds: `status="new"`, `lifecycleStage="enquiry"`, `assignedTo=ctx.userId`, opening interaction event.
  - 2-phase: `dryRun` (preview) + `apply`.
- **Permission:** `crm.create`

#### 3.6 `backend/src/modules/ai/tools/updateLead.tool.js` — NEW (WRITE)
- **Purpose:** Update basic lead fields (name, phone, email, projectType, area, budget, city, priority, notes, referrer info, siteAddress).
- **Key functionality:**
  - **Whitelisted fields only** (12 allowed) — cannot touch `status`, `interactionHistory`, `trackingId`, `communicationLogs`.
  - Ignores empty/null values to prevent accidental wipes.
  - No-op detection — refuses if nothing actually changed.
  - Appends `note` event to interactionHistory on apply.
- **Permission:** `crm.update`

#### 3.7 `backend/src/modules/ai/tools/convertLead.tool.js` — NEW (WRITE)
- **Purpose:** Mark a lead as converted (status + lifecycleStage → converted).
- **Key functionality:**
  - Refuses if already converted (no-op).
  - Refuses if lead is currently `lost` (must reopen first).
  - Appends `status_change` event.
- **Permission:** `crm.update`

#### 3.8 `backend/src/modules/ai/tools/recordAdvancePayment.tool.js` — NEW (WRITE)
- **Purpose:** Record an advance payment + auto-handoff to PMS.
- **Key functionality:**
  - Sets `status=converted`, `lifecycleStage=project_moved`.
  - Populates `advancePayment: { received, amount, note, receivedAt, movedToProjectManagement, movedAt }`.
  - Refuses if advance already recorded.
  - Appends `advance_payment` event.
- **Permission:** `crm.update`

### Files MODIFIED

#### 3.9 `backend/src/modules/ai/services/tools.registry.js` — MODIFIED (append-only)
- **Purpose:** Single source of truth for all AI tools. Maps tool names → schemas and enforces permissions.
- **Changes:**
  - Added 8 new `require()` imports under labeled section comments (`// Phase 1 — Dashboard read tools`, `// Phase 2A — CRM Leads (read + write)`).
  - Appended 8 entries to the `TOOLS` array.
  - **No existing line modified or deleted.**

---

## 4. File Relationships & Data Flow

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│  AI Chat UI (frontend/modules/ai)                           │
└──────────────────┬──────────────────────────────────────────┘
                   │ user message
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  AI Orchestrator (backend/modules/ai/services)              │
│  - Calls OpenAI with tool schemas from tools.registry       │
└──────────────────┬──────────────────────────────────────────┘
                   │ tool_call decision
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  tools.registry.js  ← SINGLE source of truth                │
│  - Filters by user permissions                              │
│  - Routes to individual *.tool.js files                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
       ┌───────────┴────────────┐
       ▼                        ▼
┌──────────────┐         ┌──────────────┐
│ Read tool    │         │ Write tool   │
│ .handler()   │         │ .dryRun()    │
│              │         │ .apply()     │
└──────┬───────┘         └──────┬───────┘
       │                        │
       ▼                        ▼
┌─────────────────────────────────────────────────────────────┐
│  CRM models (CRMClient, FollowUp, Meeting)                  │
│  Auth model (User)                                          │
│  Shared util: resolveCrm.js → resolveLead()                 │
└─────────────────────────────────────────────────────────────┘
```

### Import Chain

| File | Imports |
|---|---|
| `tools.registry.js` | All 37 tool files |
| `getDashboardStats.tool.js` | `mongoose`, `CRMClient`, `FollowUp` |
| `getSalesPipeline.tool.js` | `mongoose`, `CRMClient`, `Meeting` |
| `getDashboardFollowUps.tool.js` | `mongoose`, `FollowUp` |
| `getLeadDetails.tool.js` | `CRMClient`, `User`, `resolveCrm.resolveLead` |
| `createLead.tool.js` | `CRMClient` |
| `updateLead.tool.js` | `CRMClient`, `resolveCrm.resolveLead` |
| `convertLead.tool.js` | `CRMClient`, `resolveCrm.resolveLead` |
| `recordAdvancePayment.tool.js` | `CRMClient`, `resolveCrm.resolveLead` |

### Data Flow Example — `createLead`

```
User: "Add a new lead Ravi 98XXX residential Mumbai"
   │
   ▼
LLM → tool_call: createLead { name, phone, projectType, city }
   │
   ▼
Orchestrator → tools.registry.get("createLead")
   │
   ▼
createLead.dryRun(args, ctx)
   ├── authorize(ctx)  ───► checks ctx.permissions
   ├── findDuplicate({ phone, email }) ───► CRMClient.findOne
   └── returns { proposalDescription, preview }
   │
   ▼
Frontend renders confirmation UI
   │
   ▼ user clicks "Confirm"
createLead.apply(args, ctx)
   ├── authorize + duplicate re-check (race safety)
   ├── CRMClient.create({ ...args, status:"new", assignedTo:ctx.userId })
   └── returns { summaryText, data:{ leadId, trackingId, url } }
```

---

## 5. Components Breakdown

> Note: All today's deliverables are **backend tool modules**, not React components. Each tool is a CommonJS module exporting a tool descriptor consumed by the central registry.

| Tool | Type | Purpose | Inputs (parameters) | Where used |
|---|---|---|---|---|
| `getDashboardStats` | Read tool | Headline dashboard counters | `scope?` | `tools.registry.js` |
| `getSalesPipeline` | Read tool | Pipeline buckets | `scope?`, `limit?` | `tools.registry.js` |
| `getDashboardFollowUps` | Read tool | Pending follow-ups w/ badges | `scope?`, `limit?`, `onlyOverdue?` | `tools.registry.js` |
| `getLeadDetails` | Read tool | Full lead view | `leadId`, `historyLimit?` | `tools.registry.js` |
| `createLead` | Write tool (2-phase) | Create new lead | `name`, `phone`, `email?`, `projectType?`, `area?`, `budget?`, `city?`, `source?`, `priority?`, `notes?`, `referredBy?`, `referrerPhone?`, `siteAddress?` | `tools.registry.js` |
| `updateLead` | Write tool (2-phase) | Update lead fields | `leadId` + any of 12 whitelisted fields | `tools.registry.js` |
| `convertLead` | Write tool (2-phase) | Mark lead converted | `leadId`, `note?` | `tools.registry.js` |
| `recordAdvancePayment` | Write tool (2-phase) | Record advance + PMS handoff | `leadId`, `amount`, `note?`, `receivedAt?` | `tools.registry.js` |

### Tool Descriptor Shape
Every tool module exports:
```js
{
  name: string,
  permission: string,
  description: string,
  parameters: JSONSchema,
  isWrite?: boolean,                     // write tools only
  handler?: async (args, ctx) => result, // read tools only
  dryRun?: async (args, ctx) => preview, // write tools only
  apply?:  async (args, ctx) => result,  // write tools only
}
```

---

## 6. Reusable Components

### Reusable utilities leveraged

#### 6.1 `resolveCrm.resolveLead(input)`
- **Location:** `backend/src/modules/ai/utils/resolveCrm.js` (pre-existing)
- **Why reusable:** Every CRM tool needs to resolve a lead identifier. The function accepts 3 input forms — MongoDB ObjectId, trackingId (`CLI-YYYY-NNNN`), or a name/phone/email fragment — and returns either the document or an ambiguity/not-found error.
- **Used by today:** `getLeadDetails`, `updateLead`, `convertLead`, `recordAdvancePayment`
- **Future reuse:** All Phase 2B/2C/2D tools (meetings, followups, proposals on lead resolution).

#### 6.2 `WIDER_PERMS` / `hasWiderView()` pattern
- **Why reusable:** Standardizes "elevated access" checks. Each tool defines a small array of permission strings that widen the default owner-only scope.
- **Used by today:** Every Phase 1 and Phase 2A tool.
- **Future reuse:** Every new write/scoped-read tool.

#### 6.3 `loadAndAuthorize(args, ctx)` pattern
- **Why reusable:** Encapsulates "find the document + verify caller can act on it" so both `dryRun` and `apply` share identical logic. Prevents drift between preview and execution.
- **Used by today:** `updateLead`, `convertLead`, `recordAdvancePayment`.
- **Future reuse:** Every future 2-phase write tool.

#### 6.4 IST timezone helpers (pattern)
- **Source pattern:** `getMeetings.tool.js`
- **Re-implemented in:** `getDashboardFollowUps.tool.js` (today)
- **Future reuse:** Anywhere date-of-day matters (meetings on date X, deliveries due today, etc.). Could be extracted into a shared util.

### Tool registry as a reusable hub
- **`tools.registry.js`** is the single dispatch point. Adding any future tool requires only 2 lines: 1 `require()` + 1 entry in the `TOOLS` array. No orchestrator code changes.

---

## 7. APIs / Services / Integrations

### Backend models consumed (read/write via Mongoose)

| Model | File | Read by | Written by |
|---|---|---|---|
| `CRMClient` | `crm/models/CRMClient.model.js` | All 8 new tools | `createLead`, `updateLead`, `convertLead`, `recordAdvancePayment` |
| `FollowUp` | `crm/models/FollowUp.model.js` | `getDashboardStats`, `getDashboardFollowUps` | — |
| `Meeting` | `crm/models/Metting.model.js` | `getSalesPipeline` | — |
| `User` | `auth/models/user.model.js` | `getLeadDetails` (assignee lookup) | — |

### Tool-call API surface (consumed by the AI orchestrator)

| Tool name | Input | Behaviour |
|---|---|---|
| `getDashboardStats` | `{ scope? }` | Returns 6 counters + summaryText |
| `getSalesPipeline` | `{ scope?, limit? }` | Returns 3 buckets + totals |
| `getDashboardFollowUps` | `{ scope?, limit?, onlyOverdue? }` | Returns badged followups |
| `getLeadDetails` | `{ leadId, historyLimit? }` | Returns full lead doc |
| `createLead` (dryRun → apply) | `{ name, phone, ... }` | Preview, then DB insert |
| `updateLead` (dryRun → apply) | `{ leadId, ...fields }` | Preview diff, then `$set` |
| `convertLead` (dryRun → apply) | `{ leadId, note? }` | Preview, then status update |
| `recordAdvancePayment` (dryRun → apply) | `{ leadId, amount, note?, receivedAt? }` | Preview, then advance write |

### External integrations
- None added today. Existing referrer-email and WhatsApp automations on the controllers are not invoked by these AI tools (the tools write directly to the DB and rely on existing cron/automation flows downstream).

---

## 8. State Management / Logic

### Authentication context
Every tool handler receives `ctx`:
```js
ctx = {
  userId: string,        // current user's MongoDB id
  permissions: string[], // e.g. ["crm.read", "crm.update"] or ["*"]
  // ...other orchestrator-provided context
}
```

### Authorization logic (standardized)

```js
const isOwner   = String(lead.assignedTo) === String(ctx.userId);
const elevated  = ctx.permissions.some(p => WIDER_PERMS.includes(p));
const allowed   = isOwner || elevated;
```

### 2-Phase Write Pattern
```
dryRun() ─► returns { ok, proposalDescription, preview, args }
                                │
                                ▼  (UI confirmation)
                              apply() ─► returns { ok, summaryText, data }
```

Why two phases?
- **Safety:** No DB write happens until the user explicitly confirms the preview.
- **Idempotency:** `apply()` re-runs `loadAndAuthorize` so a stale dry-run can't sneak through if state changed.
- **UX:** Confirmation message is composed from real data, not the model's guess.

### Field-update safety in `updateLead`
- **Whitelist enforcement** — the JSON schema `additionalProperties: false` blocks unknown fields; `UPDATABLE_FIELDS` array gates which schema fields actually propagate to `$set`.
- **Empty-value guard** — `if (next === "" || next == null) continue;`
- **Change detection** — `if (lead[field] === next) continue;` skips no-op updates.
- **No-op refusal** — if `changes` ends up empty, the tool returns an error rather than silently doing nothing.

### Concurrency / race safety
- All writes are atomic single-document `updateOne` calls with `$set` + `$push` (interaction history) + `$currentDate` (lastInteractionAt) operators.
- `convertLead` and `recordAdvancePayment` re-check state in both `dryRun` and `apply` so two concurrent confirmations can't double-write.

### Timeline append pattern
Every write tool appends a typed event to `interactionHistory`:
```js
$push: {
  interactionHistory: {
    type: "advance_payment" | "status_change" | "note",
    title: "...",
    description: "...",
    metadata: { ... },
    createdAt: new Date(),
  }
}
```
This keeps an audit trail that surfaces in the lead's detail view.

---

## 9. Challenges Faced

| Challenge | Resolution |
|---|---|
| Risk of breaking existing tools | Adopted **append-only** strategy — never edit/delete existing requires or `TOOLS` entries. Saved this rule into long-term memory. |
| Ensuring dashboard tool numbers match the UI | Read `useDashboardData.js` end-to-end and mirrored the exact query shape (e.g., `inProgress = contacted + meeting_done`). |
| Two-phase pattern signature confusion | Initially considered `handler()` for writes; verified against `updateLeadStatus.tool.js` and `scheduleMeeting.tool.js` that the actual contract is `dryRun()` + `apply()`. |
| Permission strings unclear for `createLead` | Studied existing tools to find the canonical strings (`crm.create`, `crm.update`) and used `WIDER_PERMS = ["*", "crm.create", "crm.update"]`. |
| Preventing accidental field wipes via `updateLead` | Built a whitelist + empty-value drop + change-detection trio. Empty `""` or `null` values silently ignored so the model can't blank a field. |
| Date-of-day badge for followups | Replicated the IST-anchored YMD calculation from `getMeetings.tool.js` to keep `OVERDUE`/`TODAY`/`TOMORROW` consistent with the dashboard. |
| Tracking progress across sessions | Saved a `project_ai_tools_phase_progress.md` memory file with the full roadmap so tomorrow's session resumes cleanly without re-explaining. |

---

## 10. Improvements / Refactoring Done

- **Centralized resume context** — Created `project_ai_tools_phase_progress.md` so phase progress survives session boundaries. Replaces ad-hoc TODO comments.
- **Section-commented registry** — Every new block in `tools.registry.js` is grouped under a labeled comment (`// Phase 1 — Dashboard read tools`, `// CRM Leads — write (Phase 2A)`) making the file self-documenting.
- **Defensive `updateLead` design** — The whitelist + empty-drop + change-detection approach is more conservative than the underlying controller (`updateClientDetails`), which mass-merges `req.body`. The AI tool intentionally narrows the blast radius.
- **No refactoring of existing tools** — Strict policy: zero changes to pre-existing files except for append-only edits to the registry.

---

## 11. Pending Work / Next Steps

### Phase 2B — Meetings (next session)
- `updateMeeting` — reschedule / change type, notes, duration
- `completeMeeting` — mark done with outcome + `clientInterested` + optional follow-up date

### Phase 2C — Follow-ups
- `getFollowupsByLead` — list all followups for a given lead
- `completeFollowUp` — mark pending → done
- `updateFollowUp` — reschedule or update note

### Phase 2D — CRM Proposals
- `getProposals`, `getProposalDetails`, `updateProposal`, `updateProposalStatus`

### Phase 3 onwards
- **PMS** — Projects, Tasks (extend), Drawings (extend), Milestones, Site Logs, Materials, PO, Vendors, Calendar
- **HRM** — Employees CRUD
- **Finance** — Payments
- **Inventory** — Items
- **Mail** — sendMail, getMailTemplates
- **Communication** — WhatsApp send + groups
- **Settings** — query/update settings

### Future improvements
- **Extract IST helpers** into `backend/src/modules/ai/utils/dateIst.js` to remove duplication between `getMeetings` and `getDashboardFollowUps`.
- **Extract `loadAndAuthorize`** scaffold into a shared util once 3+ resource types follow the same pattern (lead, meeting, followup).
- **Add automated tests** — currently relying on a Node smoke-test; consider Jest tests around `dryRun` no-op detection and duplicate refusal.
- **Frontend tool-result cards** — UI hints `dashboardStats`, `salesPipeline`, `followupList`, `leadDetails` are emitted but may need bespoke React cards in `ToolMessage.jsx` for richer rendering.

---

## 12. Notes for Future Reference

### Important rules to honor
1. **Never delete or modify existing AI tools.** Only append.
2. **Build module by module** in this order: Dashboard → CRM → PMS → HRM → Finance → Inventory → Mail → Communication → Settings.
3. **Always confirm the plan with the user before writing code** — the user explicitly asks "first tell me what you'll do" before each phase.
4. **Skip destructive operations** (`delete*`) — keep them UI-only.

### Conventions to keep matching
- Write tools: `isWrite: true` + `dryRun(args, ctx)` + `apply(args, ctx)`.
- Read tools: `handler(args, ctx)`.
- Permissions: `crm.read` / `crm.update` / `crm.create` (already established).
- Lead resolution: always use `resolveLead()` — supports ObjectId / trackingId / name fragment.
- Returns: always include `summaryText`, `uiHint`, and either `data` or `llmSummary`.
- Authorize via `isOwner || elevated`.
- All date-of-day logic must be IST-anchored (this is an India-based ERP).

### Things to remember
- The registry is the *only* place that knows about all tools — keep it tidy and section-commented.
- `summaryText` is what the AI verbally says back; `llmSummary` is what the AI reasons about for follow-up turns. Both matter.
- The dashboard does not have its own write actions — it's a view layer. Writes belong to the underlying modules.
- Memory files in `~/.claude/projects/.../memory/` persist across sessions and are the right place for "where we are" notes.

### Smoke-test command (copy-paste for verifying new tools)
```bash
cd backend && node -e "
const r = require('./src/modules/ai/services/tools.registry');
console.log('Total tools:', r.TOOLS.length);
['toolName1','toolName2'].forEach(n => {
  const t = r.get(n);
  console.log(' -', n, '=>', t ? 'OK' : 'MISSING',
              t?.isWrite ? '(write)' : '(read)');
});
"
```

---

**End of documentation — 27/05/26**
