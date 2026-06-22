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

// Helpers to keep the tree terse.
//   a(permission, label, help)        — a capability backed by ONE permission string
//   am([permissions], label, help)    — one human capability that grants SEVERAL
//                                        strings together (e.g. the UI-visibility
//                                        permission + the API-enforced permission),
//                                        so the admin sees one clear toggle instead
//                                        of a confusing coarse/granular pair.
// `help` is plain-English "what this unlocks for the user" text shown in the UI.
const a = (permission, label, help) => ({
  key: permission, permission, permissions: [permission], label, help,
});
const am = (permissions, label, help) => ({
  key: permissions[0], permission: permissions[0], permissions, label, help,
});

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
        description: "Lead records and the sales pipeline",
        actions: [
          am(["crm.read", "crm.lead.read"], "View",
             "See the CRM menu and open lead records — the lead list, a lead's details, and the CRM dashboard."),
          am(["crm.create", "crm.lead.create"], "Add",
             "Show the Add-Lead button and let the user create a new lead / submit the enquiry form."),
          am(["crm.update", "crm.lead.update"], "Edit",
             "Edit a lead's details, change its status, and record advance payments."),
          am(["crm.delete", "crm.lead.delete"], "Delete",
             "Delete a lead from the pipeline."),
          a("crm.lead.qualify", "Qualify",
            "Mark a lead as interested / qualified so it advances in the pipeline."),
          a("crm.lead.convert", "Convert",
            "Convert a lead into a client and start a project."),
          a("crm.lead.import", "Bulk Import",
            "Import many leads at once from a CSV / Excel file."),
        ],
      },
      {
        key: "meetings_actions",
        label: "Meetings & MOM",
        description: "Schedule meetings and record minutes-of-meeting",
        actions: [
          am(["crm.create", "crm.meeting.create"], "Schedule meeting",
             "Schedule a new meeting with a lead or client."),
          am(["crm.update", "crm.meeting.update"], "Edit meeting",
             "Reschedule or change the details of a meeting."),
          am(["crm.delete", "crm.meeting.delete"], "Delete meeting",
             "Delete a scheduled meeting."),
          am(["crm.update", "crm.mom.create"], "Record MOM",
             "Save the minutes-of-meeting (notes & outcome) after a meeting."),
        ],
      },
      {
        key: "followups_actions",
        label: "Follow-ups",
        description: "Follow-up tasks and reminders",
        actions: [
          am(["crm.create", "crm.followup.create"], "Add follow-up",
             "Create a follow-up task / reminder for a lead."),
          am(["crm.update", "crm.followup.update"], "Edit follow-up",
             "Edit a follow-up or mark it complete."),
          am(["crm.delete", "crm.followup.delete"], "Delete follow-up",
             "Delete a follow-up task."),
        ],
      },
      {
        key: "menu_tabs",
        label: "Menu Tabs",
        description: "Which CRM items appear in the sidebar menu",
        actions: [
          a("crm.tab.clients",   "All Leads",  "Show the 'All Leads' list in the CRM menu."),
          a("crm.tab.leads",     "New Lead",   "Show the 'Create New Lead' form in the CRM menu."),
          a("crm.tab.meetings",  "Meetings",   "Show the 'Meetings' page in the CRM menu."),
          a("crm.tab.converted", "Converted",  "Show the 'Converted' leads page in the CRM menu."),
          a("crm.tab.lost",      "Lost",       "Show the 'Lost' leads page in the CRM menu."),
        ],
      },
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
          // Scheduling engine — cascade shift + project recalculation
          a("planner.schedule.shift", "Shift Schedule"),
          a("planner.schedule.recalculate", "Recalculate Schedule"),
        ],
      },
      {
        key: "documents",
        label: "Document Repository",
        description: "Project document store — manual uploads + auto-filed approved proposals/drawings",
        actions: [
          a("documents.read", "View"),
          a("documents.upload", "Upload"),
          a("documents.update", "Edit"),
          a("documents.delete", "Delete"),
        ],
      },
    ],
  },
  {
    key: "pms_tabs",
    label: "Project Detail Tabs",
    group: "Project Management",
    icon: "pms",
    color: "#4A8F7C",
    description:
      "Which tabs appear inside a project's detail page. Each tab also stays " +
      "visible to any role that already holds the underlying feature permission " +
      "(e.g. Materials shows with materials.read), so these are additive grants — " +
      "revoke the feature permission to hide a tab.",
    sections: [
      {
        key: "overview_tabs",
        label: "Overview & Activity",
        actions: [
          a("pms.tab.overview", "Overview"),
          a("pms.tab.activity", "Activity Log"),
        ],
      },
      {
        key: "workflow_tabs",
        label: "Planning & Workflow",
        actions: [
          a("pms.tab.planner", "Master Plan"),
          a("pms.tab.gantt", "Gantt"),
          a("pms.tab.tasks", "Tasks"),
          a("pms.tab.approvals", "Client Approvals"),
          a("pms.tab.handover", "Handover"),
          a("pms.tab.gates", "Workflow Gates"),
        ],
      },
      {
        key: "drawing_tabs",
        label: "Drawings",
        actions: [
          a("pms.tab.drawings", "Drawings"),
          a("pms.tab.dlr", "DLR Sheet"),
          a("pms.tab.release_log", "Release Log"),
        ],
      },
      {
        key: "site_tabs",
        label: "Site & Procurement",
        actions: [
          a("pms.tab.site_logs", "Site Logs"),
          a("pms.tab.site_visits", "Site Visits"),
          a("pms.tab.materials", "Materials"),
          a("pms.tab.vendors", "Vendors"),
          a("pms.tab.purchase_orders", "Purchase Orders"),
          a("pms.tab.milestones", "Milestones"),
        ],
      },
      {
        key: "team_tabs",
        label: "Team & Comms",
        actions: [
          a("pms.tab.team", "Team"),
          a("pms.tab.whatsapp", "WhatsApp"),
        ],
      },
      {
        key: "document_tabs",
        label: "Documents",
        actions: [
          a("pms.tab.documents", "Documents"),
        ],
      },
      {
        key: "closure_tabs",
        label: "Finalization & Handover",
        actions: [
          a("pms.tab.material_finalization", "Material Finalization"),
          a("pms.tab.snag_list", "Snag List"),
          a("pms.tab.final_handover", "Final Handover"),
          a("pms.tab.contractor", "Contractor"),
        ],
      },
    ],
  },

  {
    key: "material_finalization",
    label: "Material Finalization",
    group: "Project Management",
    icon: "projects",
    color: "#4A8F7C",
    description: "Finalized material entries with reference images and supporting documents",
    sections: [
      {
        key: "entries",
        label: "Entries",
        actions: [
          a("material_finalization.read", "View"),
          a("material_finalization.create", "Create"),
          a("material_finalization.update", "Edit"),
          a("material_finalization.delete", "Delete"),
        ],
      },
    ],
  },
  {
    key: "snag_list",
    label: "Snag List",
    group: "Project Management",
    icon: "projects",
    color: "#E67E22",
    description: "Site snags / defects with photos, severity and resolution status",
    sections: [
      {
        key: "snags",
        label: "Snags",
        actions: [
          a("snag_list.read", "View"),
          a("snag_list.create", "Create"),
          a("snag_list.update", "Edit"),
          a("snag_list.delete", "Delete"),
        ],
      },
    ],
  },
  {
    key: "final_handover",
    label: "Final Handover",
    group: "Project Management",
    icon: "projects",
    color: "#27AE60",
    description: "Final handover document upload and management (completion docs, warranties, manuals)",
    sections: [
      {
        key: "documents",
        label: "Handover Documents",
        actions: [
          a("final_handover.read", "View"),
          a("final_handover.upload", "Upload"),
          a("final_handover.delete", "Delete"),
        ],
      },
    ],
  },
  {
    key: "contractor",
    label: "Contractor",
    group: "Project Management",
    icon: "projects",
    color: "#E67E22",
    description: "Contractor directory, assigned scope, agreements and payment tracking",
    sections: [
      {
        key: "contractors",
        label: "Contractors",
        actions: [
          a("contractor.read", "View"),
          a("contractor.create", "Create"),
          a("contractor.update", "Edit"),
          a("contractor.delete", "Delete"),
        ],
      },
    ],
  },

  // ─── Delegation ──────────────────────────────────────────────────────────────
  {
    key: "delegation",
    label: "Delegation",
    group: "Project Management",
    icon: "projects",
    color: "#4A8F7C",
    description:
      "Cross-department task delegation — create, assign, and track work across " +
      "Design, MIS, Accounts, Marketing, HR, and future teams.",
    sections: [
      {
        key: "delegations",
        label: "Delegations",
        description: "Delegation records and their lifecycle",
        actions: [
          a("delegation.read", "View",
            "See the Delegation menu and open delegations assigned to or created by the user."),
          a("delegation.viewAll", "View All",
            "See delegations across every user and department — not just the user's own."),
          a("delegation.dashboard", "Dashboard",
            "Open the Delegation dashboard with delegation metrics, status breakdowns, and activity."),
          a("delegation.create", "Create", "Create a new delegation."),
          a("delegation.update", "Edit",
            "Edit a delegation, change its status, update its checklist, and add comments / attachments."),
          a("delegation.delete", "Delete", "Cancel or delete a delegation."),
          a("delegation.assign", "Assign", "Assign a delegation to a team member."),
          a("delegation.reassign", "Reassign", "Move a delegation to a different team member."),
        ],
      },
      {
        key: "departments",
        label: "Departments",
        description: "Department master data (admin-managed; categorization only, not access control)",
        actions: [
          a("delegation.department.manage", "Manage Departments",
            "Create, edit, and deactivate the departments used to categorize delegations."),
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
        // An action may carry one (`permission`) or several (`permissions`)
        // underlying strings; include them all.
        const perms = action.permissions || (action.permission ? [action.permission] : []);
        for (const p of perms) out.push(p);
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
