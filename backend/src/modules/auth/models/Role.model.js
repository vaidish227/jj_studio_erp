const mongoose = require("mongoose");

// ─── All valid permission strings ────────────────────────────────────────────
// Format: module.action
// Wildcard '*' grants all permissions (admin only)
const ALL_PERMISSIONS = [
  // Dashboard
  "dashboard.read",
  // CRM
  "crm.read", "crm.create", "crm.update", "crm.delete",
  // KIT
  "kit.read", "kit.create", "kit.update", "kit.delete", "kit.manage",
  // Proposal & Quotation
  "proposal.read", "proposal.create", "proposal.update", "proposal.delete", "proposal.approve",
  // Clients
  "clients.read", "clients.create", "clients.update", "clients.delete",
  // Projects (PMS)
  "projects.read", "projects.create", "projects.update", "projects.delete",
  // Tasks
  "tasks.read", "tasks.create", "tasks.update", "tasks.delete",
  "tasks.submit", "tasks.approve", "tasks.reassign",
  // Design & Drawing Management
  "drawings.read", "drawings.upload", "drawings.approve", "drawings.release",
  "design.comment",
  "designer.dashboard",
  // Client Approvals
  "approvals.read", "approvals.create", "approvals.respond",
  // Site Logs
  "site_logs.read", "site_logs.create",
  // Site Visits
  "site_visits.read", "site_visits.create", "site_visits.update",
  // Materials
  "materials.read", "materials.create", "materials.update", "materials.delete",
  // Purchase Orders
  "purchase_orders.read", "purchase_orders.create", "purchase_orders.update",
  // Milestones
  "milestones.read", "milestones.create", "milestones.update", "milestones.delete",
  // Activity & Calendar
  "activity.read", "calendar.read",
  // Mail
  "mail.read", "mail.send", "mail.manage",
  // WhatsApp
  "whatsapp.read", "whatsapp.send", "whatsapp.manage",
  // Communication settings
  "communication.settings.manage",
  "pms.whatsapp.manage",
  // Vendor portal
  "vendor.read", "vendor.create", "vendor.update",
  // Client portal
  "client_portal.read",
  // Reports
  "reports.read", "reports.export",
  // Finance
  "finance.read", "finance.create", "finance.update",
  // Settings & Users
  "settings.read", "settings.manage",
  "users.read", "users.create", "users.update", "users.delete", "users.manage",
  // ── Tab permissions (Level 2 — sub-section visibility) ──────────────────────
  // CRM tabs
  "crm.tab.clients", "crm.tab.leads", "crm.tab.meetings", "crm.tab.converted", "crm.tab.lost",
  // KIT tabs
  "kit.tab.templates",
  // Proposal tabs
  "proposal.tab.templates", "proposal.tab.approval",
  // Projects nav tabs
  "projects.tab.assign", "projects.tab.review",
  // PMS project-detail tabs
  "pms.tab.tasks", "pms.tab.drawings", "pms.tab.team",
  // Settings tabs
  "settings.tab.users", "settings.tab.roles",
  // ── AI Assistant ─────────────────────────────────────────────────────────────
  "ai.chat", "ai.admin", "ai.docs.read", "ai.docs.manage",
];

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    displayName: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    // Permission strings. Use ['*'] for full admin access.
    permissions: {
      type: [String],
      default: [],
    },

    // Prevent deletion/rename of built-in roles
    isSystem: {
      type: Boolean,
      default: false,
    },

    // Color for UI badge display
    color: {
      type: String,
      default: "#6B6B6B",
    },
  },
  { timestamps: true }
);

roleSchema.index({ name: 1 });

// ─── Static method: get effective permissions ─────────────────────────────────
roleSchema.statics.getPermissionsForRole = async function (roleName) {
  const role = await this.findOne({ name: roleName }).lean();
  return role ? role.permissions : [];
};

module.exports = mongoose.model("Role", roleSchema);
module.exports.ALL_PERMISSIONS = ALL_PERMISSIONS;
