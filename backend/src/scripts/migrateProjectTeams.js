/**
 * migrateProjectTeams — Dynamic Team Assignments migration.
 *
 * Converts the 7 hardcoded team slot fields on each Project into the new
 * `assignments: [{ responsibilityId, users: [] }]` shape, backed by an
 * admin-managed `Responsibility` master list.
 *
 * Idempotent (skips if responsibilities are already seeded). Per-project
 * idempotent (skips if `assignments` already has entries and `_legacyTeam`
 * has been written).
 *
 * Also updates WorkflowTemplate task definitions: `teamSlot` string →
 * `responsibilitySlug` via the same mapping table.
 *
 * Old fields stay on disk but are no longer in the Mongoose schema, so they
 * become read-only via direct Mongo queries. The migration $unsets them
 * after copying into `_legacyTeam`.
 *
 * Usage:
 *   node backend/src/scripts/migrateProjectTeams.js              # apply
 *   node backend/src/scripts/migrateProjectTeams.js --dry-run    # report only
 *   node backend/src/scripts/migrateProjectTeams.js --rollback   # restore old fields from _legacyTeam
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Project = require("../modules/pms/models/Project.model");
const Responsibility = require("../modules/pms/models/Responsibility.model");
const WorkflowTemplate = require("../modules/pms/models/WorkflowTemplate.model");

const DRY_RUN = process.argv.includes("--dry-run") || process.argv.includes("--dry");
const ROLLBACK = process.argv.includes("--rollback");

// Old field → new responsibility slug. Mirrors the legacy SLOTS constant
// that drove ManageTeamModal.
const SLOT_TO_SLUG = {
  primaryDesigner: "lead_designer",
  supervisor:      "supervisor",
  designerB:       "furniture_measurements",
  designerC:       "technical_drawings",
  designerD:       "bathroom_kitchen",
  designerE:       "concept_3d",
  contractor:      "contractor",
};

// Seed payload for the responsibility master list. Two `system: true`
// rows (lead_designer, supervisor) cannot be deleted by the admin UI.
const SEED_RESPONSIBILITIES = [
  {
    slug: "lead_designer",
    name: "Lead Designer",
    category: "design",
    system: true,
    defaultRoles: ["designer", "manager", "admin", "md"],
    icon: "Star",
    color: "text-[var(--primary)]",
    order: 1,
  },
  {
    slug: "supervisor",
    name: "Site Supervisor",
    category: "site",
    system: true,
    defaultRoles: ["supervisor", "manager"],
    icon: "HardHat",
    color: "text-amber-600",
    order: 2,
  },
  {
    slug: "furniture_measurements",
    name: "Furniture & Measurements",
    category: "design",
    defaultRoles: ["designer"],
    icon: "Ruler",
    color: "text-blue-600",
    order: 3,
  },
  {
    slug: "technical_drawings",
    name: "Technical Drawings",
    category: "design",
    defaultRoles: ["designer"],
    vendorKinds: ["ac", "automation"],
    icon: "Settings2",
    color: "text-indigo-600",
    order: 4,
  },
  {
    slug: "bathroom_kitchen",
    name: "Bathroom & Kitchen",
    category: "design",
    defaultRoles: ["designer"],
    vendorKinds: ["kitchen"],
    icon: "Droplets",
    color: "text-cyan-600",
    order: 5,
  },
  {
    slug: "concept_3d",
    name: "Concept & 3D",
    category: "design",
    defaultRoles: ["designer"],
    icon: "Layers",
    color: "text-purple-600",
    order: 6,
  },
  {
    slug: "contractor",
    name: "Contractor",
    category: "exec",
    defaultRoles: ["designer", "supervisor", "manager", "admin", "md"],
    icon: "Wrench",
    color: "text-slate-600",
    order: 7,
  },
  // Examples of responsibilities admins commonly mention but which weren't
  // expressible under the old 7-slot model. Seeded as non-system so admins
  // can rename/archive freely.
  {
    slug: "site_measurement",
    name: "Site Measurement",
    category: "site",
    defaultRoles: ["designer", "supervisor"],
    icon: "Ruler",
    color: "text-emerald-600",
    order: 8,
  },
  {
    slug: "mep",
    name: "MEP Coordination",
    category: "exec",
    defaultRoles: ["designer", "supervisor"],
    icon: "Settings2",
    color: "text-orange-600",
    order: 9,
  },
  {
    slug: "client_liaison",
    name: "Client Liaison",
    category: "other",
    defaultRoles: ["designer", "manager", "admin", "md"],
    icon: "Users",
    color: "text-pink-600",
    order: 10,
  },
];

async function seedResponsibilities() {
  let inserted = 0;
  for (const seed of SEED_RESPONSIBILITIES) {
    const existing = await Responsibility.findOne({ slug: seed.slug });
    if (existing) continue;
    if (DRY_RUN) {
      console.log(`[dry] would seed responsibility ${seed.slug}`);
    } else {
      await Responsibility.create(seed);
    }
    inserted++;
  }
  return inserted;
}

async function buildSlugToIdMap() {
  const docs = await Responsibility.find({}, { slug: 1 }).lean();
  return new Map(docs.map((d) => [d.slug, d._id]));
}

async function migrateProjects(slugToId) {
  // Read raw docs so the dropped legacy fields are still visible.
  const projects = await Project.collection
    .find({})
    .project({
      _id: 1,
      assignments: 1,
      _legacyTeam: 1,
      primaryDesigner: 1,
      supervisor: 1,
      designerB: 1,
      designerC: 1,
      designerD: 1,
      designerE: 1,
      contractor: 1,
    })
    .toArray();

  let migrated = 0;
  let skipped = 0;

  for (const p of projects) {
    const alreadyMigrated =
      Array.isArray(p.assignments) && p.assignments.length > 0 && p._legacyTeam;
    if (alreadyMigrated) {
      skipped++;
      continue;
    }

    // Build assignments — same user across multiple slots collapses into one
    // entry per (responsibility, user) — but since each responsibility maps
    // to at most one legacy field, dedup happens at the responsibility level
    // naturally.
    const assignments = [];
    const legacy = { migratedAt: new Date() };
    for (const [field, slug] of Object.entries(SLOT_TO_SLUG)) {
      const userId = p[field];
      legacy[field] = userId || null;
      if (!userId) continue;
      const respId = slugToId.get(slug);
      if (!respId) continue;
      const existing = assignments.find((a) => String(a.responsibilityId) === String(respId));
      if (existing) {
        if (!existing.users.some((u) => String(u) === String(userId))) {
          existing.users.push(userId);
        }
      } else {
        assignments.push({ responsibilityId: respId, users: [userId] });
      }
    }

    if (DRY_RUN) {
      console.log(`[dry] would migrate project ${p._id}: ${assignments.length} assignments`);
      migrated++;
      continue;
    }

    await Project.collection.updateOne(
      { _id: p._id },
      {
        $set: { assignments, _legacyTeam: legacy },
        $unset: {
          primaryDesigner: "",
          supervisor: "",
          designerB: "",
          designerC: "",
          designerD: "",
          designerE: "",
          contractor: "",
        },
      }
    );
    migrated++;
  }

  return { migrated, skipped };
}

async function migrateWorkflowTemplates() {
  const templates = await WorkflowTemplate.find({});
  let touched = 0;

  for (const tpl of templates) {
    let dirty = false;
    for (const t of tpl.tasks || []) {
      if (t.teamSlot && !t.responsibilitySlug) {
        const slug = SLOT_TO_SLUG[t.teamSlot];
        if (slug) {
          t.responsibilitySlug = slug;
          t.teamSlot = undefined;
          dirty = true;
        }
      }
    }
    if (dirty) {
      if (DRY_RUN) {
        console.log(`[dry] would update template ${tpl._id} (${tpl.name})`);
      } else {
        await tpl.save();
      }
      touched++;
    }
  }
  return touched;
}

async function rollback() {
  const projects = await Project.collection
    .find({ _legacyTeam: { $exists: true } })
    .project({ _id: 1, _legacyTeam: 1 })
    .toArray();

  let restored = 0;
  for (const p of projects) {
    const legacy = p._legacyTeam || {};
    const set = {};
    for (const field of Object.keys(SLOT_TO_SLUG)) {
      if (legacy[field]) set[field] = legacy[field];
    }
    if (DRY_RUN) {
      console.log(`[dry] would restore project ${p._id} → ${Object.keys(set).join(",")}`);
      restored++;
      continue;
    }
    await Project.collection.updateOne(
      { _id: p._id },
      { $set: set, $unset: { assignments: "", _legacyTeam: "" } }
    );
    restored++;
  }
  return restored;
}

(async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGO_URI / MONGODB_URI is not set in .env");
    await mongoose.connect(uri);
    console.log(`Connected. Mode: ${DRY_RUN ? "DRY RUN" : ROLLBACK ? "ROLLBACK" : "APPLY"}`);

    if (ROLLBACK) {
      const restored = await rollback();
      console.log(`Rollback complete. Projects restored: ${restored}`);
    } else {
      const seeded = await seedResponsibilities();
      console.log(`Responsibilities seeded: ${seeded}`);
      const slugToId = await buildSlugToIdMap();
      const { migrated, skipped } = await migrateProjects(slugToId);
      console.log(`Projects migrated: ${migrated}, already-migrated skipped: ${skipped}`);
      const tplsTouched = await migrateWorkflowTemplates();
      console.log(`WorkflowTemplates updated: ${tplsTouched}`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("[migrateProjectTeams] FAILED:", err);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
  }
})();
