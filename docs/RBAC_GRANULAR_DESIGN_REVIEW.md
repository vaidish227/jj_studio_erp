# Granular Permission Design Review (Planning Only)

> Review of CRM, PMS, Proposal, AI, KIT, Settings. **No implementation.** "Current" reflects state after Phase 2 Stage 2 (`crm.lead.read` added; `ai.*` assigned; `template.*`/`proposal.send` granted).

Grammar target: `module.section.action`. Legend: ✅ exists & granular · 🟡 exists but coarse (rides a CRUD verb) · 🆕 recommended new · ⚠️ visibility-only tab perm.

---

## CRM
**Current:** `crm.read/create/update/delete`, `crm.tab.{clients,leads,meetings,converted,lost}` ⚠️, `crm.lead.read` ✅ (Stage 2 read guard, alias `clients.read`/`crm.read`).
**Missing (rides on `crm.update`/`crm.create`):** lead assign, convert, qualify, import; meeting create/update/delete; MOM create; follow-up create/update/delete; CRM report read/export.
**Recommended model:**
| Section | Actions |
|---|---|
| `crm.lead` | read ✅ · create 🆕 · update 🆕 · delete 🆕 · assign 🆕 · convert 🆕 · qualify 🆕 · import 🆕 · export 🆕 |
| `crm.meeting` | read 🆕 · create 🆕 · update 🆕 · delete 🆕 |
| `crm.mom` | read 🆕 · create 🆕 |
| `crm.followup` | read 🆕 · create 🆕 · update 🆕 · delete 🆕 |
| `crm.report` | read 🆕 · export 🆕 |
**Note:** writes still ride on coarse `crm.create/update/delete` today (unenforced on CRM write routes) — this is the **CRM write-enforcement** topic, held per your instruction.

## PMS
**Current:** `projects.read/create/update/delete`, `projects.customize_plan`, `projects.tab.assign/review` ⚠️; `tasks.read/create/update/delete/submit/approve/reassign/override_gate` ✅; `pms.tab.tasks/drawings/team` ⚠️; `milestones.*`; `planner.*` ✅; `pms.whatsapp.manage`; drawings/design/approvals (see Design).
**Missing / coarse:** project **team manage** (🟡 rides `projects.update`), **gate/milestone sign-off** (🟡 leans on `tasks.override_gate`/role), **handover/closure** (🟡 `projects.update` — `Handover.route.js` exists), task **assign** distinct from `reassign` (🟡 `projects.tab.assign`), **DLR** (🟡 reuses `site_logs`).
**Recommended:** `pms.team.manage` 🆕, `pms.gate.approve` 🆕, `pms.handover.read/manage` 🆕, `pms.task.assign` 🆕, `pms.dlr.read/create/approve` 🆕. (Site-ops `materials/site_visits/site_logs/purchase_orders` are adequately granular; add `purchase_orders.send` 🆕, `materials.mark_procured` 🆕.)

## Proposal
**Current:** `proposal.read/create/update/delete/approve/send` ✅, `proposal.tab.templates/approval` ⚠️, `template.read/create/update/delete` ✅.
**Missing / coarse:** **download/export** PDF (🟡 rides `proposal.read`), **reject / request-revision** (🟡 ride `proposal.approve`), **bulk approve** (🟡 `proposal.approve`), eSign **resend/track** (🟡 `proposal.read`).
**Recommended:** `proposal.download` 🆕, `proposal.reject` 🆕, `proposal.request_revision` 🆕, `proposal.bulk_approve` 🆕, `proposal.esign.resend` 🆕. Template CRUD already granular.

## AI
**Current:** `ai.chat` (chat + MOM polish + actions + user-facts), `ai.docs.read`, `ai.docs.manage`, `ai.admin` ✅ — all enforced on `/api/ai/*`; now assigned per the approved matrix.
**Missing / coarse:** `ai.chat` bundles **four distinct features** (chat, text-polish, write-actions, long-term memory). If finer control is ever wanted: `ai.polish` 🆕 (text polish), `ai.actions` 🆕 (write-tool confirm/cancel — note the *underlying* tool perm is already re-checked in the executor), `ai.facts` 🆕 (user memory). Admin metrics already isolated (`ai.admin`).
**Recommended:** keep `ai.chat` as the umbrella for v1 (matches current product); split only if a role should chat-but-not-run-actions. Low priority.

## KIT
**Current:** `kit.read/create/update/delete/manage`, `kit.tab.templates` ⚠️.
**Missing / coarse:** campaign **activate/pause** (🟡 `kit.update`), automation **enable/test** (🟡 `kit.manage`), template **CRUD** (🟡 only the `kit.tab.templates` visibility), analytics **export** (🟡 `kit.read`).
**Recommended:** `kit.campaign.activate/pause` 🆕, `kit.automation.enable/test` 🆕, `kit.template.create/update/delete` 🆕, `kit.analytics.export` 🆕.

## Settings
**Current:** `settings.read/manage`, `settings.tab.users/roles` ⚠️, `settings.checklists.manage`, `settings.workflows.manage`, `users.read/create/update/delete/manage`.
**Missing / coarse:** **Responsibilities** page is gated by a hardcoded `role==='admin'/'md'` check — **no permission at all** 🆕; `roles.manage` distinct from `settings.tab.roles` visibility (🟡); user **reset-password** as a discrete action (🟡 `users.manage`).
**Recommended:** `settings.responsibilities.read/manage` 🆕 (replace the hardcoded role check), `settings.roles.manage` 🆕, `users.reset_password` 🆕.

---

## Cross-cutting recommendations
1. **Tab/visibility perms (`*.tab.*`) should become derived**, not separate grants — a section shows if the user holds any action in it. (Deferred frontend work.)
2. **Replace hardcoded `role===` checks** (Responsibilities, and any others) with real permissions — removes the last non-RBAC authz paths.
3. **Every new granular permission ships with an alias** to its current coarse verb (the Stage-2 pattern), so rollout never breaks existing roles.
4. **Sequencing if approved later:** CRM writes (highest security value) → Proposal/KIT granularity (transparent via aliases) → Settings hardcoded-check removal → optional AI/`*.tab.*` refinements.

**Scale:** ~40–55 new granular strings across these modules would take the registry from ~120 → ~165–175. All additive; none implemented now.

---
**Status:** analysis only. CRM write enforcement, alias removal, migrations, inheritance, denied/ownership permissions all remain on hold per instruction.
