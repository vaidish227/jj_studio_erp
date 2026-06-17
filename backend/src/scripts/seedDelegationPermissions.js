/**
 * Delegation RBAC migration — ADDITIVE ONLY (no business data).
 *
 * - Adds `delegation.*` permission strings to existing roles via $addToSet
 *   (never removes anything from a role).
 * - Upserts the new department-team roles: mis, marketing, hr.
 *
 * Source of truth = DEFAULT_ROLES in seedRoles.js (this script reads it, so the
 * two never drift). Re-running base seedRoles.js stays consistent because the
 * delegation grants now live in DEFAULT_ROLES too.
 *
 *   Dry run (NO writes):  node backend/src/scripts/seedDelegationPermissions.js --dry-run
 *   Apply:                node backend/src/scripts/seedDelegationPermissions.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Role = require("../modules/auth/models/Role.model");
const { DEFAULT_ROLES } = require("./seedRoles");

const DRY = process.argv.includes("--dry-run");

async function run() {
  if (!process.env.MONGO_URI) {
    console.error("[delegation-rbac] MONGO_URI is not set — aborting.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(
    `\n[delegation-rbac] ${DRY ? "DRY RUN (read-only, no writes)" : "APPLY"} — connected to MongoDB\n`
  );

  const report = { created: [], updated: [], unchanged: [] };

  for (const def of DEFAULT_ROLES) {
    const delegationPerms = (def.permissions || []).filter((p) =>
      p.startsWith("delegation.")
    );
    const existing = await Role.findOne({ name: def.name }).lean();

    // Role doesn't exist yet (new department-team roles) → create in full.
    if (!existing) {
      report.created.push({ name: def.name, permissions: def.permissions });
      if (!DRY) {
        await Role.findOneAndUpdate(
          { name: def.name },
          { $set: def },
          { upsert: true, new: true }
        );
      }
      continue;
    }

    // Admin (or any wildcard role) already has everything — leave untouched.
    if (existing.permissions.includes("*")) {
      report.unchanged.push(`${def.name} (wildcard)`);
      continue;
    }

    // Existing role → only ADD the delegation perms it is missing.
    const toAdd = delegationPerms.filter((p) => !existing.permissions.includes(p));
    if (toAdd.length === 0) {
      report.unchanged.push(def.name);
      continue;
    }

    report.updated.push({ name: def.name, added: toAdd });
    if (!DRY) {
      await Role.updateOne(
        { name: def.name },
        { $addToSet: { permissions: { $each: toAdd } } }
      );
    }
  }

  // ─── Report ─────────────────────────────────────────────────────────────────
  console.log("Roles created:");
  if (report.created.length) {
    report.created.forEach((r) =>
      console.log(`  + ${r.name}  [${r.permissions.join(", ")}]`)
    );
  } else {
    console.log("  (none)");
  }

  console.log("\nRoles updated (delegation perms added — nothing removed):");
  if (report.updated.length) {
    report.updated.forEach((r) => console.log(`  ~ ${r.name}  +[${r.added.join(", ")}]`));
  } else {
    console.log("  (none)");
  }

  console.log("\nUnchanged:");
  console.log("  " + (report.unchanged.join(", ") || "(none)"));

  console.log(
    `\n[delegation-rbac] ${
      DRY ? "DRY RUN complete — no changes written." : "APPLY complete."
    }\n`
  );

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("[delegation-rbac] FAILED:", err);
  process.exit(1);
});
