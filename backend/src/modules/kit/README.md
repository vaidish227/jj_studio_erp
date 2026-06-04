# KIT Module — Communication Automation Engine

> **Status: Phase 0 (foundation) only.** This module is the orchestration plane for
> KIT ("Keep In Touch"). It sits **on top of** the existing delivery infrastructure
> (`mail/`, `whatsapp/`, `notifications/`, `communication/`) and reuses it as the
> execution substrate — it does not re-implement sending, queueing, or logging.

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
