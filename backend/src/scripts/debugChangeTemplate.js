/**
 * Diagnostic: replicate Planner.changeTemplate for one project with full
 * error stacks, to find why the API returned 500.
 *
 *   node backend/src/scripts/debugChangeTemplate.js <trackingId> <templateName>
 */
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Project = require("../modules/pms/models/Project.model");
const Task = require("../modules/pms/models/Task.model");
const Drawing = require("../modules/pms/models/Drawing.model");
const ProjectPlan = require("../modules/pms/models/ProjectPlan.model");
const WorkflowTemplate = require("../modules/pms/models/WorkflowTemplate.model");
const TaskDependency = require("../modules/pms/models/TaskDependency.model");
const ApprovalGate = require("../modules/pms/models/ApprovalGate.model");
const workflowEngine = require("../modules/pms/services/workflowEngine");

const trackingId = process.argv[2] || "PRJ-2026-0014";
const templateName = process.argv[3] || "Residential 2bhk";

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log("✔ Mongo connected · WORKFLOW_GATES_ENABLED =", process.env.WORKFLOW_GATES_ENABLED, "· WORKFLOW_ENGINE_V1 =", process.env.WORKFLOW_ENGINE_V1);

  const project = await Project.findOne({ trackingId }).select("name trackingId workflowTemplateId planSnapshot").lean();
  if (!project) { console.error("✖ project not found:", trackingId); process.exit(1); }
  const template = await WorkflowTemplate.findOne({ name: templateName }).select("_id name isActive").lean();
  if (!template) { console.error("✖ template not found:", templateName); process.exit(1); }

  const plan = await ProjectPlan.findOne({ projectId: project._id }).select("effectiveAt").lean();
  const seededTasks = await Task.find({ projectId: project._id, templateTaskKey: { $exists: true, $nin: [null, ""] } })
    .select("_id status planning.actualHours").lean();
  console.log("project:", project.name, "| current template:", project.planSnapshot?.templateName, "| workflowTemplateId:", project.workflowTemplateId);
  console.log("target template:", template.name, template._id.toString(), "isActive:", template.isActive);
  console.log("plan.effectiveAt:", plan?.effectiveAt || null, "| seeded tasks:", seededTasks.length, "statuses:", seededTasks.map((t) => t.status).join(","));

  const started = seededTasks.filter((t) => !["not_started", "blocked"].includes(t.status) || Number(t.planning?.actualHours || 0) > 0);
  if (started.length) { console.error("✖ guard would refuse: TEMPLATE_TASKS_IN_PROGRESS", started.length); process.exit(1); }
  const seededIds = seededTasks.map((t) => t._id);
  if (seededIds.length && await Drawing.exists({ taskId: { $in: seededIds } })) {
    console.error("✖ guard would refuse: TEMPLATE_TASKS_HAVE_DRAWINGS"); process.exit(1);
  }
  if (plan?.effectiveAt) { console.error("✖ guard would refuse: PLAN_ALREADY_EFFECTIVE"); process.exit(1); }

  try {
    await TaskDependency.deleteMany({ projectId: project._id });
    await ApprovalGate.deleteMany({ projectId: project._id });
    if (seededIds.length) await Task.deleteMany({ _id: { $in: seededIds } });
    await Project.updateOne(
      { _id: project._id },
      { $set: { currentGateIds: [] }, $unset: { workflowTemplateId: 1, planSnapshot: 1 } }
    );
    console.log("✔ teardown done — running seedProject…");
    const summary = await workflowEngine.seedProject(project._id, { templateId: template._id });
    console.log("✔ seedProject result:", JSON.stringify(summary));
  } catch (err) {
    console.error("✖ FAILED:\n", err.stack || err);
    process.exit(1);
  }

  const after = await Project.findById(project._id).select("planSnapshot.templateName phase").lean();
  const count = await Task.countDocuments({ projectId: project._id });
  console.log("✔ after — template:", after.planSnapshot?.templateName, "| phase:", after.phase, "| tasks:", count);
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error("✖", e); process.exit(1); });
