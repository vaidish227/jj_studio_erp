# KIT Module — Communication Automation Engine

> **Status: Phases 0–8 complete.** This module is the orchestration plane for
> KIT ("Keep In Touch"). It sits **on top of** the existing delivery infrastructure
> (`mail/`, `whatsapp/`, `notifications/`, `communication/`) and reuses it as the
> execution substrate — it does not re-implement sending, queueing, or logging.
>
> Templates → Campaigns → Workflows → Scheduler → Timeline → Analytics, all live.
> See the "Production hardening" section at the end for operational guarantees.

## Architectural principle

```
 Templates → Campaigns → Workflows/Rules → Triggers → Campaign Scheduler   (KIT — this module)
        │            │              │             │
        ▼            ▼              ▼             ▼
 queueService.enqueue() → MailQueue / WhatsAppQueue → cron processors →     (existing delivery plane)
 providers (MayTAPI / Gmail/SMTP) → MailLog / WhatsAppLog + Notification
```

To send anything (now or scheduled), KIT calls the existing
`mail.queue.service.enqueue()` / `whatsapp.queue.service.enqueue()` with a
`scheduledFor` date and `relatedTo: { module: "kit", recordId }`. The existing
per-minute cron processors handle delivery, retries (exponential backoff), and
audit logging. Delays/scheduling are already solved at the delivery layer.

## Planned structure (built phase by phase — see the approved plan)

```
kit/
├── constants/
│   └── variableCatalog.js      ✅ Phase 0 — {{placeholder}} catalog (source of truth)
├── models/                     ⛔ Phase 1 — kit_templates, kit_campaigns, kit_campaign_steps,
│                                            kit_enrollments, kit_workflows, kit_trigger_events,
│                                            kit_scheduled_jobs, kit_message_logs
├── services/                   ⛔ Phase 2-4 — variableResolver, dispatchService, campaignEngine,
│                                              triggerService, conditionEvaluator
├── controllers/                ⛔ Phase 2+ — templates / campaigns / workflows / timeline / analytics
├── routes/                     ⛔ Phase 2+ — mounted at /api/kit
├── validators/                 ⛔ Phase 2+ — request validation
└── cron/
    └── campaignScheduler.js    ⛔ Phase 3 — claims due kit_scheduled_jobs (atomic, mirrors
                                             mailQueueProcessor) and advances enrollments
```

## Phase 0 changes already applied

- `"kit"` added to the `relatedTo.module` enum in `MailQueue`, `WhatsAppQueue`,
  `MailLog`, `WhatsAppLog` — so KIT-originated sends are attributable.
  (`Notification.relatedTo.module` is a free-form String — no change needed.)
- `kit.manage` permission added to `Role.model.js` `ALL_PERMISSIONS`, the frontend
  `permissions.js` constants/module actions, and granted to the `manager` role in
  `seedRoles.js`. This closes a latent gap: the nav already referenced `kit.manage`
  for the "Timeline Settings" item but the permission did not exist in the catalog.
- `constants/variableCatalog.js` added.

## Reused infrastructure (do not duplicate)

| Concern            | Reuse                                                                 |
|--------------------|----------------------------------------------------------------------|
| Send / schedule    | `mail/service/mail.queue.service.js`, `whatsapp/service/whatsapp.queue.service.js` |
| Template rendering | `renderTemplate()` in `mail.service.js` / `whatsapp.service.js` (`{{var}}`) |
| Delivery cron      | `mail/cron/mailQueueProcessor.js`, `whatsapp/cron/whatsappQueueProcessor.js` |
| In-app notify      | `notifications/services/notificationDispatcher.js` (`dispatch()`)    |
| Channel config     | `communication/models/CommSettings.model.js`                         |
| Audit logs         | `MailLog`, `WhatsAppLog`, `Notification`                             |
| Cron startup       | `backend/src/index.js` (add `startCampaignScheduler()` in Phase 3)    |

## ⚠️ WhatsApp module deprecation note

There are **two** WhatsApp modules in the codebase:

- **`backend/src/modules/whatsapp/`** — ✅ **canonical.** Provider abstraction
  (MayTAPI active, Twilio stub), queue + processor + log + templates, routes at
  `/api/whatsapp`. **KIT uses this one.**
- **`backend/src/modules/whatspp/`** (note the typo) — ⛔ **legacy / deprecated.**
  Older welcome-message scheduler that writes to `CRMClient.communicationLogs`.

KIT must integrate **only** with `whatsapp/`. The legacy `whatspp/` module is left
in place for now (no deletion in Phase 0 to avoid regressions in any existing
welcome-message flow) but should not be extended. A later cleanup phase should
migrate its welcome-message behaviour into a KIT workflow and remove it.

---

# Production hardening (Phase 8)

## Concurrency / multi-instance safety

All KIT background work uses **atomic claim** semantics, so running multiple app
instances (each with its own `node-cron`) never double-processes a unit of work:

