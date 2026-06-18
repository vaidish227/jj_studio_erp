# Delegation MVP — UAT Package & Implementation Review

Scope under test: **Delegation MVP (Sprints 1–2)** — internal-only. Build state: backend APIs + workflow + notifications + frontend (List, Detail, Create, Dashboard-Lite, Department Admin). Tag: `delegation-sprint2`.

**Out of scope (deferred — do NOT test):** clients/portal/client-review, accept/reject step, full Inbox, Kanban, Calendar, subtasks, deliverables, templates, mentions, internal notes, effort/time tracking, workload planning, bulk ops, dependencies, audio/video attachments, WhatsApp, reporting/export, AI.

Reference facts:
- **Roles:** admin, md, manager, sales, supervisor, designer, accounts, mis, marketing, hr, vendor, client.
- **Permissions:** `delegation.read`, `delegation.viewAll`, `delegation.create`, `delegation.update`, `delegation.delete`, `delegation.assign`, `delegation.reassign`, `delegation.department.manage`.
- **Visibility scope:** `viewAll` (admin, md, manager) → all delegations; everyone else → only delegations they created or are assigned to. Out-of-scope `GET /:id` → 404.
- **Workflow statuses:** created → assigned → in_progress → review → completed → reopened; cancelled (from any non-completed). Allowed transitions are enforced server-side; illegal → 400 (no data change).
- **Notifications:** in-app + email (assignee/creator) on assign, reassign, status change, comment, cancel. WhatsApp not wired.
- **Departments:** optional; system works with zero departments; admin/MD manage; soft-deactivate keeps existing delegations valid.

---

## 1. UAT Checklist

Mark each ✅ Pass / ❌ Fail / ⏭ N/A and note the tester role + environment.

### A. Delegation creation
- [ ] Create a delegation with title only (no department) → succeeds; status = Created.
- [ ] Create with a department selected → department shown on detail/list.
- [ ] Create with priority Low/Medium/High/Urgent → priority chip correct.
- [ ] Create with a due date → due date shows; past due date shows overdue styling once saved.
- [ ] Create with checklist items added in the modal → items appear on detail, progress 0%.
- [ ] trackingId auto-generated in `DLG-YYYY-####` format, unique, increments.
- [ ] Title < 3 chars → blocked with validation message.
- [ ] Activity timeline shows a "created" entry.

### B. Assignment
- [ ] Assign an unassigned delegation to a user → assignee shows; status becomes Assigned.
- [ ] Assignee receives an in-app notification (bell) and a queued email.
- [ ] Activity timeline shows an "assigned" entry.
- [ ] Assignment controls are hidden for roles without `delegation.assign`.

### C. Reassignment
- [ ] Reassign to a different user with a reason → assignee updates.
- [ ] Both the new (and previous) assignee receive notification.
- [ ] Activity shows a "reassigned" entry with the reason.

### D. Status workflow
- [ ] Created → Assigned → In Progress → Review → Completed (each succeeds).
- [ ] Completed → Reopened succeeds.
- [ ] An illegal transition (e.g., Review → Created) is rejected with a clear message; status unchanged.
- [ ] In Progress stamps a start time; Completed stamps a completion time.
- [ ] Cancel from a non-completed state works; cancelling a completed delegation is blocked.
- [ ] Action buttons only show transitions valid for the current status.

### E. Checklist usage
- [ ] Add a checklist item → progress recalculates.
- [ ] Toggle an item complete → progress increases (e.g., 1/2 = 50%).
- [ ] Uncheck an item → progress decreases.
- [ ] Remove an item → progress recalculates.
- [ ] Progress bar in the header matches checklist completion.

### F. Comments
- [ ] Add a comment → appears in the Comments tab with author + timestamp.
- [ ] Stakeholders (assignee/creator) receive a comment notification.
- [ ] Activity shows a "commented" entry.

### G. Attachments
- [ ] Upload a PDF → appears in Attachments.
- [ ] Upload an image (PNG/JPG) → appears.
- [ ] Upload a document (docx/xlsx) → appears.
- [ ] Download an attachment → opens/downloads correctly.
- [ ] Delete an attachment → removed from list.
- [ ] Unsupported type (e.g., .exe) → rejected with a clear message.
- [ ] Oversized file (> 20 MB) → rejected.

### H. Notifications
- [ ] In-app bell increments on assign/reassign/comment/status events.
- [ ] Notification deep-links to the correct delegation.
- [ ] Email job is queued (verify in mail queue / inbox if SMTP live).
- [ ] Actor does NOT get notified of their own action.

