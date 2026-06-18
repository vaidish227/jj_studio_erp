# Delegation v1.0 RC1 — UAT Feedback Template

> Use this to capture stakeholder findings during UAT. **Every finding must be classified** before it leaves UAT, so triage is unambiguous and v1.0 stays frozen. RC1 commit: `2ce659b`.

## Classification rules (apply to every finding)

| Class | Definition | Action |
|-------|-----------|--------|
| **Blocker** | Prevents core use or risks data integrity/security/access. Cannot ship/operate with it. | Fix before go-live. |
| **Bug** | Behaves incorrectly vs. intended v1.0 behavior, but a workaround exists. | Fix in a v1.0.x patch (priority by impact). |
| **Enhancement** | Works as designed; someone wants it better/different. **Not in frozen scope.** | Add to backlog. Do **not** implement in v1.0. |
| **Sprint 3 Candidate** | Requires a new capability already deferred (Department Head, Kanban, Calendar, Inbox, Reports, new permissions, workflow redesign). | Add to Sprint 3 backlog. Do **not** implement. |

> Tie-breakers: "It's broken and I can't work" → Blocker. "It's broken but I can work around it" → Bug. "It works but I wish…" → Enhancement. "We need a whole new screen/role/flow" → Sprint 3 Candidate.

---

## Finding log

| # | Date | Reporter | Role (HR / Employee / Assigner[mgr·md] / Admin) | Area (List / Detail / Create / Dashboard / Dept Admin / Notifications / Attachments) | Description (steps → expected → actual) | Severity (Hi/Med/Lo) | **Class** | Owner | Status (Open/Triaged/Fixed/Backlog) |
|---|------|----------|------|------|------|------|------|------|------|
| 1 | | | | | | | | | |
| 2 | | | | | | | | | |
| 3 | | | | | | | | | |
| 4 | | | | | | | | | |
| 5 | | | | | | | | | |

---

## Per-role prompts (to elicit findings)

**HR (`hr` — employee-tier, scoped)**
- Could you create the HR delegations you needed? Anything you expected to set but couldn't?
- After creating without an assignee, did the right person pick it up? How long did it take?
- Any confidential item you felt uncomfortable having visible? *(note → likely Sprint 3 Candidate re: dept-scoped visibility)*

**Employee (`designer`/`mis`/`marketing`/`accounts`/`supervisor`/`sales`)**
- Was it clear what to do after creating an unassigned delegation?
- Could you complete your work (status, checklist, comments, attachments) without help?
- Anything confusing, missing, or that errored?

**Assigner (`manager` / `md`)**
- Did you receive the "unassigned delegation" alert promptly? Too many/too few?
- Was triage + assignment fast enough, or a bottleneck? *(persistent bottleneck → note as Sprint 3 Candidate: Department Head)*
- Did the dashboard give you what you needed to manage the queue?

**Admin (`admin` / `md`)**
- Department create/edit/deactivate behaved as expected?
- Role/permission behavior correct for each tester?
- Any environment/integration issue (email not arriving, attachment failures)? *(→ usually Blocker/Bug, cross-ref the env checklist)*

---

## Triage summary (fill at end of each UAT cycle)

| Class | Count | Items (finding #s) |
|-------|-------|--------------------|
| Blocker | | |
| Bug | | |
| Enhancement (→ backlog) | | |
| Sprint 3 Candidate (→ backlog) | | |

**Go-live decision:** Blockers = 0 and all in-scope Bugs resolved or accepted → **GO**. Any open Blocker → **NO-GO**.

> Reminder: only **Blocker** and **Bug** items may result in code changes to v1.0. Enhancements and Sprint 3 Candidates are recorded and parked — do not implement against the frozen release.
