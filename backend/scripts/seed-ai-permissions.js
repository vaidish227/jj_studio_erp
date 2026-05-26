/**
 * One-shot seed: grant `ai.chat` to every non-system role so existing users
 * can use the AI assistant immediately after deployment. Idempotent — uses
 * $addToSet, safe to re-run.
 *
 * Usage:
 *   node backend/scripts/seed-ai-permissions.js
 *
 * To also grant ai.admin to admin/md roles, pass --with-admin.
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mongoose = require("mongoose");
const { connectDb } = require("../src/config/db");
const Role = require("../src/modules/auth/models/Role.model");

const ARGS = process.argv.slice(2);
const WITH_ADMIN = ARGS.includes("--with-admin");

async function main() {
  await connectDb();

  const baseRes = await Role.updateMany(
    { name: { $nin: ["system", "guest"] } },
    { $addToSet: { permissions: { $each: ["ai.chat", "ai.docs.read"] } } }
  );
  console.log(`[seed-ai] ai.chat + ai.docs.read granted to ${baseRes.modifiedCount} role(s)`);

  if (WITH_ADMIN) {
    const adminRes = await Role.updateMany(
      { name: { $in: ["admin", "md"] } },
      { $addToSet: { permissions: { $each: ["ai.admin", "ai.docs.manage"] } } }
    );
    console.log(`[seed-ai] ai.admin + ai.docs.manage granted to ${adminRes.modifiedCount} role(s)`);
  }

  await mongoose.disconnect();
  console.log("[seed-ai] done.");
}

main().catch((err) => {
  console.error("[seed-ai] failed:", err);
  process.exit(1);
});
