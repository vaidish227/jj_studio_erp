/**
 * ─── Permission Registry — single source of truth ────────────────────────────
 *
 * The canonical, structured catalogue of every permission in the system,
 * organised as a three-level hierarchy:
 *
 *     Module  →  Section  →  Action
 *
 * Each leaf "action" carries the actual permission STRING that the rest of the
 * system already uses (e.g. `crm.create`, `crm.tab.meetings`). This registry is
 * therefore a *structured view* over the existing flat permission strings — it
 * introduces no new enforceable permissions on its own. `ALL_PERMISSIONS`
 * (used for validation) is derived from it via `flattenPermissions()`, and the
 * Roles & Permissions UI renders directly from `PERMISSION_REGISTRY` (served by
 * `GET /api/roles/registry`).
 *
 * Backward compatibility: every string that previously existed in
 * `Role.model.ALL_PERMISSIONS`, in `seedRoles.js`, or on a protected route is
 * represented below. A handful of strings that were enforced/seeded but missing
 * from the old whitelist are now reconciled here (planner.*, proposal.send,
 * projects.customize_plan, pd.review.respond, settings.checklists.manage,
 * settings.workflows.manage, ai.*). These are additive — no string was removed.
 *
 * To make a permission grantable in the UI, add it as an action leaf below.
 */

// Helper to keep the tree terse: action(permission, label)
const a = (permission, label) => ({ key: permission, permission, label });

