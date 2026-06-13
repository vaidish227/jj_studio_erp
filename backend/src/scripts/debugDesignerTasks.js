/**
 * Diagnostic: why don't planner tasks show on the designer's dashboard /
 * My Tasks after Make Plan Effective?
 *
 *   node backend/src/scripts/debugDesignerTasks.js <trackingId>
 *
 * Dumps every task for the project (assignee, status, delegatedAt, dueDate),
 * then replays the exact getMyTasks / designer-dashboard queries for each
 * distinct assignee so we can see what the designer would receive.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Project = require("../modules/pms/models/Project.model");
const Task = require("../modules/pms/models/Task.model");
const ProjectPlan = require("../modules/pms/models/ProjectPlan.model");
const User = require("../modules/auth/models/user.model");

const trackingId = process.argv[2] || "PRJ-2026-0015";

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  const project = await Project.findOne({ trackingId }).select("name trackingId status phase").lean();
  if (!project) { console.error("project not found:", trackingId); process.exit(1); }
  const plan = await ProjectPlan.findOne({ projectId: project._id }).select("effectiveAt").lean();
  console.log("project:", project.name, "| status:", project.status, "| phase:", project.phase, "| plan.effectiveAt:", plan?.effectiveAt || null);

  const tasks = await Task.find({ projectId: project._id })
    .select("title status workStatus assignedTo delegatedAt dueDate planning.plannedEndDate")
    .populate("assignedTo", "name email role")
    .lean();
  console.log("\n--- tasks in project:", tasks.length, "---");
  for (const t of tasks) {
    console.log(
      `· ${t.title} | status=${t.status} | workStatus=${t.workStatus}`
      + ` | assignedTo=${t.assignedTo ? `${t.assignedTo.name} (${t.assignedTo.role || "?"})` : "NONE"}`
      + ` | delegatedAt=${t.delegatedAt ? new Date(t.delegatedAt).toISOString().slice(0, 16) : "null"}`
      + ` | dueDate=${t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : "null"}`
      + ` | plannedEnd=${t.planning?.plannedEndDate ? new Date(t.planning.plannedEndDate).toISOString().slice(0, 10) : "null"}`
    );
  }

  const Role = require("../modules/auth/models/Role.model");
  const { aliasesFor } = require("../modules/auth/permissions/aliases");
  const has = (perms, p) => perms.includes("*") || perms.includes(p) || aliasesFor(p).some((a) => perms.includes(a));

  const assigneeIds = [...new Set(tasks.filter((t) => t.assignedTo).map((t) => String(t.assignedTo._id)))];
  for (const uid of assigneeIds) {
    const u = await User.findById(uid).select("name role customPermissions").lean();
    const role = await Role.findOne({ name: u?.role }).lean();
    const effective = [...new Set([...(role?.permissions || []), ...(u?.customPermissions || [])])];
    const myTasks = await Task.find({ assignedTo: uid }).select("title status projectId").lean();
    console.log(`\n--- ${u?.name} (role=${u?.role}) → getMyTasks would return ${myTasks.length} task(s) ---`);
    console.log(`  role doc found: ${!!role} | effective perms: ${effective.length}`);
    for (const p of ["tasks.read", "designer.dashboard", "drawings.read", "planner.read"]) {
      console.log(`  ${p}: ${has(effective, p)}`);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
