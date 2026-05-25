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
      "crm.tab.clients", "crm.tab.leads", "crm.tab.meetings", "crm.tab.converted", "crm.tab.lost",
      "kit.read",
      "proposal.read", "proposal.approve",
      "proposal.tab.approval",
      "clients.read",
      "projects.read",
      "projects.tab.assign", "projects.tab.review",
      "tasks.read", "tasks.approve", "tasks.reassign",
      "pms.tab.tasks", "pms.tab.drawings", "pms.tab.team",
      "drawings.read", "drawings.approve", "drawings.release",
      "design.comment",
      "designer.dashboard",
      "site_logs.read",
      "site_visits.read",
      "vendor.read",
      "materials.read",
      "purchase_orders.read",
      "milestones.read",
      "approvals.read",
      "activity.read",
      "calendar.read",
      "reports.read", "reports.export",
      "finance.read",
      "users.read",
      "settings.read",
      "settings.tab.users", "settings.tab.roles",
      "mail.read", "whatsapp.read",
    ],
    isSystem: true,
    color: "#3A6EA5",
  },
  {
    name: "manager",
    displayName: "Manager",
    description: "Manages CRM pipeline, proposal approvals, team tasks, and drawing reviews.",
    permissions: [
      "dashboard.read",
      "crm.read", "crm.create", "crm.update",
      "crm.tab.clients", "crm.tab.leads", "crm.tab.meetings", "crm.tab.converted", "crm.tab.lost",
      "kit.read", "kit.create", "kit.update",
      "kit.tab.templates",
      "proposal.read", "proposal.create", "proposal.update", "proposal.approve",
      "proposal.tab.templates", "proposal.tab.approval",
      "clients.read", "clients.update",
      "projects.read", "projects.create", "projects.update",
      "projects.tab.assign", "projects.tab.review",
      "tasks.read", "tasks.create", "tasks.update", "tasks.delete", "tasks.approve", "tasks.reassign",
      "pms.tab.tasks", "pms.tab.drawings", "pms.tab.team",
      "drawings.read", "drawings.upload", "drawings.approve", "drawings.release",
      "design.comment",
      "designer.dashboard",
      "site_logs.read", "site_logs.create",
      "site_visits.read", "site_visits.create", "site_visits.update",
      "vendor.read", "vendor.create", "vendor.update",
      "materials.read", "materials.create", "materials.update", "materials.delete",
      "purchase_orders.read", "purchase_orders.create", "purchase_orders.update",
      "milestones.read", "milestones.create", "milestones.update", "milestones.delete",
      "approvals.read", "approvals.create", "approvals.respond",
      "activity.read",
      "calendar.read",
      "pms.whatsapp.manage",
      "reports.read",
      "users.read",
      "settings.read",
      "settings.tab.users", "settings.tab.roles",
      "mail.send", "mail.read", "mail.manage",
      "whatsapp.send", "whatsapp.read", "whatsapp.manage",
      "communication.settings.manage",
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
      "crm.tab.clients", "crm.tab.leads", "crm.tab.meetings", "crm.tab.converted", "crm.tab.lost",
      "kit.read", "kit.create", "kit.update",
      "proposal.read", "proposal.create", "proposal.update",
      "proposal.tab.templates",
      "clients.read",
      "tasks.read",
      "mail.send", "mail.read",
      "whatsapp.send", "whatsapp.read",
    ],
    isSystem: true,
    color: "#D4B76C",
  },
  {
    name: "designer",
    displayName: "Designer",
    description: "Accesses project files, tasks, drawings, and design-related modules.",
    permissions: [
      "dashboard.read",
      "projects.read",
      "tasks.read", "tasks.update", "tasks.submit",
      "pms.tab.tasks", "pms.tab.drawings", "pms.tab.team",
      "drawings.read", "drawings.upload",
      "design.comment",
      "designer.dashboard",
      "site_logs.read",
      "site_visits.read", "site_visits.create",
      "materials.read", "materials.create", "materials.update",
      "purchase_orders.read",
      "milestones.read",
      "approvals.read", "approvals.create",
      "activity.read",
      "calendar.read",
      "clients.read",
    ],
    isSystem: true,
    color: "#9B59B6",
  },
  {
    name: "supervisor",
    displayName: "Supervisor",
    description: "Oversees on-site work, updates project and task progress, logs site visits.",
    permissions: [
      "dashboard.read",
      "crm.read",
      "projects.read", "projects.update",
      "tasks.read", "tasks.create", "tasks.update",
      "pms.tab.tasks", "pms.tab.drawings",
      "drawings.read",
      "site_logs.read", "site_logs.create",
      "site_visits.read", "site_visits.create",
      "materials.read",
      "purchase_orders.read",
      "milestones.read",
      "activity.read",
      "calendar.read",
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