const PERMISSION_REGISTRY = [
  // ─── Core ──────────────────────────────────────────────────────────────────
  {
    key: "dashboard",
    label: "Dashboard",
    group: "Core",
    icon: "dashboard",
    color: "#6B7280",
    description: "Main overview with KPIs and recent activity",
    sections: [
      { key: "overview", label: "Overview", actions: [a("dashboard.read", "View")] },
    ],
  },
  {
    key: "md_dashboard",
    label: "MD Dashboard",
    group: "Leadership",
    icon: "dashboard",
    color: "#3A6EA5",
    description: "Executive cross-module overview — CRM, proposals, projects, finance",
    sections: [
      { key: "overview", label: "Overview", actions: [a("md.dashboard.read", "View")] },
    ],
  },

  // ─── Sales ─────────────────────────────────────────────────────────────────
  {
    key: "crm",
    label: "CRM",
    group: "Sales",
    icon: "crm",
    color: "#D4B76C",
    description: "Client relationships, leads, meetings, and conversion pipeline",
    sections: [
      {
        key: "leads",
        label: "Leads",
        description: "Lead records and pipeline",
        actions: [
          // Granular API-enforced read (Phase 2 Stage 2). Backward-compatible:
          // satisfied by the legacy `clients.read` / `crm.read` via the alias map.
          a("crm.lead.read", "Read (API)"),
          a("crm.read", "View"),
          a("crm.create", "Create"),
          a("crm.update", "Edit"),
          a("crm.delete", "Delete"),
          // Granular API-enforced writes (Phase 2 Stage 4). Backward-compatible:
          // satisfied by the legacy `crm.create` / `crm.update` / `crm.delete`
          // via the alias map.
          a("crm.lead.create", "Create (API)"),
          a("crm.lead.update", "Edit (API)"),
          a("crm.lead.delete", "Delete (API)"),
          a("crm.lead.qualify", "Qualify (API)"),
          a("crm.lead.convert", "Convert (API)"),
          a("crm.lead.import", "Bulk Import (API)"),
        ],
      },
      {
        key: "meetings_actions",
        label: "Meetings & MOM",
        description: "Meeting scheduling and minutes-of-meeting (API-enforced — Phase 2 Stage 4)",
        actions: [
          a("crm.meeting.create", "Create (API)"),
          a("crm.meeting.update", "Edit (API)"),
          a("crm.meeting.delete", "Delete (API)"),
          a("crm.mom.create", "Record MOM (API)"),
        ],
      },
      {
        key: "followups_actions",
        label: "Follow-ups",
        description: "Follow-up tasks (API-enforced — Phase 2 Stage 4)",
        actions: [
          a("crm.followup.create", "Create (API)"),
          a("crm.followup.update", "Edit (API)"),
          a("crm.followup.delete", "Delete (API)"),
        ],
      },
      { key: "all_clients", label: "All Clients", actions: [a("crm.tab.clients", "View")] },
      { key: "new_leads",   label: "New Leads",   actions: [a("crm.tab.leads", "View")] },
      { key: "meetings",    label: "Meetings",    actions: [a("crm.tab.meetings", "View")] },
      { key: "converted",   label: "Converted",   actions: [a("crm.tab.converted", "View")] },
      { key: "lost",        label: "Lost Leads",  actions: [a("crm.tab.lost", "View")] },
    ],
  },
  {
    key: "kit",
    label: "KIT (Keep In Touch)",
    group: "Sales",
    icon: "kit",
    color: "#D4B76C",
    description: "Communication automation — follow-ups, campaigns, templates, and workflows",
    sections: [
      {
        key: "campaigns",
        label: "Campaigns & Automations",
        actions: [
          a("kit.read", "View"),
          a("kit.create", "Create"),
          a("kit.update", "Edit"),
          a("kit.delete", "Delete"),
          a("kit.manage", "Manage"),
        ],
      },
      { key: "templates", label: "Templates (WA + Mail)", actions: [a("kit.tab.templates", "View")] },
    ],
  },
  {
    key: "proposal",
    label: "Proposal & Quotation",
    group: "Sales",
    icon: "proposal",
    color: "#D4B76C",
    description: "Create, send, and approve client proposals and quotations",
    sections: [
      {
        key: "proposals",
        label: "Proposals",
        actions: [
          a("proposal.read", "View"),
          a("proposal.create", "Create"),
          a("proposal.update", "Edit"),
          a("proposal.delete", "Delete"),
          a("proposal.approve", "Approve"),
          a("proposal.send", "Send"),
        ],
      },
      { key: "templates", label: "Quotation Templates (Page)", actions: [a("proposal.tab.templates", "View")] },
      {
        key: "template_records",
        label: "Quotation Templates",
        description: "Create and manage reusable quotation templates",
        actions: [
          a("template.read", "View"),
          a("template.create", "Create"),
          a("template.update", "Edit"),
          a("template.delete", "Delete"),
        ],
      },
      { key: "approval",  label: "Manager Approval",    actions: [a("proposal.tab.approval", "View")] },
    ],
  },
  {
    key: "clients",
    label: "Clients",
    group: "Sales",
    icon: "clients",
    color: "#D4B76C",
    description: "Converted client profiles and contact management",
    sections: [
      {
        key: "profiles",
        label: "Client Profiles",
        actions: [
          a("clients.read", "View"),
          a("clients.create", "Create"),
          a("clients.update", "Edit"),
          a("clients.delete", "Delete"),
        ],
      },
    ],
  },

  // ─── Project Management ──────────────────────────────────────────────────────
  {
    key: "projects",
    label: "Project Management",
    group: "Project Management",
    icon: "projects",
    color: "#4A8F7C",
    description: "Projects, tasks, milestones, planner, and project-detail tabs",
    sections: [
      {
        key: "projects",
        label: "Projects",
        actions: [
          a("projects.read", "View"),
          a("projects.create", "Create"),
          a("projects.update", "Edit"),
          a("projects.delete", "Delete"),
          a("projects.customize_plan", "Customize Plan"),
        ],
      },
      { key: "assign_page", label: "Assign Task Page",   actions: [a("projects.tab.assign", "View")] },
      { key: "review_page", label: "Review / Approvals", actions: [a("projects.tab.review", "View")] },
      {
        key: "tasks",
        label: "Tasks",
        actions: [
          a("tasks.read", "View"),
          a("tasks.create", "Create"),
          a("tasks.update", "Edit"),
          a("tasks.delete", "Delete"),
          a("tasks.submit", "Submit"),
          a("tasks.approve", "Approve"),
          a("tasks.reassign", "Reassign"),
          a("tasks.override_gate", "Override Gate"),
        ],
      },
      {
        key: "detail_tabs",
        label: "Project Detail Tabs",
        description: "Which tabs are visible inside a project's detail page",
        actions: [
          a("pms.tab.tasks", "Tasks Tab"),
          a("pms.tab.drawings", "Drawings Tab"),
          a("pms.tab.team", "Team Tab"),
        ],
      },
      {
        key: "milestones",
        label: "Milestones",
        actions: [
          a("milestones.read", "View"),
          a("milestones.create", "Create"),
          a("milestones.update", "Edit"),
          a("milestones.delete", "Delete"),
        ],
      },
      {
        key: "planner",
        label: "Planner",
        actions: [
          a("planner.read", "View"),
          a("planner.edit", "Edit"),
          a("planner.assign", "Assign"),
          a("planner.delete", "Delete"),
          a("planner.baseline", "Baseline"),
          a("planner.dashboard", "Dashboard"),
          a("planner.import", "Import"),
          a("planner.export", "Export"),
        ],
      },
    ],
  },

  // ─── Design ──────────────────────────────────────────────────────────────────
  {
    key: "design",
    label: "Design & Drawings",
    group: "Design",
    icon: "drawings",
    color: "#9B59B6",
    description: "Drawing uploads, reviews, collaboration, and client approvals",
    sections: [
      {
        key: "drawings",
        label: "Drawings",
        actions: [
          a("drawings.read", "View"),
          a("drawings.upload", "Upload"),
          a("drawings.approve", "Approve"),
          a("drawings.release", "Release"),
        ],
      },
      { key: "collaboration", label: "Design Collaboration", actions: [a("design.comment", "Comment")] },
      { key: "designer_dashboard", label: "Designer Dashboard", actions: [a("designer.dashboard", "View")] },
      { key: "pd_review", label: "Principal Designer Review", actions: [a("pd.review.respond", "Respond")] },
      {
        key: "approvals",
        label: "Client Approvals",
        actions: [
          a("approvals.read", "View"),
          a("approvals.create", "Create"),
          a("approvals.respond", "Respond"),
        ],
      },
    ],
  },

  // ─── Site & Operations ────────────────────────────────────────────────────────
  {
    key: "site_operations",
    label: "Site Operations",
    group: "Site & Operations",
    icon: "site_logs",
    color: "#E67E22",
    description: "Site logs, visits, materials, and purchase orders",
    sections: [
      {
        key: "site_logs",
        label: "Site Logs",
        actions: [a("site_logs.read", "View"), a("site_logs.create", "Create")],
      },
      {
        key: "site_visits",
        label: "Site Visits",
        actions: [
          a("site_visits.read", "View"),
          a("site_visits.create", "Create"),
          a("site_visits.update", "Edit"),
        ],
      },
      {
        key: "materials",
        label: "Materials",
        actions: [
          a("materials.read", "View"),
          a("materials.create", "Create"),
          a("materials.update", "Edit"),
          a("materials.delete", "Delete"),
        ],
      },
      {
        key: "purchase_orders",
        label: "Purchase Orders",
        actions: [
          a("purchase_orders.read", "View"),
          a("purchase_orders.create", "Create"),
          a("purchase_orders.update", "Edit"),
        ],
      },
    ],
  },
  {
    key: "activity_calendar",
    label: "Activity & Calendar",
    group: "Site & Operations",
    icon: "calendar",
    color: "#E67E22",
    description: "Audit log and team calendar",
    sections: [
      { key: "activity", label: "Activity Log", actions: [a("activity.read", "View")] },
      { key: "calendar", label: "Calendar",     actions: [a("calendar.read", "View")] },
    ],
  },

  // ─── Communication ────────────────────────────────────────────────────────────
  {
    key: "communication",
    label: "Communication",
    group: "Communication",
    icon: "mail",
    color: "#3A6EA5",
    description: "Mail, WhatsApp, and messaging settings",
    sections: [
      {
        key: "mail",
        label: "Mail",
        actions: [a("mail.read", "View"), a("mail.send", "Send"), a("mail.manage", "Manage")],
      },
      {
        key: "whatsapp",
        label: "WhatsApp",
        actions: [a("whatsapp.read", "View"), a("whatsapp.send", "Send"), a("whatsapp.manage", "Manage")],
      },
      { key: "project_whatsapp", label: "Project WhatsApp Groups", actions: [a("pms.whatsapp.manage", "Manage")] },
      { key: "settings", label: "Communication Settings", actions: [a("communication.settings.manage", "Manage")] },
    ],
  },

  // ─── External ─────────────────────────────────────────────────────────────────
  {
    key: "vendor",
    label: "Vendor Directory",
    group: "External",
    icon: "vendor",
    color: "#7F8C8D",
    description: "Manage vendor profiles and contact information",
    sections: [
      {
        key: "vendors",
        label: "Vendors",
        actions: [a("vendor.read", "View"), a("vendor.create", "Create"), a("vendor.update", "Edit")],
      },
    ],
  },
  {
    key: "client_portal",
    label: "Client Portal",
    group: "External",
    icon: "client_portal",
    color: "#7F8C8D",
    description: "External client-facing portal for project status and approvals",
    sections: [
      { key: "portal", label: "Portal", actions: [a("client_portal.read", "View")] },
    ],
  },

  // ─── Finance & Reports ─────────────────────────────────────────────────────────
  {
    key: "reports",
    label: "Reports",
    group: "Finance & Reports",
    icon: "reports",
    color: "#27AE60",
    description: "Business intelligence reports and data exports",
    sections: [
      { key: "reports", label: "Business Reports", actions: [a("reports.read", "View"), a("reports.export", "Export")] },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    group: "Finance & Reports",
    icon: "finance",
    color: "#27AE60",
    description: "Payments, invoices, and financial summaries",
    sections: [
      {
        key: "finance",
        label: "Payments & Invoices",
        actions: [a("finance.read", "View"), a("finance.create", "Create"), a("finance.update", "Edit")],
      },
    ],
  },

  // ─── Administration ────────────────────────────────────────────────────────────
  {
    key: "settings",
    label: "Settings",
    group: "Administration",
    icon: "settings",
    color: "#D93025",
    description: "System configuration, users, roles, and templates",
    sections: [
      { key: "general", label: "General", actions: [a("settings.read", "View"), a("settings.manage", "Manage")] },
      { key: "users_tab", label: "User Management", actions: [a("settings.tab.users", "View")] },
      { key: "roles_tab", label: "Roles & Permissions", actions: [a("settings.tab.roles", "View")] },
      { key: "checklists", label: "Checklist Templates", actions: [a("settings.checklists.manage", "Manage")] },
      { key: "workflows", label: "Master Templates", actions: [a("settings.workflows.manage", "Manage")] },
    ],
  },
  {
    key: "users",
    label: "User Accounts",
    group: "Administration",
    icon: "users",
    color: "#D93025",
    description: "Create and manage user accounts, roles, and custom permissions",
    sections: [
      {
        key: "users",
        label: "Users",
        actions: [
          a("users.read", "View"),
          a("users.create", "Create"),
          a("users.update", "Edit"),
          a("users.delete", "Delete"),
          a("users.manage", "Manage"),
        ],
      },
    ],
  },

  // ─── AI Assistant ──────────────────────────────────────────────────────────────
  {
    key: "ai",
    label: "AI Assistant",
    group: "AI",
    icon: "ai",
    color: "#8B5CF6",
    description: "AI chat, admin dashboards, and knowledge base",
    sections: [
      { key: "chat", label: "Chat", actions: [a("ai.chat", "Use")] },
      { key: "admin", label: "Admin", actions: [a("ai.admin", "Admin")] },
      {
        key: "docs",
        label: "Knowledge Docs",
        actions: [a("ai.docs.read", "View"), a("ai.docs.manage", "Manage")],
      },
    ],
  },
];

// ─── Derivations ───────────────────────────────────────────────────────────────

/** Flatten the registry into the de-duplicated list of all permission strings. */
function flattenPermissions() {
  const out = [];
  for (const mod of PERMISSION_REGISTRY) {
    for (const section of mod.sections) {
      for (const action of section.actions) {
        if (action.permission) out.push(action.permission);
      }
    }
  }
  return [...new Set(out)];
}

/** Ordered list of distinct group names (for UI section headers). */
function listGroups() {
  return [...new Set(PERMISSION_REGISTRY.map((m) => m.group))];
}

module.exports = {
  PERMISSION_REGISTRY,
  flattenPermissions,
  listGroups,
};
