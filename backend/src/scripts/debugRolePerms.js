/**
 * Diagnostic: print a role's permission list.
 *   node backend/src/scripts/debugRolePerms.js designer
 */
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Role = require("../modules/auth/models/Role.model");

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const r = await Role.findOne({ name: process.argv[2] || "designer" }).lean();
  console.log(r ? r.permissions.sort().join("\n") : "role not found");
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