### I. Dashboard (Lite)
- [ ] KPI tiles (Pending, Overdue, In Review, Completed) render.
- [ ] KPI counts reconcile with the list when filtered equivalently.
- [ ] Department workload bars reflect open delegations.
- [ ] Recent activity shows latest events.
- [ ] Counts are scoped to the viewer's role (employee sees only own).

### J. Department management
- [ ] Admin/MD can create a department (name → slug auto-derived).
- [ ] Edit name/color/order.
- [ ] Deactivate a department → disappears from the create dropdown but existing delegations keep it.
- [ ] Reactivate a department.
- [ ] System usable with zero departments (create still works, department optional).
- [ ] Manager/Designer/etc. cannot access Department admin (no nav item; URL blocked).

### K. Permission enforcement
- [ ] Employee sees only delegations they created or are assigned to.
- [ ] Opening another user's delegation by URL → 404 (not found / access denied).
- [ ] Manager/MD/Admin (viewAll) see all delegations.
- [ ] Roles without `delegation.create` cannot see the New Delegation button (n/a — all internal roles can create in MVP).
- [ ] Roles without `delegation.assign` cannot assign/reassign.
- [ ] vendor/client roles see no Delegation module at all.

---

## 2. Role-Based Test Scenarios

> Employee tier (Designer, MIS, Accounts, HR, Marketing) is **permission-identical**; they differ only by which department's work they handle and by their own-scope visibility. Scenarios are shown once for Designer and then noted as identical for MIS/Accounts/HR/Marketing with department-flavored data.

### MD (`delegation.*` incl. viewAll + department.manage; admin-equivalent for delegation)
- **Expected actions:** create, view ALL delegations, assign, reassign, change status, comment, checklist, attachments, manage departments, see org-wide dashboard.
- **Expected restrictions:** none within the delegation module (full oversight).
- **Test cases:**
  - UAT-MD-01: View dashboard → KPIs reflect org-wide totals (not just own).
  - UAT-MD-02: Open a delegation created by a designer → succeeds (viewAll).
  - UAT-MD-03: Create a department, then create a delegation in it, then deactivate it → existing delegation still valid.
  - UAT-MD-04: Reassign a delegation between two departments' users → succeeds.

### Manager (viewAll, create, update, delete, assign, reassign — NO department.manage)
- **Expected actions:** create, view ALL, assign/reassign, status changes, delete (cancel), comment, checklist, attachments, org-wide dashboard.
- **Expected restrictions:** **cannot** create/edit/deactivate departments (admin/MD only).
- **Test cases:**
  - UAT-MGR-01: View all delegations across departments (viewAll).
  - UAT-MGR-02: Assign a delegation to a designer → designer notified.
  - UAT-MGR-03: Attempt to open Department admin → blocked / no nav entry.
  - UAT-MGR-04: Cancel an in-progress delegation → status Cancelled, activity logged.
  - UAT-MGR-05: Drive a delegation through the full legal workflow.

### Designer (read own, create, update own — NO viewAll, assign, delete, department.manage)
- **Expected actions:** create delegations; view delegations they created or are assigned to; update their own (status, checklist, comments, attachments); see own-scoped dashboard.
- **Expected restrictions:** cannot see others' delegations; cannot assign/reassign (no assignee picker); cannot delete; cannot manage departments.
- **Test cases:**
  - UAT-DSGN-01: Create a delegation → appears in own list.
  - UAT-DSGN-02: Open a colleague's delegation by URL → 404.
  - UAT-DSGN-03: On an assigned delegation, move In Progress → Review; upload a deliverable file; add checklist progress.
  - UAT-DSGN-04: Confirm no Assign/Reassign buttons and no assignee field in the create modal.
  - UAT-DSGN-05: Dashboard shows only own delegations' counts.

### MIS / Accounts / HR / Marketing (identical permissions to Designer)
- **Expected actions / restrictions:** same as Designer.
- **Test cases (per role, department-flavored):**
  - UAT-MIS-01: Create "Monthly MIS report" → own list; assigned by a manager later.
  - UAT-ACCT-01: Create "GST filing Q1"; complete checklist; move to Review.
  - UAT-HR-01: Receive an assigned "New-hire onboarding"; comment; attach offer letter (PDF).
  - UAT-MKTG-01: Create "Instagram campaign assets"; verify cannot view a designer's unrelated delegation (404).
  - UAT-xxx-02 (all): confirm own-scope visibility + no assign/department controls.

