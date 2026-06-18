# Sprint 3 Backlog — Multiple Assignees (Co-owners) for Delegations

**Type:** Enhancement
**Target:** Sprint 3 (alongside the deferred Department Head work)
**Status:** Classified — NOT for the Delegation v1.0 Release Candidate (RC1)
**Created:** 2026-06-18
**Branch:** prototype preserved on `feature/multi-assignee` (see "Implementation status")

> **RC1 scope is unchanged.** RC1 remains focused on B1, R5, R8, deployment
> readiness, and UAT. No multi-assignee (or other new Delegation functionality)
> is to be merged into the RC1 line.

---

## 1. Business justification

A delegation today has exactly one owner (`assignedTo`). Real cross-department
work frequently needs **more than one person attached** to the same item:

- **Shared accountability** — a deliverable that genuinely requires two
  departments to both act (e.g. Design + Procurement) and both be answerable.
- **Primary + support** — a doer plus a reviewer/helper who needs the same
  visibility, notifications, and ability to act.
- **Team / pool assignment** — hand a task to several people; whoever is free
  picks it up.
- **Handover continuity** — keep the outgoing owner attached during a
  transition rather than a hard cut-over.

**Caveat / open question:** most of these are *watcher* needs ("keep me
informed / let me help"), not true *co-ownership* ("we are jointly
accountable"). The model decision below must be made deliberately before build —
the prototype conflated the two.

## 2. Co-owner vs. watcher model (decide before build)

| | **Co-owners** (multiple `assignedTo`) | **Watchers** ("Keep in loop") |
|---|---|---|
| Semantics | Jointly accountable; all can act/transition | Informed only; no ownership |
| Accountability | Diluted — risk of "assigned to 4 ⇒ nobody owns it" | Clear — one owner remains |
| Reporting | Each co-owner counted in workload | Not counted as workload |
| Matches reference UI | Partially | Yes — reference had *Assign To* (one) + *Keep in Loop* (many) |

**Recommended model:** **Primary owner + watchers**, i.e. keep `assignedTo` as a
single primary owner and add a separate `watchers: [User]` array — this
preserves accountability and clean reporting while satisfying most of the
workflows above. If true co-ownership is required, introduce `assignedTo: [User]`
**with an explicit `primaryAssignee`** so accountability and metrics stay
unambiguous. *(The prototype implemented plain `assignedTo: [User]` with no
primary — not recommended as-is.)*

## 3. Migration requirements

- Existing delegations store `assignedTo` as a **single ObjectId**. Any
  array-based model needs a one-time backfill:
  ```js
  db.delegations.find({ assignedTo: { $type: "objectId" } }).forEach(d =>
    db.delegations.updateOne({ _id: d._id }, { $set: { assignedTo: [d.assignedTo] } }));
  ```
- Provide the migration as a runnable script under `backend/src/scripts/` with a
  dry-run mode and an idempotency guard.
- The `{ assignedTo: 1, status: 1 }` index becomes a multikey index
  (automatic — no action, but confirm query plans on large datasets).
- If the watcher model is chosen instead, no migration of `assignedTo` is needed
  (watchers default to `[]`).

## 4. Reporting implications

- **Workload double-counting:** the dashboard "Top Assignees" aggregation must
  `$unwind` assignees, so a delegation with N assignees contributes to N
  people's counts. Per-person totals can then exceed the number of delegations —
  this changes the meaning of every assignee-based metric and must be agreed
  with stakeholders (and footnoted in the UI).
- **"Is it assigned?" semantics** shift from a truthy field to an array length
  check across all reporting/filters.
- Decide whether dashboards count by **primary owner only** (clean) or **all
  attached people** (inflated but reflects load).

## 5. Notification implications

- Create / assign / reassign / status-change notifications must fan out to **all
  attached people** + creator (minus the actor). This increases in-app and
  **email** volume materially — review against the mail-queue throughput and
  noise tolerance (watchers may warrant a lighter notification tier than owners).
- Reassign currently **replaces the whole set**; product must decide whether the
  flow should support **add/remove individuals** vs. wholesale replace, and what
  each notifies.
- WhatsApp remains intentionally out of scope (consistent with MVP).

## 6. API / backward-compatibility notes

- **Inputs:** create/assign/reassign should accept a single id *or* an array
  (the prototype already does this) for a smooth transition.
- **Outputs (breaking):** `assignedTo` changes from a populated **object** to an
  **array**. Every consumer (frontend, exports, reports, any future mobile /
  integration) must be updated. Consider response versioning or a transition
  window.

## 7. Acceptance criteria (draft)

- [ ] Model decision ratified (primary+watchers **or** co-owners+primary).
- [ ] Migration script written, dry-run tested, idempotent.
- [ ] Reporting semantics agreed and reflected in dashboards (with UI footnote).
- [ ] Notification fan-out + volume reviewed and tiered.
- [ ] API contract documented; all consumers updated.
- [ ] Unit + integration tests (assign, reassign, scope/RBAC, dashboard counts).
- [ ] Manual QA against a seeded DB (not just build/lint).

## Implementation status (prototype)

A working prototype exists (model → array, validators accept single|array,
controller create/assign/reassign + notifications + dashboard `$unwind`,
multi-select `AssigneePicker`, `AssigneeGroup` rendering across list/detail).
It is **entangled in the working tree with the Delegation dashboard/modal UI
redesign** done in the same session. It is preserved on `feature/multi-assignee`
for reference and must **not** be merged into RC1. Treat it as a spike — revisit
the model decision (Section 2) before productionizing.
