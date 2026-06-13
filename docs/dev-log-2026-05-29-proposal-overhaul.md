# Development Log — Proposal & Quotation Module Overhaul

**Name:** Vaidish
**Date:** 2026-05-29
**Working Duration:** Full-day session — Proposal & Quotation module bug-fix sweep, RBAC, bulk workflows, shared UI primitives, branch merge operations

---

## 1. Overview of the Day

### Summary

A focused, end-to-end overhaul of the **Proposal & Quotation System** module. The day combined four large workstreams:

1. **Feature work** — Excel/CSV template import, multi-client + multi-template selection with bulk-create, dashboard rework with milestone counts, themed `+91` phone input.
2. **Bug-fix sweep** — Comprehensive audit of the proposal module surfaced 50 issues; 48 were resolved across 6 iterative rounds.
3. **Reusable UI primitives** — Five shared components extracted/built so other modules can benefit: `Pagination`, `MultiPicker`, `PhoneInput`, `ImportTemplateModal`, plus a `milestoneFilter` util.
4. **Git operations** — Committed and pushed `feature/PMS-DDM` (56 files), then pulled `ADA_AI_IMPLEMENTAION` and `feature/PMS-DDM` into `merge_ADA_VAID` and published.

### Main Goals & Outcomes

| Goal | Outcome |
|---|---|
| Make proposal creation safe at production scale | 48 bugs fixed; cascade delete, RBAC, transaction safety, pooled Puppeteer all in place |
| Cut data-entry friction for sales | Bulk-create (1 proposal × N clients), Excel import → editable template, searchable multi-select pickers |
| Make every list scale beyond 25 records | Shared `Pagination` wired into 7 proposal list pages + CRM Clients page (refactor) |
| Match the JJ-Studio theme everywhere | New `PhoneInput` with `+91` prefix wired into 6 forms; date range filter now uses the same calendar as the Enquiry form |
| Surface live dashboard data | Cards count by milestone reached (not exact status), click-through to filtered list |
| Land the work cleanly | Comprehensive commit message, pushed to `feature/PMS-DDM`, merged into `merge_ADA_VAID` |

---

## 2. Tasks Performed (Step-by-Step)

### Phase 1 — Excel/CSV Template Import (~start of session)

- **Why:** JJ Studio's quotations already exist as Excel files. Re-keying every row into the `DynamicTableBuilder` was the friction point.
- **What:**
  - Built `ImportTemplateModal.jsx` modeled on the existing `ImportClientsModal` (CRM module).
  - Client-side parse via `xlsx@0.18.5` (already installed).
  - First row → template columns. Subsequent rows → template rows. Numeric columns auto-detected.
  - On confirm, navigates to `/proposal/templates/create` with parsed payload in `location.state`.
  - `TemplateEditorPage` reads `location.state.imported` to pre-fill the form, then clears history state so refresh doesn't re-import.
  - Caps at 500 data rows; warns on multi-sheet workbooks; "Download sample" CSV button.

### Phase 2 — Proposal/Quotation Module Audit

- **Why:** User reported "many bugs" in the module and asked for a thorough analysis.
- **What:** Read every file across 32 backend + 27 frontend files (~6,500 LOC) using a combination of `Explore` sub-agents (to map the surface) and direct file reads (to find the actual bugs).
- **Output:** A prioritised 50-bug report grouped by severity (critical / high / medium / polish).

### Phase 3 — Bug-Fix Sweep (6 iterative rounds)

| Round | Theme | Bugs fixed |
|---|---|---|
| 1 | Critical + High | 21 |
| 2 | Medium polish | 11 |
| 3 | RBAC / branding / projections / enum | 4 + 2 newly discovered security |
| 4 | Security / perf / calc / validation | 6 |
| 5 | Confirm modal / pagination / number-input feedback / Review actions | 4 |
| 6 | Version retention / transaction safety | 2 |

Notable headline fixes:

- **Syntax error** `} s` in `Boq_item.controller.js` causing every valid call to return 500 (ReferenceError caught by outer `try/catch`).
- **Invalid enum statuses** (`client_approved`, `internal_approved`) replaced with the correct values across ESign, Payment, Approval.
- **Race-prone tracking ID** `countDocuments()+1` replaced with deterministic `PRJ-${year}-${proposalId.slice(-8)}`.
- **Early-return in `signed` flow** removed so notifications + delivery telemetry still fire; auto-create-project blocks collapsed into one helper.
- **Advance payment field mismatch** (`method` vs `paymentMethod`) — schema field was being silently dropped.
- **Cascade-delete proposal dependents** (BOQ, ESign, Payment, Approval, Activity, ProposalVersion, CRMClient.linkedProposals); block if a Project already exists.
- **User schema password leak** — added `select: false` on the password field; auth flows opt in via `.select('+password')`.
- **PDF URL enumeration** — switched to `crypto.randomBytes(16).toString('hex')` for unguessable filenames.
- **Puppeteer pooled** — single shared browser, auto-relaunch on `disconnected`, SIGINT/SIGTERM cleanup.

### Phase 4 — Dashboard Rework

- **Why:** Stat cards counted by exact current status. Once a proposal moved past a milestone, the count dropped to zero (e.g. eSign Received card showed 0 even though eSign had been received because the proposal had auto-promoted to `project_ready`).
- **What:**
  - Built `milestoneFilter.js` util with shared predicates (`matchesMilestone`, `filterByMilestone`, `MILESTONE_LABELS`).
  - Dashboard cards now count by milestone reached, not exact status.
  - Each card routes to `/proposal/list?milestone=...` and the list page reads the param + applies the same predicate. Numbers can't drift between dashboard and list.
  - Added a chip on the list page showing the active milestone filter with a ✕ to clear.
  - Removed the dead `ReadyForProposalLeads` card from the dashboard.
  - Rebuilt `QuickActions` — featured "Create Proposal" CTA with a soft gradient + gold accent (after two iteration cycles for theme alignment).

### Phase 5 — Multi-Client + Multi-Template + Bulk-Create

- **Why:** Sales blasts the same quotation to multiple leads. Doing this one-by-one is wasteful.
- **What:**
  - Built generic `MultiPicker` shared component (searchable, checkbox list, chips, confirm-mode).
  - Wired it into `CreateProposalPage` for both client selection (live-commit, multi) and template selection (confirm-mode, multi-pick adds N sections at once).
  - `handleSave` now loops `crmService.createProposal()` with `Promise.allSettled` — one failure doesn't abort the rest. Per-row outcome toast (e.g. "2 sent for approval, 1 failed").
  - Header buttons relabel dynamically: `Save 5 Drafts` / `Send 5 for Approval`.
  - Totals card shows `Per Proposal` instead of `Final Amount` when ≥2 clients selected.
  - Edit mode locks the client picker to the existing proposal's client (disabled state).

