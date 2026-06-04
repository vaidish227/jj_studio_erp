/**
 * KIT Trigger Catalog — the canonical list of business events the automation
 * engine can react to (the WHEN side of WHEN → IF → THEN).
 *
 * Consumed by:
 *   - the Automation Builder (frontend) to populate the trigger dropdown
 *   - workflow validation (an event must exist here to be selectable)
 *
 * `entityType` tells the builder which entity a workflow for this event operates
 * on (drives condition-field and action suggestions, and is the entity enrolled
 * / messaged when actions run). It matches the entityType the emit call passes.
 */
const TRIGGERS = [
  // ── CRM ────────────────────────────────────────────────────────────────────
  { event: "lead.created",        sourceModule: "crm", entityType: "lead",     label: "Lead Created" },
  { event: "lead.assigned",       sourceModule: "crm", entityType: "lead",     label: "Lead Assigned" },
  { event: "lead.status_changed", sourceModule: "crm", entityType: "lead",     label: "Lead Status Changed" },
  { event: "lead.won",            sourceModule: "crm", entityType: "lead",     label: "Lead Won" },
  { event: "lead.lost",           sourceModule: "crm", entityType: "lead",     label: "Lead Lost" },
  { event: "meeting.scheduled",   sourceModule: "crm", entityType: "lead",     label: "Meeting Scheduled" },
  { event: "meeting.completed",   sourceModule: "crm", entityType: "lead",     label: "Meeting Completed" },

  // ── Proposal ─────────────────────────────────────────────────────────────────
  { event: "proposal.created",  sourceModule: "proposal", entityType: "proposal", label: "Proposal Created" },
  { event: "proposal.sent",     sourceModule: "proposal", entityType: "proposal", label: "Proposal Sent" },
  { event: "proposal.approved", sourceModule: "proposal", entityType: "proposal", label: "Proposal Approved" },
  { event: "proposal.rejected", sourceModule: "proposal", entityType: "proposal", label: "Proposal Rejected" },

  // ── PMS ──────────────────────────────────────────────────────────────────────
  { event: "project.created",      sourceModule: "pms", entityType: "project", label: "Project Created" },
  { event: "milestone.completed",  sourceModule: "pms", entityType: "project", label: "Milestone Completed" },
  { event: "task.completed",       sourceModule: "pms", entityType: "project", label: "Task Completed" },
  { event: "site_visit.scheduled", sourceModule: "pms", entityType: "project", label: "Site Visit Scheduled" },

  // ── Finance ──────────────────────────────────────────────────────────────────
  { event: "payment.received", sourceModule: "finance", entityType: "proposal", label: "Payment Received" },
];

const EVENT_SET = new Set(TRIGGERS.map((t) => t.event));
const isValidEvent = (event) => EVENT_SET.has(event);
const getTrigger = (event) => TRIGGERS.find((t) => t.event === event);

module.exports = { TRIGGERS, isValidEvent, getTrigger };