### Cross-role
- UAT-X-01: Manager assigns to MIS user → MIS user sees it (now in scope) and is notified.
- UAT-X-02: After reassignment away from a user, that user no longer has edit actions (still in scope if creator).

---

## 3. Feedback Collection Template

One row per piece of feedback (spreadsheet or form).

| Field | Values / notes |
|---|---|
| ID | FB-### |
| Date | |
| Tester name | |
| Tester role | MD / Manager / Designer / MIS / Accounts / HR / Marketing |
| Area | Creation / Assignment / Workflow / Checklist / Comments / Attachments / Notifications / Dashboard / Departments / Permissions / Other |
| Type | **Feature request** / **UX issue** / **Bug** / **Missing workflow** / **Performance** |
| Title | one line |
| Description | what happened / what was expected |
| Steps to reproduce | (bugs) |
| Screenshot / trackingId | |
| Severity (if bug) | Critical / High / Medium / Low (see §4) |
| Frequency | Always / Often / Sometimes / Once |
| Business impact | Blocks work / Slows work / Cosmetic |
| Suggested outcome | what the tester wants |
| Triage decision | (filled by team) Must / Should / Nice / Future / Reject |

Prompts to give testers per type:
- **Feature request:** "What can't you do today that you need to?"
- **UX issue:** "Where did you get confused, click the wrong thing, or expect something else?"
- **Bug:** "What did you do, what happened, what should have happened?"
- **Missing workflow:** "What real-life step in your process has no home in the tool?"
- **Performance:** "What felt slow? Roughly how long? How many records were involved?"

---

## 4. Bug Classification Framework

| Severity | Definition | Examples | Target response |
|---|---|---|---|
| **Critical** | Data loss/corruption, security/permission breach, or core flow completely broken with no workaround. | Out-of-scope user can read/edit another's delegation; assignment silently lost; app crash on create; illegal transition mutates data. | **Release blocker.** Fix before launch. |
| **High** | Major feature broken or wrong for most users; workaround painful. | Notifications never sent; status workflow allows an invalid path; attachment upload fails for valid PDFs; dashboard counts materially wrong. | Fix before launch unless a safe workaround is documented. |
| **Medium** | Feature works but with notable defects/limitations; reasonable workaround exists. | Progress % off by rounding; activity verb mislabeled; list not paginated for large sets; minor validation gap. | Schedule in Sprint 3. |
| **Low** | Cosmetic / minor UX / copy. | Chip color/spacing, label wording, tooltip missing. | Backlog; batch later. |

### Release-blocker criteria (launch is blocked if ANY is true)
1. Any **Critical** bug open.
2. A **permission/scope** defect lets a user see or modify data outside their scope.
3. A **data-integrity** defect (lost/duplicated/wrong-state records; trackingId collisions).
4. A core happy-path (create → assign → work → complete) cannot be completed by its intended role.
5. ≥ 2 **High** bugs in the same core area with no acceptable workaround.

Launch may proceed with documented Medium/Low items deferred to Sprint 3.

---

## 5. Sprint 3 Prioritization Matrix (fill after UAT)

Classify each triaged feedback item. Use the guidance to keep scope honest.

| Bucket | Definition | Enter Sprint 3? |
|---|---|---|
| **Must Have** | Release blockers + High bugs + workflow gaps that prevent real use by a target role. | Yes — top of Sprint 3. |
| **Should Have** | Strong value, frequently requested, no safe workaround, moderate effort. | Yes if capacity allows after Must. |
| **Nice to Have** | Real improvement but low frequency or easy workaround. | Only if cheap / opportunistic. |
| **Future Consideration** | Already-deferred Phase 2/3 features, or speculative ideas needing more validation. | No — backlog. |

Template rows:

| FB-ID | Title | Type | Severity | Frequency | Effort (S/M/L) | Bucket | Notes |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

Pre-seeded candidates (known gaps, pending UAT to confirm priority):
- Accept/Reject step before In Progress — *likely Must/Should*.
- Unified Inbox (assigned-to-me / awaiting-approval / overdue) — *likely Should*.
- List pagination UI for large result sets — *Should once volume grows*.
- Activity verb fixes (generic edit / attachment-removed) — *Should (data-quality/debt)*.
- Gate `assignedTo`-on-create behind `delegation.assign` — *Should (authorization tightening)*.
- Automated test suite — *Must (engineering quality gate)*.

---

