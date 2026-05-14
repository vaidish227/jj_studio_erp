const mongoose = require("mongoose");

// ─── All valid permission strings ────────────────────────────────────────────
// Format: module.action
// Wildcard '*' grants all permissions (admin only)
const ALL_PERMISSIONS = [
  // Dashboard
  "dashboard.read",
  // CRM
  "crm.read", "crm.create", "crm.update", "crm.delete",
  // KIT (Keep in Touch)
  "kit.read", "kit.create", "kit.update", "kit.delete",
  // Proposal & Quotation
  "proposal.read", "proposal.create", "proposal.update", "proposal.delete", "proposal.approve",
  // Clients
  "clients.read", "clients.create", "clients.update", "clients.delete",
  // Projects (PMS)
  "projects.read", "projects.create", "projects.update", "projects.delete",
  // Tasks
  "tasks.read", "tasks.create", "tasks.update", "tasks.delete",
  // Reports
  "reports.read", "reports.export",
  // Finance
  "finance.read", "finance.create", "finance.update",
  // Settings
  "settings.read", "settings.manage",
  // User management
  "users.read", "users.create", "users.update", "users.delete", "users.manage",
  // Vendor portal
  "vendor.read", "vendor.create", "vendor.update",
  // Client portal
  "client_portal.read",
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
