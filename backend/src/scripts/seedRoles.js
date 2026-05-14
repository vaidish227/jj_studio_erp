/**
 * Seed default system roles with permissions.
 * Run once: node backend/src/scripts/seedRoles.js
 * Safe to re-run — uses upsert so it won't duplicate.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Role = require("../modules/auth/models/Role.model");

const DEFAULT_ROLES = [
  {
    name: "admin",
    displayName: "Administrator",
    description: "Full system access. Can manage all modules, users, and roles.",
    permissions: ["*"],
    isSystem: true,
    color: "#D93025",
  },
  {
    name: "md",
    displayName: "Managing Director",
    description: "Strategic overview: reports, approvals, and read access to all modules.",
    permissions: [
      "dashboard.read",
      "crm.read",
      "kit.read",
      "proposal.read", "proposal.approve",
      "clients.read",
      "projects.read",
      "tasks.read",
      "reports.read", "reports.export",
      "finance.read",
      "users.read",
      "settings.read",
    ],
    isSystem: true,
    color: "#3A6EA5",
  },
  {
    name: "manager",
    displayName: "Manager",
    description: "Manages CRM pipeline, proposal approvals, and team tasks.",
    permissions: [
      "dashboard.read",
      "crm.read", "crm.create", "crm.update",
      "kit.read", "kit.create", "kit.update",
      "proposal.read", "proposal.create", "proposal.update", "proposal.approve",
      "clients.read", "clients.update",
      "projects.read", "projects.update",
      "tasks.read", "tasks.create", "tasks.update",
      "reports.read",
      "users.read",
    ],
    isSystem: true,
    color: "#4A8F7C",
  },
  {
    name: "sales",
    displayName: "Sales Executive",
    description: "Manages leads, meetings, follow-ups, and creates proposals.",
    permissions: [
      "dashboard.read",
      "crm.read", "crm.create", "crm.update",
      "kit.read", "kit.create", "kit.update",
      "proposal.read", "proposal.create", "proposal.update",
      "clients.read",
      "tasks.read",
    ],
    isSystem: true,
    color: "#D4B76C",
  },
  {
    name: "designer",
    displayName: "Designer",
    description: "Accesses project files, tasks, and design-related modules.",
    permissions: [
      "dashboard.read",
      "projects.read", "projects.update",
      "tasks.read", "tasks.create", "tasks.update",
      "clients.read",
    ],
    isSystem: true,
    color: "#9B59B6",
  },
  {
    name: "supervisor",
    displayName: "Supervisor",
    description: "Oversees on-site work, updates project and task progress.",
    permissions: [
      "dashboard.read",
      "crm.read",
      "projects.read", "projects.update",
      "tasks.read", "tasks.create", "tasks.update",
      "clients.read",
    ],
    isSystem: true,
    color: "#E67E22",
  },
  {
    name: "accounts",
    displayName: "Accounts",
    description: "Handles finance, payments, and financial reporting.",
    permissions: [
      "dashboard.read",
      "proposal.read",
      "clients.read",
      "finance.read", "finance.create", "finance.update",
      "reports.read", "reports.export",
    ],
    isSystem: true,
    color: "#27AE60",
  },
  {
    name: "vendor",
    displayName: "Vendor",
    description: "External vendor with access to the vendor portal only.",
    permissions: [
      "vendor.read", "vendor.update",
    ],
    isSystem: true,
    color: "#7F8C8D",
  },
  {
    name: "client",
    displayName: "Client",
    description: "External client with access to project status and quotations.",
    permissions: [
      "client_portal.read",
    ],
    isSystem: true,
    color: "#2980B9",
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    let created = 0;
    let updated = 0;

    for (const roleData of DEFAULT_ROLES) {
      const result = await Role.findOneAndUpdate(
        { name: roleData.name },
        { $set: roleData },
        { upsert: true, new: true }
      );
      if (result.createdAt?.getTime() === result.updatedAt?.getTime()) {
        created++;
      } else {
        updated++;
      }
    }

    console.log(`Seed complete. ${created} created, ${updated} updated.`);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