### Phase 6 — ProposalClientsPage Multi-Select

- **Why:** The Proposal Client List page already shows pickable leads. User wanted to select several and bulk-draft.
- **What:**
  - Added per-row checkbox with selection state.
  - "Select all on this page" header with count.
  - Gold-themed bulk action bar appears when ≥1 selected: shows count + `Draft N Proposals` button + clear button.
  - On click: navigates to `/proposal/create?leadIds=id1,id2,id3` (comma-separated). `CreateProposalPage` reads `leadIds` param and pre-selects all matching leads.

### Phase 7 — 25/page Pagination Rollout

- **Why:** Every list page in the proposal module rendered every result at once. User wanted CRM's already-shipped 25/page pattern everywhere.
- **What:**
  - Extracted the inline `Pagination` component from `frontend/src/modules/crm/pages/ClientsListPage.jsx` into `frontend/src/shared/components/Pagination/Pagination.jsx`.
  - Refactored CRM Clients page to use the shared component (no behaviour change — regression check).
  - Wired into 7 proposal list pages (`ProposalListPage`, `ProposalTemplatesPage`, `ProposalApprovalPage`, `ProposalClientsPage`, `SentProposalDashboard`, `ApprovedDashboard`, `ApprovalDashboard`).
  - Common pattern: state `currentPage`, reset on filter change, `Math.ceil(filtered.length / 25)`, slice, render pagination footer only when `totalPages > 1`.
  - "Showing X–Y of Z" caption on the left, numbered pager on the right.

### Phase 8 — Filter Config Cleanup

- **Why:** Proposal Client List showed `Client Type → Individual / Corporate`. Should have matched CRM's `Project Type → Residential / Commercial`.
- **What:** Fixed `FilterConfig.js`'s `clients` config to use the correct label + enum values + search fields.

### Phase 9 — DateRangeFilter Theme Alignment

- **Why:** Date range filter used native `<input type="date">` (browser-default OS calendar). User wanted the same calendar as the Enquiry form.
- **What:** Swapped both inputs in `DateRangeFilter.jsx` for the shared `DatePicker` component. Widened the dropdown to 340px so the 300px DatePicker popover fits inside.

### Phase 10 — Themed Phone Input

- **Why:** Phone fields stored bare 10-digit numbers. User asked for automatic `+91` prefix matching the JJ-Studio theme.
- **What:**
  - Built `PhoneInput.jsx` shared component — fixed `+91` chip on left, digits-only input, max 10, emits full E.164 value via `onChange`.
  - Backwards-compatible: accepts both bare-digit and pre-prefixed values; strips the prefix for display.
  - Inline "Must be 10 digits" warning on blur.
  - Wired into 6 forms: CRM Enquiry Form, Client Info Form, Settings Create/Edit User + UserManagement, PMS Create Task Modal.
  - For the dense `AttendeesEditor` row, added a compact inline `+91` prefix instead of dropping in the full PhoneInput.

### Phase 11 — Git Operations

- **What:**
  1. Staged 56 files (51 modified + 5 new) and committed with a comprehensive multi-section message.
  2. Pushed to `origin/feature/PMS-DDM`.
  3. Switched to `merge_ADA_VAID`, pulled `ADA_AI_IMPLEMENTAION` (fast-forward, 28 files), then pulled `feature/PMS-DDM` (merge via `ort` strategy, 58 files). Zero conflicts.
  4. Pushed `merge_ADA_VAID` to origin.

---

## 3. Files Created / Modified

### New Files (5 frontend + 1 docs)

| Path | Purpose | Status |
|---|---|---|
| `frontend/src/shared/components/Pagination/Pagination.jsx` | Generic numbered pager (prev / 1 / 2 / … / N / next) with ellipsis logic. Auto-hides when `totalPages ≤ 1`. | New |
| `frontend/src/shared/components/MultiPicker/MultiPicker.jsx` | Generic searchable multi-select dropdown with chips, confirm-mode option, smart up/down popover positioning, Select-all / Clear header. | New |
| `frontend/src/shared/components/PhoneInput/PhoneInput.jsx` | Themed mobile/WhatsApp field with fixed `+91` prefix. Emits full E.164 value. | New |
| `frontend/src/modules/proposal/components/ImportTemplateModal.jsx` | Excel/CSV importer for quotation templates. Parses client-side via `xlsx`, hands payload to `TemplateEditorPage` via `location.state`. | New |
| `frontend/src/modules/proposal/utils/milestoneFilter.js` | Shared "milestone reached" predicates + `MILESTONE_LABELS`. Used by the dashboard cards (count) and `ProposalListPage` (?milestone= filter). | New |
| `docs/dev-log-2026-05-29-proposal-overhaul.md` | This dev log. | New |

### Modified Files (Backend — 23)

