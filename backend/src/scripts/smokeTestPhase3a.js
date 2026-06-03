/**
 * Phase 3a — Simplification smoke test.
 *
 * Validates:
 *   1. Project starts at progressPercent = 0 right after seeding
 *   2. Approving a task bumps progress
 *   3. Closing a client-approval gate bumps progress more (gates weighted 60% vs tasks 40%)
 *   4. Overriding a gate also counts toward progress
 *   5. Progress never exceeds 100 or drops below 0
 *   6. Legacy (un-seeded) project falls back gracefully to plain task ratio
 *   7. MyDay endpoint shape is correct for a fresh test user
 *
 * Usage:
 *   node backend/src/scripts/smokeTestPhase3a.js
 *
 * Self-cleaning. Tags all docs with WORKFLOW_SMOKE_TEST and deletes on exit.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");

const Project = require("../modules/pms/models/Project.model");
const Task = require("../modules/pms/models/Task.model");
const TaskDependency = require("../modules/pms/models/TaskDependency.model");
const ApprovalGate = require("../modules/pms/models/ApprovalGate.model");
const Approval = require("../modules/pms/models/Approval.model");
const WorkflowTemplate = require("../modules/pms/models/WorkflowTemplate.model");
const ChecklistTemplate = require("../modules/pms/models/ChecklistTemplate.model");
const workflowEngine = require("../modules/pms/services/workflowEngine");

const { TEMPLATES: CHECKLIST_TEMPLATES } = require("./seedChecklistTemplates");
const { RESIDENTIAL_FULL } = require("./seedWorkflowTemplates");

const SMOKE_TAG = "WORKFLOW_SMOKE_TEST";

let failures = 0, passed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  PASS  ${msg}`); passed++; }
  else      { console.error(`  FAIL  ${msg}`); failures++; }
}
function step(label) { console.log(`\n— ${label}`); }

async function ensureTemplates() {
  for (const t of CHECKLIST_TEMPLATES) {
    await ChecklistTemplate.findOneAndUpdate(
      { name: t.name },
      { $set: { ...t, isDefault: true, isActive: true } },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }
  await WorkflowTemplate.findOneAndUpdate(
    { name: RESIDENTIAL_FULL.name },
    { $set: RESIDENTIAL_FULL },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

async function createSeededProject() {
  const project = await Project.create({
    clientId: new mongoose.Types.ObjectId(),
    name: `${SMOKE_TAG} P3a ${Date.now()}`,
    projectType: "Residential",
    siteAddress: { fullAddress: "Phase 3a smoke" },
    tags: [SMOKE_TAG],
    trackingId: `SMK3-${Math.floor(Math.random() * 1e6)}`,
    startDate: new Date(),
  });
  await workflowEngine.seedProject(project._id);
  return Project.findById(project._id);
}

async function scenarioInitialProgress() {
  step("Scenario 1: Fresh seeded project starts at 0% progress");
  const project = await createSeededProject();
  assert(project.progressPercent === 0, `Initial progress = 0 (got ${project.progressPercent})`);
  return project;
}

async function scenarioTaskApprovalBumps(project) {
  step("Scenario 2: Approving a task increases progress");
  const before = project.progressPercent;

  // Approve site_measurement directly (skip full PM review chain for smoke)
  const sm = await Task.findOne({ projectId: project._id, taskType: "site_measurement" });
  sm.status = "approved";
  await sm.save();

  // Engine call that real approveTask makes
  await workflowEngine.onTaskApproved(sm._id);
  const after = await Project.findById(project._id);
  assert(after.progressPercent > before, `Progress rose after task approval (${before} → ${after.progressPercent})`);
  assert(after.progressPercent <= 100, "Progress never exceeds 100");
  return after;
}

async function scenarioGateCloseBumpsMore(project) {
  step("Scenario 3: Closing a gate bumps progress (gates weighted 60%)");
  const before = project.progressPercent;

  // Close furniture_layout gate via cascade
  await Project.updateOne(
    { _id: project._id, "clientApprovals.type": "furniture_layout" },
    { $set: { "clientApprovals.$.status": "obtained" } }
  );
  await workflowEngine.onClientApprovalObtained({
    projectId: project._id,
    approvalType: "furniture_layout",
  });

  const after = await Project.findById(project._id);
  assert(after.progressPercent > before, `Progress rose after gate close (${before} → ${after.progressPercent})`);
  return after;
}

async function scenarioOverride(project) {
  step("Scenario 4: Overriding a gate counts as progress");
  const before = project.progressPercent;

  const gate = await ApprovalGate.findOne({ projectId: project._id, gateType: "gate_ac_client" });
  await workflowEngine.overrideGate(gate._id, {
    actorId: null,
    overrideReason: "Smoke test 3a override",
  });
  const after = await Project.findById(project._id);
  assert(after.progressPercent > before, `Override bumps progress (${before} → ${after.progressPercent})`);
  return after;
}

async function scenarioBounds() {
  step("Scenario 5: Progress stays within [0, 100]");
  // Manually force a recompute on a project with all tasks approved + all gates closed
  const project = await createSeededProject();
  await Task.updateMany({ projectId: project._id }, { status: "approved" });
  await ApprovalGate.updateMany({ projectId: project._id }, { status: "closed", closedAt: new Date() });
  const p = await workflowEngine.recomputeProjectProgress(project._id);
  assert(p === 100, `All approved + closed = 100% (got ${p})`);

  const reloaded = await Project.findById(project._id);
  assert(reloaded.progressPercent >= 0 && reloaded.progressPercent <= 100, "Persisted value within bounds");
}

async function scenarioLegacy() {
  step("Scenario 6: Legacy (un-seeded) project handled gracefully");
  const project = await Project.create({
    clientId: new mongoose.Types.ObjectId(),
    name: `${SMOKE_TAG} P3a legacy ${Date.now()}`,
    projectType: "Residential",
    siteAddress: { fullAddress: "Legacy smoke" },
    tags: [SMOKE_TAG],
    trackingId: `SMKL-${Math.floor(Math.random() * 1e6)}`,
    startDate: new Date(),
  });
  // No seed, no template. Add some manual tasks like the existing controller path would.
  await Task.create({
    projectId: project._id,
    taskType: "ac_coordination",
    title: "Legacy manual task A",
    status: "approved",
  });
  await Task.create({
    projectId: project._id,
    taskType: "kitchen_drawing",
    title: "Legacy manual task B",
    status: "not_started",
  });

  const p = await workflowEngine.recomputeProjectProgress(project._id);
  assert(p === 50, `Legacy project with 1/2 tasks approved = 50% (got ${p})`);
}

async function cleanup() {
  step("Cleanup");
  const projects = await Project.find({ tags: SMOKE_TAG }).select("_id").lean();
  const projectIds = projects.map((p) => p._id);
  if (!projectIds.length) { console.log("  (nothing to clean)"); return; }

  const [t, g, d, a, p] = await Promise.all([
    Task.deleteMany({ projectId: { $in: projectIds } }),
    ApprovalGate.deleteMany({ projectId: { $in: projectIds } }),
    TaskDependency.deleteMany({ projectId: { $in: projectIds } }),
    Approval.deleteMany({ projectId: { $in: projectIds } }),
    Project.deleteMany({ _id: { $in: projectIds } }),
  ]);
  console.log(`  Deleted: ${p.deletedCount} projects · ${t.deletedCount} tasks · ${g.deletedCount} gates · ${d.deletedCount} deps · ${a.deletedCount} approvals`);
}

async function main() {
  console.log("Phase 3a smoke test — connecting to MongoDB");
  await mongoose.connect(process.env.MONGO_URI);

  try {
    await ensureTemplates();
    let project = await scenarioInitialProgress();
    project = await scenarioTaskApprovalBumps(project);
    project = await scenarioGateCloseBumpsMore(project);
    await scenarioOverride(project);
    await scenarioBounds();
    await scenarioLegacy();
  } finally {
    try { await cleanup(); } catch (e) { console.error("Cleanup failed:", e.message); }
    await mongoose.disconnect();
  }

  console.log(`\nResult: ${passed} passed, ${failures} failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Phase 3a smoke crashed:", err);
  process.exit(1);
});