## 6. Review of Existing Implementation

### Technical debt
- **Activity verb reuse:** generic edits log `status_changed`, and attachment *removal* logs `attachment_added`. The `DelegationActivity` action enum has no `updated`/`attachment_removed`. → Add those enum values and use correct verbs (cheap; improves audit clarity).
- **Controller size:** `delegation.controller.js` is large (~17 handlers). Comments/attachments could be split into sub-controllers for readability (low urgency).
- **MailQueue linkage:** delegation emails are stored with `relatedTo.module: "system"` (the MailQueue enum has no `delegation`). Linkage works but is coarse. → Add `delegation` to the MailQueue enum when convenient.
- **Dashboard date range:** Dashboard-Lite has no date filter (counts are point-in-time/all-time). Plan envisioned a shared `GlobalDateFilter`; deferred. Fine for MVP.

### Refactoring opportunities
- Extract a shared `findInScope`/`scopeFilter` helper to a service if scoping is reused by future endpoints (Inbox, reports).
- Centralize the status→action-verb mapping (already in workflow service) and reuse for the generic update path.
- Frontend: factor the repeated `inputCls` Tailwind string into one shared input component.

### Missing automated tests (largest engineering gap)
- **No committed tests.** The Sprint-2 verification used a throwaway smoke harness (deleted). → Convert it into a committed **Jest + supertest** suite:
  - Unit: workflow `canTransition`/`buildStatusPatch`, `computeProgress`, scope-filter builder.
  - Integration: the 40 smoke assertions (create/assign/reassign/workflow legality/checklist/comments/attachments/scope/dashboard/departments) running against a test DB.
- Recommend this lands in Sprint 3 as a quality gate before more features stack up.

### Security concerns
- ✅ **Scoping is solid:** server-side filter guards list and `GET /:id` (404), verified in smoke tests. Internal-only (no client/vendor grants).
- ⚠️ **`assignedTo` on create is not gated by `delegation.assign`.** A creator (e.g., designer) could pre-assign anyone via the API (the UI hides the field). Low real risk (internal users), but tighten by validating `assignedTo`-on-create against `delegation.assign`. *(Recommended Should.)*
- ✅ Attachment mimetype allowlist + 20 MB cap enforced. (No AV/content scanning — platform concern, out of scope.)
- ✅ Department management restricted to admin/MD.

### Performance concerns
- ✅ Hot-path indexes present (`{assignedTo,status}`, `{departmentId,status}`, `{status,dueDate}`, etc.).
- ⚠️ **Search uses regex** on `title` (`$regex`/`i`) rather than the text index → won't scale to very large sets; fine at MVP volume. Switch to `$text` if search slows.
- ⚠️ **Scoped recent-activity** for non-viewAll users does `Delegation.find(scope).select(_id)` then `$in` — acceptable now; revisit if a single user owns thousands of delegations.
- ✅ Notifications are fire-and-forget (don't block requests); email is queued (async processor).
- No dashboard caching — unnecessary at current scale.

---

## Final Recommendation — next release focus

**Recommendation: Option A — Inbox + Accept/Reject workflow — as the functional core of Sprint 3, bundled with the engineering quality gate (automated tests) and the two cheap debt/authorization fixes.** Defer Option B (analytics + workload) to a later sprint.

Why A over B:
- **A is high-frequency, low-risk value.** Discovery ("what needs me?") and assignee agency (accept/reject) are the two most-felt gaps for *every* role, every day. Both are small, additive, and build directly on existing scope/workflow primitives.
- **B has a data dependency.** Meaningful workload/capacity analytics need `estimatedHours` + capacity fields that the MVP intentionally omitted. Building B first means first capturing that data and accumulating history before the charts are useful — a bigger, lower-immediate-payoff lift.
- **A de-risks B later.** Accept/Reject and Inbox generate cleaner status/throughput signal that analytics will later consume.

Bundle into Sprint 3 regardless of A/B/C:
1. Automated test suite (Must — quality gate).
2. Activity-verb fixes + gate `assignedTo`-on-create behind `delegation.assign` (cheap, correctness/authorization).

**Caveat (important):** this recommendation is **provisional until UAT feedback arrives.** If UAT surfaces a hotter, higher-frequency pain point (Option C), run it through the §5 matrix — Must-Have UAT items and any release-blocker bugs outrank the A/B choice. Lock the Sprint 3 scope only after triaging UAT.

---

*Generated for UAT prep. No functionality implemented in this phase. No source-control actions taken.*