| Path | What changed |
|---|---|
| `backend/src/modules/auth/models/user.model.js` | `password` now `select: false`. |
| `backend/src/modules/auth/service/auth.service.js` | `loginUser` + `changePassword` opt-in via `.select('+password')`. |
| `backend/src/modules/crm/controllers/Proposal.controller.js` | Massive rework: deterministic trackingId, transactional auto-create-project helper, fixed advance-payment field, `signed` early-return removed, `$set` mixing fixed, totalAmount sync, enum-validated status filter, cascade delete logic, PDF integration. |
| `backend/src/modules/crm/routes/Proposal.route.js` | `requirePermission` middleware on every route. |
| `backend/src/modules/crm/utils/proposalPdf.js` | Dynamic column rendering (no more Item/Qty/Rate guess); safe `parseNum`; env-driven branding (`BRAND` constant); typo fix ("Laketown"); pooled Puppeteer browser; unguessable filename via `crypto.randomBytes`. |
| `backend/src/modules/proposal/controllers/Activity.controller.js` | `createdBy` taken from `req.user.id`, never the body. `populate('createdBy', 'name email role')`. |
| `backend/src/modules/proposal/controllers/Approval.controller.js` | Status enum validation, ObjectId guard, removed invalid `internal_approved`, stamp `approvedBy`. Field-projected populate. |
| `backend/src/modules/proposal/controllers/Boq.controller.js` | Field-projected `populate('proposalId', 'title status leadId finalAmount')` to stop leaking the entire proposal. |
| `backend/src/modules/proposal/controllers/Boq_item.controller.js` | Fixed syntax bug; added category enum + unit enum + numeric validation. |
| `backend/src/modules/proposal/controllers/Esign.controller.js` | `client_approved` → `esign_received`; sets esign subdoc. |
| `backend/src/modules/proposal/controllers/payment.controller.js` | `client_approved` → `payment_received`; sets payments subdoc. |
| `backend/src/modules/proposal/controllers/ProposalVersion.controller.js` | Retry loop on duplicate version number (E11000); best-effort prune to `PROPOSAL_VERSION_RETENTION` (default 50). |
| `backend/src/modules/proposal/controllers/Template.controller.js` | `createdBy: req.user?.id` on create. Pagination (`page`, `limit` capped at 200) + searchable. Delete blocked when in use. |
| `backend/src/modules/proposal/models/Payment.model.js` | Broadened `method` enum to match UI options. |
| `backend/src/modules/proposal/models/Proposal_version.model.js` | Unique index on `(proposalId, version)`. |
| `backend/src/modules/proposal/routes/Activity.route.js` | `requirePermission('proposal.read'/'proposal.update')`. |
| `backend/src/modules/proposal/routes/Approval.Route.js` | `requirePermission('proposal.read'/'proposal.create'/'proposal.approve')`. |
| `backend/src/modules/proposal/routes/Boq.route.js` | `requirePermission('proposal.read'/'proposal.update'/'proposal.delete')`. |
| `backend/src/modules/proposal/routes/Boq_item.route.js` | `requirePermission('proposal.update')`. |
| `backend/src/modules/proposal/routes/Esign.route.js` | `requirePermission('proposal.read'/'proposal.update')`. |
| `backend/src/modules/proposal/routes/Payment.Routes.js` | `requirePermission('proposal.read'/'proposal.update')`. |
| `backend/src/modules/proposal/routes/Proposalversion.Route.js` | `requirePermission('proposal.read'/'proposal.update')`. |
| `backend/src/modules/proposal/routes/Template_route.js` | `requirePermission('template.read'/'template.create'/'template.update'/'template.delete')`. |

### Modified Files (Frontend — 25)

| Path | What changed |
|---|---|
| `frontend/src/modules/crm/pages/ClientInfoFormPage.jsx` | Phone fields → `PhoneInput`. |
| `frontend/src/modules/crm/pages/ClientsListPage.jsx` | Refactored to use shared `Pagination`; inline copy removed. |
| `frontend/src/modules/crm/pages/EnquiryFormPage.jsx` | 3 phone fields → `PhoneInput`. |
| `frontend/src/modules/pms/components/CreateTaskModal.jsx` | WhatsApp number → `PhoneInput`. |
| `frontend/src/modules/proposal/approval/ApprovalDashboard.jsx` | 25/page pagination. |
| `frontend/src/modules/proposal/approved/ApprovedDashboard.jsx` | 25/page pagination. |
| `frontend/src/modules/proposal/components/ApprovalFormModal.jsx` | Stale-state reset (`useEffect([isOpen, proposal?._id])`), advance method field saved as `paymentMethod` (not `method`), memoised user name from localStorage. |
| `frontend/src/modules/proposal/components/ProposalPreviewModal.jsx` | Row-letter wrap fix (Excel-style aa/ab after z; non-header only). Dead handler buttons removed. Print CSS with `@page` + `page-break-inside`. Address path. "Laketown" typo fix. |
| `frontend/src/modules/proposal/dashboard/ProposalDashboard.jsx` | Milestone-based stats; `ReadyForProposalLeads` removed; cards route to `/proposal/list?milestone=...`; dead mock activity data deleted; broken `client_approved` filter option replaced with real enum values. |
| `frontend/src/modules/proposal/dashboard/components/QuickActions.jsx` | Redesigned: featured Create CTA with soft gradient + gold accent + live count badges on secondary actions. |
| `frontend/src/modules/proposal/dashboard/components/SummaryCard.jsx` | No behaviour change — small style consistency tweaks. |
| `frontend/src/modules/proposal/pages/CreateProposalPage.jsx` | Massive: multi-client picker, multi-template confirm-mode picker, `?leadIds=` (bulk) deep link support, bulk-create via `Promise.allSettled`, totals card shows "Per Proposal" in bulk mode, inline "Add more templates / Add Custom Table" beneath sections, controlled template select (no more `getElementById`), tolerant number parsing in subtotal calc, deep-clone template IDs to avoid React key collisions. |
| `frontend/src/modules/proposal/pages/ProposalApprovalPage.jsx` | Bulk action uses `Promise.allSettled` with per-row outcome; ConfirmationModal replaces `window.confirm`; broken `send` bulk button removed; `colSpan` fix; 25/page pagination. |
| `frontend/src/modules/proposal/pages/ProposalClientsPage.jsx` | Multi-select with checkboxes, "Select all on page" header, gold bulk-action bar, navigates to `/proposal/create?leadIds=...`; 25/page pagination. |
| `frontend/src/modules/proposal/pages/ProposalListPage.jsx` | Reads `?milestone=` and applies `filterByMilestone`; chip with clear button; items count from `content.sections[].rows`; 25/page pagination. |
| `frontend/src/modules/proposal/pages/ProposalTemplatesPage.jsx` | Import button → `ImportTemplateModal`; 25/page pagination. |
| `frontend/src/modules/proposal/pages/TemplateEditorPage.jsx` | Lazy `useState` reads `location.state.imported` for pre-fill; `replaceState` clears it on mount so refresh doesn't re-import. |
| `frontend/src/modules/proposal/review/ReviewPage.jsx` | Address path (`siteAddress.fullAddress`); `_id` slice guards; sent → eSign Received simple confirm; eSign Received → Advance Received simple confirm; dead 'modify' branch removed. |
| `frontend/src/modules/proposal/sent/SentProposalDashboard.jsx` | 25/page pagination. |
| `frontend/src/modules/settings/components/CreateUserForm.jsx` | WhatsApp number → `PhoneInput`. |
| `frontend/src/modules/settings/components/EditUserModal.jsx` | WhatsApp number → `PhoneInput`. |
| `frontend/src/modules/settings/pages/UserManagementPage.jsx` | WhatsApp number → `PhoneInput`. |
| `frontend/src/shared/components/AttendeesEditor/AttendeesEditor.jsx` | Compact inline `+91` prefix on phone field. |
| `frontend/src/shared/components/DynamicTableBuilder/DynamicTableBuilder.jsx` | Visual feedback on non-numeric cells in number-type columns; `inputMode="decimal"` instead of `type="number"`. |
| `frontend/src/shared/components/ProposalViewer/ProposalViewer.jsx` | "Laketown" typo fix. |
| `frontend/src/shared/components/index.js` | Re-exports `Pagination`, `MultiPicker`, `PhoneInput`. |
| `frontend/src/shared/filters/DateRangeFilter.jsx` | Swapped native date inputs for shared `DatePicker`. Widened dropdown. |
| `frontend/src/shared/filters/FilterConfig.js` | `clients` filter: `Client Type / Individual / Corporate` → `Project Type / Residential / Commercial` with schema-matching values + correct search fields. |

