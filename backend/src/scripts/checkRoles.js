require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Role = require("../modules/auth/models/Role.model");

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, family: 4 });
  const roles = await Role.find({}, { name: 1, permissions: 1, _id: 0 }).lean();
  console.log("Roles in DB:", roles.length);
  for (const r of roles) {
    console.log(` - ${r.name}: ${r.permissions.length} perms${r.permissions.includes("*") ? " (WILDCARD)" : ""}`);
  }
  await mongoose.disconnect();
  process.exit(0);
})();