- `campaignScheduler` claims a `KitScheduledJob` with a single
  `findOneAndUpdate({status:"pending", runAt:$lte}, {$set:{status:"processing"}})`
  — the same pattern the mail/whatsapp queue processors use. Only one instance
  wins each job.
- Campaign step sends are enqueued onto `MailQueue`/`WhatsAppQueue`, which the
  existing processors also claim atomically.

There is **no distributed lock**; correctness relies on MongoDB's atomic
single-document update. This is safe for any number of instances.

## Idempotency

- **Enrollment**: a partial-unique index on `kit_enrollments`
  `(campaignId, entityType, entityId)` where `status:"active"` guarantees at most
  one active enrollment per (campaign, entity). `campaignEngine.enroll` checks
  first and also catches the duplicate-key error → re-enrolling is a no-op.
- **Step advance**: each fired job creates exactly one next job; a job is claimed
  once (atomic) and marked terminal, so a step cannot fire twice.
- **Known limitation — workflow send dedup**: if the *same* business event is
  emitted twice (e.g. a controller path that double-saves), a workflow's
  `send_template`/`notify` actions can run twice. `start_campaign` is protected by
  the enrollment index, but one-off sends are not deduplicated. Emit points are
  placed after the persisted state change to minimise this; add a dedup key if a
  specific event proves chatty.

## Retries & backoff

| Worker | Retry policy |
|--------|--------------|
| `mailQueueProcessor` / `whatsappQueueProcessor` | 3 attempts, backoff 5 / 15 / 45 min |
| `campaignScheduler` (KitScheduledJob) | `maxAttempts` 3, backoff 1 / 3 / 9 min |

Paused campaign/enrollment → the job **defers** (re-pends ~1h later) rather than
failing, so journeys resume when reactivated.

## Retention (`cron/kitMaintenance.js`, daily 03:45)

Conservative auto-purge of disposable operational data only:

| Collection | Policy | Env override |
|------------|--------|--------------|
| `kit_scheduled_jobs` | terminal (done/cancelled/failed) older than 30d | `KIT_JOB_RETENTION_DAYS` |
| `kit_trigger_events` | older than 180d | `KIT_TRIGGER_RETENTION_DAYS` |

**Never auto-purged** (business data): `kit_message_logs` (timeline + analytics),
`kit_enrollments`, `kit_campaigns`, `kit_campaign_steps`, `kit_workflows`,
`kit_templates`. Pending/processing jobs are never touched.

## Permission matrix (`/api/kit/*`)

| Area | Read | Write / manage |
|------|------|----------------|
| Templates | `kit.tab.templates` | `kit.manage` |
| Campaigns | `kit.read` | create `kit.create`, edit/steps/enroll `kit.update`, delete `kit.manage` |
| Enrollments | `kit.read` | stop `kit.update` |
| Workflows | `kit.read` | `kit.manage` |
| Timeline / Messages / Analytics / Triggers | `kit.read` | — |
| Delivery settings (`/communication/settings`) | `communication.settings.manage` | `communication.settings.manage` |

> Note: the KIT Settings page is nav-gated by `kit.manage` but its API requires
> `communication.settings.manage`. Manager/admin roles hold both; grant
> `communication.settings.manage` to any other role that needs the settings page.

## Trigger events — wired vs available

Emitting today: `lead.created`, `lead.status_changed`, `lead.won`, `lead.lost`,
`proposal.sent`, `payment.received`, `project.created`.

Catalogued (selectable in the builder) but **not yet emitting** — each needs a
one-line `kitEvents.emit()` at the relevant controller: `lead.assigned`,
`meeting.scheduled`, `meeting.completed`, `proposal.created`, `proposal.approved`,
`proposal.rejected`, `milestone.completed`, `task.completed`, `site_visit.scheduled`.

## Manual smoke / load test checklist

Requires the app running against Mongo (the automated checks here only cover
compilation, wiring, and pure logic — not live DB behaviour).

1. **Template** → create a WhatsApp template `Hi {{client_name}}` → preview renders sample data.
2. **Campaign** → add a step with delay `0 days` → activate → enroll a test lead.
3. Within ~1 min, confirm a `WhatsAppQueue` row appears (`relatedTo.module:"kit"`),
   then a `WhatsAppLog` "sent", a `kit_message_logs` row, and the enrollment advances.
4. **Timeline** → open the lead detail → "Communications" shows the send with a KIT badge.
5. **Automation** → create "WHEN Lead Created → Start Campaign", activate → create a
   lead → confirm a new enrollment appears (and a `kit_trigger_events` row with the
   workflow in `matchedWorkflows`).
6. **Quiet hours** → set the window to a closed range → confirm the processor skips
   (jobs stay pending) and resumes when reopened.
7. **Rate limit** → set `maxPerHour: 1` → enroll several leads → confirm only one
   sends per tick.
8. **Analytics** → `/kit/analytics` reflects the sends, enrollment funnel, and
   (after converting the test lead) a non-zero conversion rate.
9. **Load** → enroll ~500 leads in a 0-delay campaign; confirm the scheduler drains
   jobs in batches (25/tick) without duplicate sends and the queue rate-limit holds.