---

## 4. File Relationships & Data Flow

### Proposal Create flow (bulk)

```
ProposalClientsPage.jsx
    ├─ User ticks N clients via checkboxes
    └─ Click "Draft N Proposals"
            ↓ navigate(`/proposal/create?leadIds=id1,id2,...`)
CreateProposalPage.jsx
    ├─ useSearchParams() reads ?leadIds=
    ├─ MultiPicker (clients) pre-filled
    ├─ MultiPicker (templates, confirmMode) → addTemplatesFromPicker
    ├─ DynamicTableBuilder per section
    └─ handleSave(status):
            Promise.allSettled(
              selectedLeads.map(lead =>
                crmService.createProposal({...basePayload, leadId: lead._id})
              )
            )
            ↓ POST /api/proposal/create
backend/.../crm/controllers/Proposal.controller.js
    ├─ Validates leadId, creates Proposal, $addToSet linkedProposals on CRMClient
    └─ If status=pending_approval → updates lead lifecycleStage
```

### Dashboard → list flow

```
ProposalDashboard.jsx
    ├─ stats = useMemo: count by matchesMilestone(p, m) for each card
    └─ SummaryCard onClick → navigate('/proposal/list?milestone=...')
ProposalListPage.jsx
    ├─ useSearchParams() reads ?milestone=
    ├─ filterByMilestone(proposals, milestone)
    ├─ Then process(...) (AdvancedFilter pipeline)
    └─ Then pagination slice
```

Both screens import `matchesMilestone` from `proposal/utils/milestoneFilter.js` — the same predicate, so card count and list count can never drift.

### Template Import → Editor flow

```
ProposalTemplatesPage.jsx
    └─ "Import" button → opens ImportTemplateModal
ImportTemplateModal.jsx
    ├─ Reads xlsx/.xls/.csv via FileReader + xlsx.read()
    ├─ Builds { structure: {columns[], rows[]}, suggestedName }
    └─ onParsed(payload) → navigate('/proposal/templates/create', { state: { imported: payload } })
TemplateEditorPage.jsx
    ├─ Lazy useState reads location.state.imported (only when !isEditing)
    └─ useEffect on mount: window.history.replaceState({}, '') so refresh doesn't re-import
```

### Status update + auto-flow

```
Frontend (ReviewPage / ApprovalDashboard)
    └─ crmService.updateProposalStatus(id, { status, remarks })
            ↓ PATCH /api/proposal/updatestatus/:id
backend/.../crm/controllers/Proposal.controller.js: updateProposalStatus
    ├─ Role guard: APPROVAL_STATUSES + APPROVER_ROLES
    ├─ Status-specific $set: manager_approved → approved_by + approved_at, esign_received → esign subdoc, payment_received → payments + advancePayment subdocs
    ├─ findByIdAndUpdate with $set + $push to approvalHistory
    ├─ If status='signed':
    │     ├─ Override status to project_started, mark CRMClient converted
    │     └─ autoCreateProjectFromProposal (transactional via withFallbackTransaction)
    ├─ If status='manager_approved': triggerSendToClient (parallel email + WhatsApp via mail.service + whatsapp.service)
    ├─ If status='project_started': auto-create project too
    ├─ Auto-promote to project_ready when both esign.status='received' AND payments.status='received'
    ├─ notify() in-app notifications for manager_approved / sent / esign_received / signed
    └─ Response: { ...proposalObj, _autoCreatedProject?, delivery }
```

### Shared component dependency graph (new)

```
shared/components/index.js
    ├─ exports Pagination → used in CRM ClientsListPage + 7 proposal list pages
    ├─ exports MultiPicker → used in CreateProposalPage (clients + templates)
    └─ exports PhoneInput → used in 6 forms across CRM/PMS/Settings

shared/filters/DateRangeFilter.jsx
    └─ imports DatePicker (shared/components/DatePicker) — same as EnquiryFormPage

proposal/utils/milestoneFilter.js
    ├─ used by ProposalDashboard (stats)
    └─ used by ProposalListPage (?milestone= filter)
```

---

## 5. Components Breakdown

### `Pagination` (Reusable)

- **Type:** Reusable
- **Path:** `frontend/src/shared/components/Pagination/Pagination.jsx`
- **Purpose:** Compact numbered pager with prev/next + ellipsis for long page lists.
- **Props:**
  - `currentPage: number`
  - `totalPages: number`
  - `onChange: (page: number) => void`
- **Behaviour:** Renders `null` when `totalPages ≤ 1` so callers don't have to guard. Window: first, last, current, ±1 around current; gaps shown as "…".
- **Used in:** CRM ClientsListPage, ProposalListPage, ProposalTemplatesPage, ProposalApprovalPage, ProposalClientsPage, SentProposalDashboard, ApprovedDashboard, ApprovalDashboard.

### `MultiPicker` (Reusable)

- **Type:** Reusable
- **Path:** `frontend/src/shared/components/MultiPicker/MultiPicker.jsx`
- **Purpose:** Generic searchable, multi-select dropdown — replaces single `<Select>` when the user needs to pick many items.
- **Props:**
  - `items: T[]` — the source array
  - `value: T[]` — currently-selected items (controlled)
  - `onChange: (selected: T[]) => void`
  - `getId(item) => string|number` — required
  - `getLabel(item) => string`
  - `getSubtitle?(item) => string`
  - `getBadge?(item) => string`
  - `searchFields?: string[]` — keys to search across (default `['name']`)
  - `placeholder?`, `searchPlaceholder?`
  - `triggerIcon?: lucide Icon`
  - `disabled?: boolean`
  - `maxChips?: number` — visible chips before "+N more" (default 3)
  - `confirmMode?: boolean` — if true, selections are draft until user clicks `Add N selected`
  - `confirmLabel?: string`
  - `emptyText?: string`
