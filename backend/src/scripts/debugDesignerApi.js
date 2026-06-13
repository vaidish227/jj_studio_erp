/**
 * Diagnostic: call the running backend as a designer would.
 *
 *   node backend/src/scripts/debugDesignerApi.js <designerName>
 *
 * Signs a JWT for the designer (same payload shape as login) and requests
 * /api/pms/task/my-tasks + /api/pms/designer/dashboard, printing counts only.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("../modules/auth/models/user.model");

const name = process.argv[2] || "Adarsh";
const PORT = process.env.PORT || 5000;

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const u = await User.findOne({ name: new RegExp(`^${name}$`, "i") }).select("_id name email role").lean();
  if (!u) { console.error("user not found:", name); process.exit(1); }
  console.log("user:", u.name, u.role, String(u._id));
  await mongoose.disconnect();

  const token = jwt.sign({ id: String(u._id), email: u.email, role: u.role }, process.env.JWT_SECRET || "secretkey", { expiresIn: "10m" });
  const headers = { Authorization: `Bearer ${token}` };

  for (const path of ["/api/pms/task/my-tasks", "/api/pms/designer/dashboard"]) {
    try {
      const res = await fetch(`http://localhost:${PORT}${path}`, { headers });
      const body = await res.json().catch(() => ({}));
      if (path.endsWith("my-tasks")) {
        console.log(`${path} → ${res.status} | count=${body.count} | message=${body.message || ""}`);
      } else {
        console.log(`${path} → ${res.status} | actionQueue=${body.actionQueue?.length} | totalTasks=${body.stats?.totalTasks} | activeProjects=${body.activeProjects?.length} | message=${body.message || ""}`);
      }
    } catch (e) {
      console.log(`${path} → request failed: ${e.message}`);
    }
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
