/* One-off: re-point a project's master sheet to its projectType default template.
 * Mirrors Planner.controller.changeTemplate but runnable from CLI.
 *   node src/scripts/repointTemplate.js PRJ-2026-0013
 * Safe only when the plan is not yet effective and no real work has started. */
require("dotenv").config();
const mongoose = require("mongoose");
const Project = require("../modules/pms/models/Project.model");
const Task = require("../modules/pms/models/Task.model");
const WorkflowTemplate = require("../modules/pms/models/WorkflowTemplate.model");
const workflowEngine = require("../modules/pms/services/workflowEngine");
let ApprovalGate = null, TaskDependency = null, ProjectPlan = null;
try { ApprovalGate = require("../modules/pms/models/ApprovalGate.model"); } catch {}
try { TaskDependency = require("../modules/pms/models/TaskDependency.model"); } catch {}
try { ProjectPlan = require("../modules/pms/models/ProjectPlan.model"); } catch {}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const code = process.argv[2] || "PRJ-2026-0013";

  const project = await Project.findOne({ trackingId: code });
  if (!project) { console.log("Project not found:", code); process.exit(1); }

  // Guard — don't blow away started work.
  const plan = ProjectPlan ? await ProjectPlan.findOne({ projectId: project._id }).select("effectiveAt").lean() : null;
  if (plan?.effectiveAt) { console.log("Plan already effective — aborting."); process.exit(1); }

  const def =
    (await WorkflowTemplate.findOne({ isDefault: true, isActive: true, projectType: project.projectType }).lean()) ||
    (await WorkflowTemplate.findOne({ isDefault: true, isActive: true, projectType: "Any" }).lean()) ||
    (await WorkflowTemplate.findOne({ isDefault: true, isActive: true }).lean());
  if (!def) { console.log("No default template found."); process.exit(1); }

  console.log(`Re-pointing ${code} (${project.projectType}) -> "${def.name}" (${def.projectType})`);

  // Remove template-seeded rows only; ad-hoc rows (no templateTaskKey) survive.
  const seeded = await Task.find({
    projectId: project._id,
    templateTaskKey: { $exists: true, $nin: [null, ""] },
  }).select("_id status planning.actualHours").lean();

  const started = seeded.filter(
    (t) => !["not_started", "blocked", "draft", "pending"].includes(t.status)
        || Number(t.planning?.actualHours || 0) > 0
  );
  if (started.length) { console.log(`${started.length} seeded task(s) have work — aborting to be safe.`); process.exit(1); }

  const ids = seeded.map((t) => t._id);
  if (TaskDependency) await TaskDependency.deleteMany({ projectId: project._id });
  if (ApprovalGate) await ApprovalGate.deleteMany({ projectId: project._id });
  if (ids.length) await Task.deleteMany({ _id: { $in: ids } });

  await Project.updateOne(
    { _id: project._id },
    { $set: { currentGateIds: [] }, $unset: { workflowTemplateId: 1, planSnapshot: 1 } }
  );

  const summary = await workflowEngine.seedProject(project._id, { templateId: def._id });
  console.log("Re-seed summary:", summary);

  const after = await Project.findById(project._id).select("planSnapshot").lean();
  console.log("New snapshot template:", after?.planSnapshot?.templateName, "| customized:", after?.planSnapshot?.customized);

  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
