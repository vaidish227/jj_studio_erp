# Delegation v1.0 RC1 — Production Smoke Test Runbook

> Run **after** the environment checklist passes ([delegation-prod-env-verification.md](delegation-prod-env-verification.md)) and **immediately after deploy**, before stakeholder UAT. RC1 commit: `2ce659b`.
>
> Goal: prove the critical paths work end-to-end in the real prod environment — especially the **B1 unassigned-create notification** (the release blocker that was fixed). Stop and triage on any ❌.

## Prerequisites / test fixtures

- [ ] Two+ test users provisioned in prod (clean up after):
  - **EMP** — an employee-tier role (`hr`/`mis`/`marketing`/`designer`/`accounts`): has `delegation.read/create/update`, **no** `delegation.assign`.
  - **MGR** — an assigner-tier role (`manager` or `md`): has `delegation.viewAll` + `delegation.assign/reassign`.
  - (Optional) **ADM** — `admin`.
- [ ] At least one **active department** exists (or deliberately test the zero-department path).
- [ ] Real inboxes (or a mail catcher) for EMP and MGR to confirm email.
- [ ] A small test file ready (PDF/PNG, < 20 MB) for the attachment test.

Record results inline. Clean up all test data at the end (§8).

---

## 1. Employee creates an UNASSIGNED delegation  *(B1 core path)*

| Step | Action | Expected | Result |
|------|--------|----------|--------|
| 1.1 | Log in as **EMP** | Sees the Delegation module | ☐ |
| 1.2 | Open "New Delegation" | The **"Assign to" field is hidden** (EMP lacks `delegation.assign`) | ☐ |
| 1.3 | Create with title + (optional) department, **no assignee** | 201; delegation saved with status `created`, `assignedTo` empty | ☐ |
| 1.4 | Note the `trackingId` (`DLG-YYYY-NNNN`) | Sequential, correct year | ☐ |

## 2. Assigner receives the unassigned-create notification  *(B1 fix)*

| Step | Action | Expected | Result |
|------|--------|----------|--------|
| 2.1 | Log in as **MGR**, open the notification bell | An in-app notification **"Unassigned delegation: \<title\>"** is present | ☐ |
| 2.2 | Confirm message text | "…created with no assignee and needs an owner." | ☐ |
| 2.3 | Click the notification | Deep-links to `/delegation/<id>` | ☐ |
| 2.4 | Confirm **EMP did not** get self-notified | EMP's bell has no copy of this alert | ☐ |
| 2.5 | (If ADM/MD exist) confirm they also received it | admin/md copied via dispatcher fallback | ☐ |
| 2.6 | **No email** sent for the unassigned alert | By design (in-app only) — MGR inbox has nothing for this event | ☐ |

## 3. Assignment flow

| Step | Action | Expected | Result |
|------|--------|----------|--------|
| 3.1 | As **MGR**, open the delegation, click Assign | Assignee picker loads (`GET /assignees`) | ☐ |
| 3.2 | Assign to **EMP** | 200; status → `assigned`, `assignedTo` = EMP, `assignedBy` = MGR | ☐ |
| 3.3 | Activity timeline updates | Shows an `assigned` entry by MGR | ☐ |
| 3.4 | (Reassign) As MGR, reassign to another user with a **reason** | 200; reason required and recorded; previous + new assignee notified | ☐ |

## 4. Email notification flow

| Step | Action | Expected | Result |
|------|--------|----------|--------|
| 4.1 | After §3.2 assignment, check **EMP inbox** | Receives "New delegation assigned: \<title\>" email | ☐ |
| 4.2 | Check in-app too | EMP bell shows assignment notification | ☐ |
| 4.3 | Confirm queue drained | `MailQueue` entry processed, no error/stuck | ☐ |

## 5. Attachment upload / download / delete

| Step | Action | Expected | Result |
|------|--------|----------|--------|
| 5.1 | As EMP/MGR, upload the test file | 201; appears in Attachments tab | ☐ |
| 5.2 | Reject path: try an unsupported type or > 20 MB | Rejected with a clear message (not a crash) | ☐ |
| 5.3 | Download via the signed URL | File opens / downloads correctly | ☐ |
| 5.4 | Delete the attachment | 200; removed from list **and** from S3 | ☐ |
| 5.5 | **R8 check:** open the Activity timeline | The delete is recorded as **`attachment_removed`** ("Removed attachment …"), not "added" | ☐ |

## 6. Full status lifecycle

Drive one delegation through every transition and confirm guards hold.

| Step | Transition | Expected | Result |
|------|-----------|----------|--------|
| 6.1 | `assigned → in_progress` | OK; `startedAt` set | ☐ |
| 6.2 | Add a checklist item, toggle it complete | Progress % updates | ☐ |
| 6.3 | Add a comment | Stakeholders notified in-app; appears in Comments | ☐ |
| 6.4 | `in_progress → review` | OK | ☐ |
| 6.5 | `review → completed` | OK; `completedAt` set | ☐ |
| 6.6 | `completed → reopened` | OK; `completedAt` cleared | ☐ |
| 6.7 | `reopened → in_progress → … → cancelled` | OK; `cancelled` is terminal | ☐ |
| 6.8 | Attempt an illegal transition (e.g. `completed → in_progress` directly) via API | Rejected (workflow guard) | ☐ |

## 7. Access scoping spot-check

| Step | Action | Expected | Result |
|------|--------|----------|--------|
| 7.1 | As EMP, open a delegation they neither created nor are assigned to (guess an id) | 404 (not visible, not leaked) | ☐ |
| 7.2 | As MGR (`viewAll`), open the same id | Visible | ☐ |
| 7.3 | As EMP, attempt to reach Department Admin actions | Cannot perform dept management (no `delegation.department.manage`) | ☐ |

## 8. Cleanup

- [ ] Delete/cancel all test delegations created above.
- [ ] Remove test attachments from S3.
- [ ] Deactivate/remove temporary test users (EMP/MGR/ADM) if created only for this run.
- [ ] Confirm no test notifications/emails left misleading real stakeholders.

---

## Result summary

| Section | Status (✅/❌) | Notes |
|---------|--------------|-------|
| 1 Unassigned create | | |
| 2 Assigner notification (B1) | | |
| 3 Assignment | | |
| 4 Email | | |
| 5 Attachments (incl. R8) | | |
| 6 Lifecycle | | |
| 7 Scoping | | |

**Gate:** §1, §2, §3, §6, §7 must be ✅ to proceed to UAT. §4/§5 may be ⚠️ only if email/attachments are explicitly deferred from the first UAT cycle.
