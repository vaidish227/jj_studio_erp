# Delegation v1.0 RC1 — Production Environment Verification Checklist

> Run **before** opening RC1 to stakeholders. All items are **configuration/deploy** checks — none require code changes. Tick each box and record the actual value/result in the "Result" column. RC1 commit: `2ce659b` on `ADA_TESTING`.

Legend: ✅ pass · ⚠️ degraded-but-acceptable · ❌ blocker (do not open UAT)

---

## 1. MongoDB replica-set configuration

The app connects via `process.env.MONGO_URI` ([backend/src/config/db.js](backend/src/config/db.js)). If the URI points at a single pinned node instead of the full replica set, **writes fail with 500 "not primary"** after any failover — every create/update/assign breaks.

| # | Check | How | Expected | Result |
|---|-------|-----|----------|--------|
| 1.1 | `MONGO_URI` present | Inspect prod env/secret store | Non-empty, credentials valid | ☐ |
| 1.2 | URI lists **all** replica-set members | Read the host list in the URI | All members enumerated (not one pinned host) | ☐ |
| 1.3 | `replicaSet=` param set | Read the URI query string | Matches the cluster's replica-set name | ☐ |
| 1.4 | Live write succeeds | Create + delete a test delegation via API | 201 then 200, no "not primary" | ☐ |
| 1.5 | Survives primary step-down (if testable) | Force/await a failover, retry a write | Write succeeds against new primary | ☐ |

---

## 2. S3 configuration (attachments)

Attachment upload/download/delete read these env vars ([backend/src/modules/pms/services/s3Storage.js](backend/src/modules/pms/services/s3Storage.js)). If unset, `isConfigured()` is false and **upload returns a clean 503** (no crash, but attachments are unusable).

| # | Env var | Required | Expected | Result |
|---|---------|----------|----------|--------|
| 2.1 | `AWS_REGION` | Yes | e.g. `ap-south-1` | ☐ |
| 2.2 | `AWS_ACCESS_KEY_ID` | Yes | Valid IAM key | ☐ |
| 2.3 | `AWS_SECRET_ACCESS_KEY` | Yes | Valid IAM secret | ☐ |
| 2.4 | `S3_BUCKET` | Yes | Prod bucket name | ☐ |
| 2.5 | `S3_DOCUMENTS_PREFIX` | Optional | default `documents` | ☐ |

| # | Check | How | Expected | Result |
|---|-------|-----|----------|--------|
| 2.6 | IAM perms | Confirm policy allows `PutObject`/`GetObject`/`DeleteObject` on the bucket/prefix | Allowed | ☐ |
| 2.7 | Live round-trip | Upload → download (signed URL) → delete an attachment | All succeed; object actually removed from S3 | ☐ |
| 2.8 | Bucket region matches `AWS_REGION` | AWS console | Match (avoids redirect/signing errors) | ☐ |

---

## 3. Mail / SMTP configuration (assignment emails)

Assignment/reassignment fire **email** (in addition to in-app). Email is sent via a **DB-backed queue** drained by a cron worker ([backend/src/modules/mail/cron/mailQueueProcessor.js](backend/src/modules/mail/cron/mailQueueProcessor.js)). Provider creds come from env **or** in-app Mail settings. Failures are swallowed (fire-and-forget) — so a misconfig is **silent**: users simply never receive mail.

| # | Check | How | Expected | Result |
|---|-------|-----|----------|--------|
| 3.1 | Provider credentials set | SMTP: `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS`; **or** Gmail: `EMAIL_USER` / `EMAIL_PASS`; **or** in-app Mail settings | One provider fully configured | ☐ |
| 3.2 | Mail-queue cron worker running | Confirm the queue processor is scheduled/alive in prod | Worker active, draining queue | ☐ |
| 3.3 | From/sender identity valid | Provider/sender config | Verified sender, not spam-flagged | ☐ |
| 3.4 | Live send | Trigger an assignment, watch the queue → inbox | Email enqueued **and** delivered | ☐ |
| 3.5 | Queue not backing up | Inspect `MailQueue` collection depth | Drains promptly, no stuck/failed pile-up | ☐ |

---

## 4. Role seed verification (RBAC)

Delegation access depends on role grants. The seed scripts are **additive/idempotent** (`$addToSet`) — safe to re-run. This is the **only DB-touching deploy step** (a seed execution, **not** a migration).

Scripts: [backend/src/scripts/seedRoles.js](backend/src/scripts/seedRoles.js), [backend/src/scripts/seedDelegationPermissions.js](backend/src/scripts/seedDelegationPermissions.js). Audit helper: `backend/src/scripts/checkRoles.js`.

| # | Check | How | Expected | Result |
|---|-------|-----|----------|--------|
| 4.1 | Seeds executed in prod | Run `seedRoles.js` then `seedDelegationPermissions.js` against prod DB | Complete without error | ☐ |
| 4.2 | New roles exist | Query `roles` collection | `mis`, `marketing`, `hr` present | ☐ |
| 4.3 | Assigner tier grants | Inspect `md` / `manager` role docs | Include `delegation.assign`, `delegation.reassign`, `delegation.viewAll` | ☐ |
| 4.4 | Employee tier grants | Inspect `hr`/`mis`/`marketing`/`designer`/`accounts`/`supervisor`/`sales` | Include `delegation.read`, `delegation.create`, `delegation.update` | ☐ |
| 4.5 | Department admin grant | Inspect `admin`/`md` | Hold `delegation.department.manage` (admin via `*`) | ☐ |
| 4.6 | No accidental over-grant | Spot-check `vendor`/`client` | **No** delegation permissions | ☐ |

---

## Sign-off

| Area | Owner | Status (✅/⚠️/❌) | Notes |
|------|-------|------------------|-------|
| Mongo (§1) | | | |
| S3 (§2) | | | |
| Mail (§3) | | | |
| Roles (§4) | | | |

**Gate:** Do not open UAT while any item is ❌. §2/§3 may launch ⚠️ only if attachments/email are explicitly out of the first UAT cycle's scope.
