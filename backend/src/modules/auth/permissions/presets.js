/**
 * ─── Permission Presets / Role Templates ─────────────────────────────────────
 *
 * Curated, named bundles of permission strings used as STARTING POINTS when
 * creating or editing a role. A preset is purely an authoring convenience:
 *
 *   - Every permission below is a registry leaf (validated by test).
 *   - Presets are descriptive, NOT binding: a role created from a preset stores
 *     a plain permission array and is not linked to the preset. Editing a preset
 *     later never changes existing roles (no drift, no migration).
 *   - Presets are applied entirely on the frontend draft (Add or Replace); the
 *     stored role only changes when the admin clicks Save.
 *
 * Bump PRESETS_VERSION whenever the bundles change (cache-busting / UI hint).
 */

const PRESETS_VERSION = 1;

const PRESETS = [
  {
    key: "base_staff",
    label: "Base Staff",
    description: "The floor every internal user needs — dashboard, calendar, AI, client read.",
    permissions: [
      "dashboard.read", "calendar.read", "activity.read",
      "clients.read", "tasks.read",
      "ai.chat", "ai.docs.read",
    ],
  },
  {
    key: "crm_sales",
    label: "CRM / Sales",
    description: "Lead-to-proposal pipeline — CRM, proposals, KIT, and outbound messaging.",
    permissions: [
      "crm.read", "crm.create", "crm.update",
      "crm.tab.clients", "crm.tab.leads", "crm.tab.meetings", "crm.tab.converted", "crm.tab.lost",
      "crm.lead.read",
      "proposal.read", "proposal.create", "proposal.update", "proposal.send",
      "proposal.tab.templates", "template.read",
      "kit.read", "kit.create", "kit.update", "kit.tab.templates",
      "mail.read", "mail.send", "whatsapp.read", "whatsapp.send",
    ],
  },
  {
    key: "proposal_management",
    label: "Proposal Management",
    description: "Approve and curate quotations and quotation templates.",
    permissions: [
      "proposal.read", "proposal.create", "proposal.update", "proposal.approve", "proposal.send",
      "proposal.tab.templates", "proposal.tab.approval",
      "template.read", "template.create", "template.update", "template.delete",
    ],
  },
  {
    key: "field_execution",
    label: "Field / Execution",
    description: "On-site task and drawing work — tasks, drawings, site ops, planner read.",
    permissions: [
      "projects.read",
      "tasks.read", "tasks.update", "tasks.submit",
      "pms.tab.tasks", "pms.tab.drawings", "pms.tab.team",
      "drawings.read", "drawings.upload", "design.comment", "designer.dashboard",
      "site_logs.read", "site_logs.create",
      "site_visits.read", "site_visits.create",
      "materials.read", "materials.create", "materials.update",
      "purchase_orders.read",
      "milestones.read",
      "approvals.read", "approvals.create",
      "planner.read",
      "documents.read", "documents.upload",
    ],
  },
  {
    key: "design_review",
    label: "Design Review",
    description: "Approve and release drawings; respond to design submissions.",
    permissions: [
      "drawings.read", "drawings.approve", "drawings.release",
      "design.comment", "pd.review.respond",
      "approvals.read", "approvals.respond",
      "pms.tab.drawings",
    ],
  },
  {
    key: "pms_management",
    label: "PMS Management",
    description: "Run projects — full project, task, milestone, and planner control.",
    permissions: [
      "projects.read", "projects.create", "projects.update", "projects.customize_plan",
      "projects.tab.assign", "projects.tab.review",
      "tasks.read", "tasks.create", "tasks.update", "tasks.delete",
      "tasks.approve", "tasks.reassign", "tasks.override_gate",
      "milestones.read", "milestones.create", "milestones.update", "milestones.delete",
      "planner.read", "planner.edit", "planner.assign", "planner.delete",
      "planner.import", "planner.export", "planner.baseline", "planner.dashboard",
      "pms.tab.tasks", "pms.tab.drawings", "pms.tab.team", "pms.whatsapp.manage",
      "documents.read", "documents.upload", "documents.update", "documents.delete",
    ],
  },
  {
    key: "site_operations",
    label: "Site Operations",
    description: "Site logs, visits, materials, and purchase orders.",
    permissions: [
      "site_logs.read", "site_logs.create",
      "site_visits.read", "site_visits.create", "site_visits.update",
      "materials.read", "materials.create", "materials.update", "materials.delete",
      "purchase_orders.read", "purchase_orders.create", "purchase_orders.update",
    ],
  },
  {
    key: "communication_admin",
    label: "Communication Admin",
    description: "Manage mail, WhatsApp, and communication settings.",
    permissions: [
      "mail.read", "mail.send", "mail.manage",
      "whatsapp.read", "whatsapp.send", "whatsapp.manage",
      "communication.settings.manage", "pms.whatsapp.manage",
    ],
  },
  {
    key: "finance_accounts",
    label: "Finance / Accounts",
    description: "Payments, invoices, reports, and proposal read.",
    permissions: [
      "finance.read", "finance.create", "finance.update",
      "reports.read", "reports.export",
      "proposal.read", "template.read", "clients.read", "dashboard.read",
    ],
  },
  {
    key: "administration",
    label: "Administration",
    description: "System settings, templates, user management, and KB management.",
    permissions: [
      "settings.read", "settings.manage",
      "settings.tab.users", "settings.tab.roles",
      "settings.checklists.manage", "settings.workflows.manage",
      "users.read", "users.create", "users.update", "users.delete", "users.manage",
      "ai.docs.manage",
    ],
  },
  {
    key: "external_vendor",
    label: "External — Vendor",
    description: "Vendor portal access only.",
    permissions: ["vendor.read", "vendor.update"],
  },
  {
    key: "external_client",
    label: "External — Client",
    description: "Client portal access only.",
    permissions: ["client_portal.read"],
  },
];

module.exports = { PRESETS, PRESETS_VERSION };