- **Behaviour:** Checkbox on the LEFT of each row, soft gold tint when selected. Smart popover direction (auto-flips to upward when there's not enough space below). Select-all / Clear header. Chip area capped at `max-h-[60px]` overflow.
- **Used in:** `CreateProposalPage` for both client and template selection.

### `PhoneInput` (Reusable)

- **Type:** Reusable
- **Path:** `frontend/src/shared/components/PhoneInput/PhoneInput.jsx`
- **Purpose:** Themed mobile/WhatsApp field with a fixed `+91` country-code prefix.
- **Props:**
  - `label?: string`
  - `name: string`
  - `value: string` — accepts bare digits ("9876543210") or pre-prefixed ("+919876543210")
  - `onChange: ({ target: { name, value } }) => void` — fires synthetic event with full E.164 value
  - `onBlur?`, `error?`, `placeholder?`, `required?`, `disabled?`
  - `countryCode?: string` — default `'+91'` (extensible for future)
  - `className?: string`
- **Behaviour:** Strips digits-only, caps at 10. Emits empty string if input cleared (no spurious `+91`). Inline "Must be 10 digits" hint on blur unless parent passed an `error`.
- **Used in:** EnquiryFormPage, ClientInfoFormPage, CreateTaskModal, UserManagementPage, CreateUserForm, EditUserModal.

### `ImportTemplateModal` (Page-level helper)

- **Type:** Page-level (specific to Proposal Templates page)
- **Path:** `frontend/src/modules/proposal/components/ImportTemplateModal.jsx`
- **Purpose:** Excel/CSV import for quotation templates. Parses client-side, shows preview, hands payload to the editor.
- **Props:**
  - `isOpen: boolean`
  - `onClose: () => void`
  - `onParsed: (payload: { structure, suggestedName }) => void`
- **Behaviour:** Caps at 500 data rows. Warns on multi-sheet workbooks (only first sheet imported). Auto-detects numeric vs text columns based on cell content. Downloads a sample CSV.

### `milestoneFilter` (Utility module)

- **Type:** Utility / pure functions
- **Path:** `frontend/src/modules/proposal/utils/milestoneFilter.js`
- **Exports:**
  - `MILESTONE_LABELS` — human-readable map for `pending_approval` / `approved` / `rejected` / `sent` / `esign` / `advance`.
  - `matchesMilestone(proposal, milestone) → boolean` — predicate; treats downstream statuses as having implicitly passed earlier milestones.
  - `filterByMilestone(proposals, milestone) → proposal[]`
- **Used in:** ProposalDashboard (counts), ProposalListPage (filter).

### `QuickActions` (Page section)

- **Type:** Page-level (Proposal Dashboard right sidebar)
- **Path:** `frontend/src/modules/proposal/dashboard/components/QuickActions.jsx`
- **Purpose:** Featured "Create Proposal" CTA + secondary action list with live count badges.
- **Props:**
  - `pendingCount: number` — passed from ProposalDashboard's `stats`
  - `esignCount: number`
- **Behaviour:** Featured card has a soft gold gradient background, gold accent icon, dark title; secondary rows show icon, label, description, count badge (when > 0), chevron.

---

## 6. Reusable Components

These are intentionally generic and ready to drop into any other module.

### `Pagination`

- **Reusable because:** No domain knowledge. Just `currentPage / totalPages / onChange`. Self-hides on `totalPages ≤ 1`. Styled with project CSS vars.
- **Future uses:** Any list/table page across CRM (Leads/KIT/Converted/Lost), PMS (Project list, Task list, Vendor list), Settings (User list), Communication (Mail history, WhatsApp history).
- **Pattern to copy for new pages:**
  ```jsx
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [filters /* or whatever filter state */]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  ```

### `MultiPicker`

- **Reusable because:** Item shape is opaque — caller provides `getId/getLabel/getSubtitle/getBadge`. `searchFields` is a configurable string array. `confirmMode` toggles between live-commit and stage-then-commit behaviour.
- **Future uses:**
  - Meeting attendee picker (when redesigned).
  - Task assignee multi-pick (replacing single `EmployeePicker`).
  - Bulk-tag operations (Lead source tags, Project tags).
  - Recipient picker for ad-hoc WhatsApp/Mail blasts.

### `PhoneInput`

- **Reusable because:** Mirrors the shared `Input` API. Backwards-compatible with existing bare-digit DB values. `countryCode` prop allows future expansion beyond `+91` without refactor.
- **Future uses:** Vendor phone (PMS), WhatsApp Group manual phone entry, any new contact form.

### `milestoneFilter` util

- **Reusable because:** Single source of truth for milestone predicates. Any new view that wants to count or filter proposals by milestone uses the same function — counts can't drift.
- **Future uses:** Any new dashboard widget, any new list scope, any analytics export.

---

## 7. APIs / Services / Integrations

### Backend Routes Touched

| Method + Path | Permission | Purpose |
|---|---|---|
| `GET /api/proposal/get` | `proposal.read` | List proposals; status filter now enum-validated |
| `GET /api/proposal/get/:id` | `proposal.read` | Fetch single proposal |
| `POST /api/proposal/create` | `proposal.create` | Create proposal (called N times in parallel for bulk) |
| `PUT /api/proposal/update/:id` | `proposal.update` | Update proposal — proper `$set` + sync `totalAmount` |
| `PATCH /api/proposal/updatestatus/:id` | `proposal.update` | Status lifecycle; in-controller role guard for sensitive transitions |
| `POST /api/proposal/send/:id` | `proposal.send` | Manual resend |
| `DELETE /api/proposal/delete/:id` | `proposal.delete` | Cascade-deletes BOQ/ESign/Payment/Approval/Activity/Version + unlinks from CRMClient; blocked if a Project exists |
| `GET /api/Template/get` | `template.read` | List templates; new pagination + search |
| `GET /api/Template/getbyid/:id` | `template.read` | Fetch template |
| `POST /api/Template/create` | `template.create` | Create template; `createdBy: req.user?.id` |
| `PUT /api/Template/update/:id` | `template.update` | Edit template |
| `DELETE /api/Template/delete/:id` | `template.delete` | Blocked if any proposal still references it |
| `POST /api/boq/createBoq` | `proposal.update` | |
| `GET /api/boq/getBoq` | `proposal.read` | Field-projected populate |
| `GET /api/boq/get` | `proposal.read` | |
| `PUT /api/boq/updateBoq/:id` | `proposal.update` | |
| `DELETE /api/boq/delete` | `proposal.delete` | |
| `POST /api/boqitem/create` | `proposal.update` | Syntax bug fixed; full category/unit/numeric validation |
| `GET /api/Approve/get/:proposalId` | `proposal.read` | |
| `POST /api/Approve/create` | `proposal.create` | |
| `PATCH /api/Approve/update/:id` | `proposal.approve` | Enum-validated; stamps `approvedBy`; removed invalid `internal_approved` |
| `GET /api/esign/:proposalId` | `proposal.read` | |
| `POST /api/esign/create` | `proposal.update` | |
| `PUT /api/esign/sign/:id` | `proposal.update` | `client_approved` → `esign_received` + esign subdoc |
| `GET /api/payment/get/:proposalId` | `proposal.read` | |
| `POST /api/payment/create` | `proposal.update` | |
| `PUT /api/payment/status/:id` | `proposal.update` | `client_approved` → `payment_received` + payments subdoc |
| `POST /api/proposalversion/create` | `proposal.update` | Retry on E11000; best-effort prune |
| `GET /api/proposalversion/get/:proposalId` | `proposal.read` | |
| `GET /api/proposalversion/single/:id` | `proposal.read` | |
| `POST /api/activity/create` | `proposal.update` | `createdBy: req.user?.id` |
| `GET /api/activity/:proposalId` | `proposal.read` | Field-projected populate |

### Frontend Service Calls

- `crmService.getLeads({ lifecycleStage, limit })` — used by `ProposalClientsPage` and `CreateProposalPage` to populate the lead dropdown.
- `crmService.getTemplates(params)` — supports new `page` / `limit` / `search` query params; backwards-compatible default of 50.
- `crmService.createProposal(payload)` — called N times in parallel for bulk-create.
- `crmService.updateProposalStatus(id, { status, remarks, advancePayment?, paymentMethod?, ... })` — payload shape: object, not bare string (bug fix).
- `crmService.deleteProposal(id)` — now cascade-deletes on the backend; returns 409 if a Project exists.

### Integrations

- **WhatsApp** (`whatsappService`) — already exists; now receives unguessable PDF URLs and `+91`-prefixed recipient numbers.
- **Email** (`mailService`) — already exists; PDF attached as buffer.
- **Puppeteer** — now pooled (single shared browser instance, ~300MB amortised), auto-relaunch on disconnect, SIGINT/SIGTERM cleanup.

---

## 8. State Management / Logic

### State Patterns

- **Local component state** (`useState`) for all picker / pagination / modal / form state. No new global state introduced.
- **URL state** via `useSearchParams` for shareable / refreshable filtered views (`?milestone=...`, `?leadIds=...`, `?id=...`, `?leadId=...`).
- **Location state** (`location.state`) for one-shot payload handoff from `ImportTemplateModal` → `TemplateEditorPage`. Cleared via `window.history.replaceState({}, '')` on mount so refresh doesn't re-import.
- **Backend session/transactions** via the new `withFallbackTransaction(work)` helper — tries `mongoose.startSession().withTransaction(...)` first, falls back to non-transactional execution if the cluster reports it's standalone (error code 20).

### Key Logic

#### Cumulative milestone predicate (frontend)

```js
// proposal/utils/milestoneFilter.js
const POST_SENT     = ['sent', 'esign_received', 'payment_received', 'project_ready', 'project_started'];
const POST_ESIGN    = ['esign_received', 'payment_received', 'project_ready', 'project_started'];
const POST_PAYMENT  = ['payment_received', 'project_ready', 'project_started'];
const POST_APPROVED = ['manager_approved', ...POST_SENT];

export const matchesMilestone = (proposal, milestone) => {
  switch (milestone) {
    case 'pending_approval': return proposal.status === 'pending_approval';
    case 'approved':         return Boolean(proposal.approved_by) || POST_APPROVED.includes(proposal.status);
    case 'rejected':         return proposal.status === 'rejected';
    case 'sent':             return POST_SENT.includes(proposal.status);
    case 'esign':            return proposal.esign?.status === 'received' || POST_ESIGN.includes(proposal.status);
    case 'advance':          return proposal.payments?.status === 'received' || POST_PAYMENT.includes(proposal.status);
    default:                 return true;
  }
};
```

#### Bulk-create via `Promise.allSettled`

```js
// CreateProposalPage.jsx
const results = await Promise.allSettled(
  selectedLeads.map((lead) =>
    crmService.createProposal({ ...basePayload, leadId: lead._id })
  )
);
const ok = results.filter(r => r.status === 'fulfilled').length;
const failed = results.length - ok;
// Per-row outcome toast, then navigate to filtered list (>1) or review (=1)
```

#### Deterministic tracking ID

```js
// backend/.../crm/controllers/Proposal.controller.js
const buildProjectTrackingId = (proposalId) => {
  const year = new Date().getFullYear();
  const tail = String(proposalId).slice(-8).toUpperCase();
  return `PRJ-${year}-${tail}`;
};
```

#### Transactional auto-create-project with standalone fallback

```js
const isStandaloneError = (err) =>
  err?.code === 20 ||
  err?.codeName === 'IllegalOperation' ||
  /replica set/i.test(err?.message || '') ||
  /Transaction numbers/i.test(err?.message || '');

const withFallbackTransaction = async (work) => {
  let session = null;
  try {
    session = await mongoose.startSession();
    let result;
    await session.withTransaction(async () => { result = await work(session); });
    return result;
  } catch (err) {
    if (!isStandaloneError(err)) throw err;
    return work(null);
  } finally {
    if (session) await session.endSession();
  }
};
```

#### Pooled Puppeteer browser

```js
// backend/.../crm/utils/proposalPdf.js
let _browserPromise = null;
const getBrowser = async () => {
  if (!_browserPromise) {
    _browserPromise = launchBrowser().then(browser => {
      browser.on('disconnected', () => { if (_browserPromise) _browserPromise = null; });
      return browser;
    }).catch(err => { _browserPromise = null; throw err; });
  }
  return _browserPromise;
};
process.once('SIGINT', closeBrowser);
process.once('SIGTERM', closeBrowser);
```

#### Smart popover direction (MultiPicker)

```js
useLayoutEffect(() => {
  if (!open || !triggerRef.current) return;
  const rect = triggerRef.current.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  if (spaceBelow < POPOVER_MAX_HEIGHT && spaceAbove > spaceBelow) setDropDirection('up');
  else setDropDirection('down');
}, [open]);
```

---

## 9. Challenges Faced

### Round 1 — Hidden syntax error

- **Problem:** `Boq_item.controller.js` had `} s` after the validation if-block. Looked like a typo but `node -c` passed because ASI treated `s` as a separate statement.
- **Impact:** Every valid call to `POST /api/boqitem/create` threw `ReferenceError: s is not defined` at runtime, caught by the outer `try/catch` → returned a generic 500.
- **Resolution:** Removed the stray `s`; added explicit category/unit enum + numeric validation while in the area.

### Round 1 — Invalid status enum strings

- **Problem:** Three controllers (`Esign`, `Payment`, `Approval`) set `Proposal.status = 'client_approved'` / `'internal_approved'` — values that don't exist in the schema enum.
- **Impact:** Mongoose ValidationError → 500 → entire eSign / Payment / Internal-Approval flows broken.
- **Resolution:** Mapped each to the correct enum (`esign_received`, `payment_received`, no proposal-status change for internal approvals — they're recorded but don't drive proposal lifecycle).

### Round 1 — Bulk action sending bare string

- **Problem:** `ProposalApprovalPage.handleBulkAction` called `crmService.updateProposalStatus(id, status)` where `status` was a bare string like `"manager_approved"`. The service treated it as the request body.
- **Impact:** Backend received `JSON.parse("\"manager_approved\"")` → `req.body` empty → silent no-op while UI showed success.
- **Resolution:** Wrapped in `{ status }` and switched to `Promise.allSettled` with per-row outcome.

### Round 1 — Race condition on auto-created project tracking ID

- **Problem:** `count = (await Project.countDocuments()) + 1` is read-modify-write. Two simultaneous status transitions to `signed` or `project_started` would both compute the same count → duplicate `trackingId`.
- **Resolution:** Replaced with deterministic `PRJ-${year}-${proposalId.slice(-8)}` — collision-free without a counter document.

### Round 2 — User password leak via populate

- **Problem:** `User` schema had no `toJSON` strip and no `select: false`. Every `populate("createdBy"|"approvedBy")` returned the password hash.
- **Discovery:** Found while reading the auth model for a different concern.
- **Resolution:** Added `select: false` on the password field; updated `loginUser` and `changePassword` to opt-in via `.select('+password')`. Also added explicit field projections on populate calls in the proposal module's surface as defense-in-depth.

### Round 3 — Picker UX overlapping totals

- **Problem:** The `MultiPicker` popover opened downward and overlapped the "Final Amount" + "Generate Proposal" button in the sticky right sidebar.
- **Resolution:** Added `useLayoutEffect` measuring trigger rect on open; flips to `bottom-full mb-2` when there's less than ~360px below the trigger AND more space above.

### Round 4 — Dashboard cards reading wrong status

- **Problem:** Cards counted by exact current status. Backend auto-promotes proposals to `project_ready` once both eSign + payment are received, so the "eSign Received" card dropped to 0 even when eSign had clearly happened.
- **Resolution:** Built `milestoneFilter.js` with cumulative predicates. Dashboard and list page both use the same predicate so counts can't drift.

### Round 5 — DatePicker popover clipped inside DateRangeFilter

- **Problem:** Swapped native `<input type="date">` for shared `DatePicker` (which has its own 300px-wide popover). The 280px-wide DateRangeFilter dropdown clipped the calendar sideways.
- **Resolution:** Widened the dropdown to 340px so the calendar fits inside cleanly.

### Branch merge — `merge_ADA_VAID`

- **Problem:** Pulling two independent feature branches into a single integration branch carries conflict risk.
- **Resolution:** Fetched first; pulled `ADA_AI_IMPLEMENTAION` (fast-forward, no merge needed); then pulled `feature/PMS-DDM` which went via `ort` merge strategy without conflicts. Zero manual conflict resolution needed.

---

## 10. Improvements / Refactoring Done

### Architectural

- **Extracted inline `Pagination`** from CRM ClientsListPage into a shared component. CRM refactored to use the shared one — pure refactor, no behaviour change, verifies the extraction.
- **Replaced repeated phone-input logic** with a single `PhoneInput` component. Eight places now consistent.
- **Replaced repeated multi-select pattern** with a single `MultiPicker`. Two callsites today, but the API is generic enough for future bulk operations.
- **Single source of truth** for milestone predicates (`milestoneFilter.js`). Eliminates the entire class of "dashboard says 3, list shows 0" bugs.
- **`withFallbackTransaction` helper** abstracts the standalone-vs-replica-set distinction so other auto-create flows can opt into transactional safety without copy-pasting the fallback detection.

### Performance

- **Pooled Puppeteer browser** — was launching a fresh Chromium per PDF (~3s + 300MB each). Now a single long-lived instance, pages closed per render, browser auto-relaunches on disconnect.
- **Field-projected populates** — were returning full sub-documents (User, Proposal). Now select only the fields needed for the UI.
- **Server-side pagination** on `GET /api/Template/get` with a default `limit=50` (cap 200). Backwards-compatible with existing callers.

### Code quality

- **Replaced `window.confirm` / `alert`** in the proposal approval flow with the shared `ConfirmationModal` for visual consistency.
- **Removed `getElementById` direct DOM manipulation** in `CreateProposalPage` — made the template picker fully controlled.
- **Removed dead code:** `ReadyForProposalLeads`, mock activities array, broken ProposalPreviewModal handlers, broken "Send to Clients" bulk button, dead `modify` confirmation branch on ReviewPage.

### Defensive

- **`String(p._id || '').slice(...)` guards** across the dashboard / list / review pages — prevents the brief mid-load `_id` crash.
- **Enum validation** on `getProposals` status filter — typos now return 400 with `validStatuses[]` instead of silently returning `[]`.
- **Status guard** in `updateProposalStatus` — `manager_approved`/`rejected`/`revision_requested` can only be set by admin/md/manager, even with `proposal.update` permission.
- **Block-delete-if-in-use** on templates — refuses to delete with 409 + `proposalsUsing: N` count.
- **Block-delete-if-converted** on proposals — refuses if the proposal has been converted into a PMS Project (which would orphan the project).

### Security

- **`select: false`** on User.password.
- **`requirePermission(...)`** on every mutating route + in-controller role guard for sensitive lifecycle transitions.
- **Unguessable PDF filenames** via `crypto.randomBytes(16)`. URL stays publicly reachable (WhatsApp providers need that) but un-enumerable.
- **`createdBy` from `req.user.id`**, never the request body (Activity controller).

---

## 11. Pending Work / Next Steps

### Carry from the original 50-bug audit (all resolved or actively deferred)

- ✅ All 50 audit items resolved or wired with sensible defaults.
- ⚠️ **2 newly discovered pre-existing security issues** flagged + the User-password one fixed in scope; the public-static PDF mount mitigated via random filenames but a stronger fix (authenticated download endpoint) is still possible.

### Deploy checklist

1. **Seed Role permissions before deploying** — non-admin Role docs need the new slugs (`proposal.read/create/update/delete/send/approve`, `template.read/create/update/delete`). Admin's `*` wildcard is fine. **Without this, non-admin users get 403 on every proposal action after deploy.**
2. Optional env vars: `COMPANY_NAME`, `COMPANY_TAGLINE`, `COMPANY_ADDRESS_LINE1/2`, `COMPANY_EMAIL`, `COMPANY_MOBILE`, `COMPANY_OFFICE`, `COMPANY_SIGNOFF`, `PROPOSAL_VERSION_RETENTION` (default 50), `PUBLIC_BASE_URL`. All have JJ Studio defaults so nothing breaks if unset.
3. Existing User records unaffected by the `select: false` change — password is still stored, just not returned in default queries.
4. Existing phone records (bare 10-digit) display correctly in `PhoneInput` because it strips any leading prefix. Going forward, new entries get `+91XXXXXXXXXX`.
5. Old PDF files at `/static/proposals/proposal-{id}-{timestamp}.pdf` keep their old (guessable) names. Sweep / delete the directory if you want a clean slate; new files use 32-char random hex.
6. Puppeteer browser persists for the life of the Node process — expect ~300MB resident Chromium.

### Suggested follow-ups (not in scope today)

- **Authenticated PDF download** endpoint — replace the static `/static/proposals/...` URL with a signed-token `GET /api/proposal/pdf/:id` that streams from disk after auth check. Then WhatsApp send can use a short-lived signed URL.
- **CSV/Excel import for bulk-create** — same `ImportClientsModal` pattern; pre-select N clients in `CreateProposalPage`.
- **Server-side bulk endpoint** — `POST /api/proposal/bulk-create` that takes `{ leadIds[], ...payload }` and creates them server-side (currently the frontend loops). Becomes worthwhile at 50+ clients per blast.
- **Soft-delete pattern** — proposals and templates have hard-delete with cascade. A `deletedAt` field + filtered queries would let users undo.
- **Move all phone fields** that didn't get touched today (Vendor, Group Members manual entry) to `PhoneInput` for full consistency.

---

## 12. Notes for Future Reference

### Learnings

- **`node -c` passes ≠ runtime-safe.** The `} s` bug parsed fine syntactically; only ran when the if-branch was skipped. Catch-all `try/catch` blocks hide these. Lint with ESLint's `no-undef` to catch them at build time.
- **Mongoose enum violations bubble as ValidationError, not 400.** When the controller code path sets a status that's not in the schema enum, the outer `try/catch` catches it and returns 500. Worth being explicit about which statuses the controller is allowed to set.
- **Stat cards that count exact status drift fast** when the backend auto-promotes lifecycles. Cumulative milestone predicates are the right primitive — and sharing them with the destination list eliminates an entire class of "card says 3, list shows 0" complaints.
- **`Promise.allSettled` >> `Promise.all`** for any UI that maps over user-selected rows. One failure shouldn't kill the rest; per-row outcome is much friendlier.
- **`useLayoutEffect` for measure-then-paint logic** (popover direction) avoids the one-frame flicker you get with `useEffect`.
- **Backwards-compat in shared components** matters more than purity. The `PhoneInput`'s `value` prop accepts both bare-digit and prefixed values so we don't need a DB migration; same for `MultiPicker`'s `value` defaulting to `[]`.
- **`select: false` at the schema level** is a single-line, defense-in-depth fix that protects against every future populate that forgets a field projection.
- **Document a deploy checklist for any RBAC change**, no matter how small. The Role-permission seed step is easy to forget.

### Conventions Reinforced

- All shared components export both from their folder index AND from `frontend/src/shared/components/index.js` so they can be imported by name from the barrel file.
- Permission slugs follow `module.action` (e.g. `proposal.create`, `template.update`) — matches existing CommSettings, WhatsApp, PMS conventions.
- Filenames for new shared components: `<Name>/<Name>.jsx` (folder + file). Matches `Pagination`, `MultiPicker`, `PhoneInput`, plus existing `Modal`, `Button`, `DatePicker`.
- Backend route files apply `requirePermission(...)` directly in the route definition; the in-controller role check is the second line of defense for specific status transitions.

### Things to Watch

- **Old data with bare-digit phones** will continue to display correctly because `PhoneInput` strips. But if you ever migrate the DB to standardise on `+91...`, watch out for the few existing rows that already have `+91` (e.g. recent WhatsApp group adds) — don't double-prefix.
- **The `signed` status code path** is now multi-branch: writes esign + payments subdocs, marks lead converted, creates a Project, fires notifications, builds delivery payload. Any further edits to this flow should preserve the order so notifications + Project creation both happen before the response is built.
- **Puppeteer browser pooling** means a leak in any one PDF render will persist until process restart. Monitor RSS; if it grows without bound, force a relaunch.
- **`location.state` payload handoffs** (`ImportTemplateModal` → `TemplateEditorPage`) need the `window.history.replaceState({}, '')` clear on mount, otherwise a browser refresh re-applies the import on top of edits.

---

## Final Git State

| Branch | Commit | Status |
|---|---|---|
| `feature/PMS-DDM` (local + origin) | `c0f5b45` — `feat(proposal): full Proposal & Quotation module overhaul + shared UI components` | Pushed |
| `merge_ADA_VAID` (local + origin) | `c33f622` — merge from `feature/PMS-DDM` (after fast-forward from `ADA_AI_IMPLEMENTAION`) | Pushed |

**End of log.**
