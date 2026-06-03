/**
 * Phase 1 — Workflow Engine smoke test.
 *
 * Runs end-to-end against the real MongoDB (uses MONGO_URI from .env).
 * Creates throw-away test documents inside a sentinel namespace
 * ("Workflow Smoke Test"); every doc is cleaned up at the end, even on failure.
 *
 * Usage:
 *   node backend/src/scripts/smokeTestPhase1.js
 *
 * Exits 0 on success, 1 on any assertion failure or thrown error.
 *
 * The 5 scenarios from the Phase 1 stabilisation spec:
 *   1. Workflow seeding (auto-task graph from "Residential Full")
 *   2. Blocked task enforcement (evaluateTaskAccess says canStart=false)
 *   3. Client approval unlock (onClientApprovalObtained → gate closes → tasks unblock)
 *   4. PM override (overrideGate flips status + unblocks tasks)
 *   5. Backward compatibility (un-seeded project still passes evaluateTaskAccess)
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");

const Project = require("../modules/pms/models/Project.model");
const Task = require("../modules/pms/models/Task.model");
const TaskDependency = require("../modules/pms/models/TaskDependency.model");
const ApprovalGate = require("../modules/pms/models/ApprovalGate.model");
const WorkflowTemplate = require("../modules/pms/models/WorkflowTemplate.model");
const ChecklistTemplate = require("../modules/pms/models/ChecklistTemplate.model");
const workflowEngine = require("../modules/pms/services/workflowEngine");

const { TEMPLATES: CHECKLIST_TEMPLATES } = require("./seedChecklistTemplates");
const { RESIDENTIAL_FULL } = require("./seedWorkflowTemplates");

const SMOKE_TAG = "WORKFLOW_SMOKE_TEST";
const SMOKE_TRACKING_PREFIX = "SMK-";

// Tiny test harness
let failures = 0;
let passed = 0;
function assert(cond, msg) {
  if (cond) {
    console.log(`  PASS  ${msg}`);
    passed++;
  } else {
    console.error(`  FAIL  ${msg}`);
    failures++;
  }
}
function step(label) {
  console.log(`\n— ${label}`);
}

async function ensureTemplatesSeeded() {
  step("Ensuring templates exist (upsert)");
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
  const tpl = await WorkflowTemplate.findOne({ name: RESIDENTIAL_FULL.name }).lean();
  assert(!!tpl, `WorkflowTemplate "${RESIDENTIAL_FULL.name}" present`);
  // Expected counts derived from the PDF Design Sub-Flow:
  //   kickoff: 3 (mep_collection, site_measurement, concept_making)
  //   layout: 1 (furniture_layout)
  //   design: 7 (civil, ac, automation, technical, kitchen, bathroom, 3d_render)
  //   handover: 1 (handover_signoff)
  assert(tpl.tasks.length === 12, `Template has 12 tasks (got ${tpl.tasks.length})`);
  assert(tpl.gates.length === 9, `Template has 9 gates (got ${tpl.gates.length})`);
  assert(tpl.phases.length === 7, `Template has 7 phases (got ${tpl.phases.length})`);
}

async function createSmokeProject({ skipSeed = false } = {}) {
  const project = await Project.create({
    clientId: new mongoose.Types.ObjectId(), // dummy ref OK
    name: `${SMOKE_TAG} ${Date.now()}`,
    projectType: "Residential",
    siteAddress: { fullAddress: "Smoke test site" },
    tags: [SMOKE_TAG],
    trackingId: `${SMOKE_TRACKING_PREFIX}${Math.floor(Math.random() * 1e6)}`,
    startDate: new Date(),
  });

  if (!skipSeed) {
    const summary = await workflowEngine.seedProject(project._id, { actorId: null });
    return { project: await Project.findById(project._id), summary };
  }
  return { project, summary: null };
}

async function scenarioSeed() {
  step("Scenario 1: Workflow seeding");
  const { project, summary } = await createSmokeProject();

  assert(summary.tasksCreated === 12, `seedProject created 12 tasks (got ${summary.tasksCreated})`);
  assert(summary.gatesCreated === 9, `seedProject created 9 gates (got ${summary.gatesCreated})`);
  // 2 deps: furniture_layout ← site_measurement, 3d_render ← concept_making
  assert(summary.depsCreated === 2, `seedProject wired 2 dependencies (got ${summary.depsCreated})`);

  assert(project.phase === "kickoff", `Project phase set to "kickoff" (got "${project.phase}")`);
  assert(!!project.workflowTemplateId, "Project.workflowTemplateId populated");
  assert((project.currentGateIds || []).length === 9, "Project.currentGateIds has 9 entries");

  const fl = await Task.findOne({ projectId: project._id, taskType: "furniture_layout" });
  assert(fl && fl.status === "blocked", `furniture_layout starts as "blocked" (got "${fl?.status}")`);
  assert(
    (fl?.dependsOn || []).length === 1,
    `furniture_layout.dependsOn has 1 entry (site_measurement) (got ${(fl?.dependsOn || []).length})`
  );

  const civil = await Task.findOne({ projectId: project._id, taskType: "civil_drawing" });
  assert(civil && civil.status === "blocked", `civil_drawing starts as "blocked" (gate_furniture_layout)`);
  assert(civil?.gateStatus === "open", `civil_drawing.gateStatus = "open"`);

  const kickoffTasks = ["mep_collection", "site_measurement", "concept_making"];
  for (const tt of kickoffTasks) {
    const t = await Task.findOne({ projectId: project._id, taskType: tt });
    assert(t && t.status === "not_started", `Kickoff task ${tt} is not_started`);
  }

  return project;
}

async function scenarioEnforcement(project) {
  step("Scenario 2: Blocked task enforcement (evaluateTaskAccess)");

  const civil = await Task.findOne({ projectId: project._id, taskType: "civil_drawing" });
  const access = await workflowEngine.evaluateTaskAccess(civil._id);
  assert(access.canStart === false, "evaluateTaskAccess.canStart = false for blocked civil_drawing");
  assert(access.openGates.length >= 1, "openGates list is non-empty");
  assert(
    access.openGates.some((g) => g.gateType === "gate_furniture_layout"),
    "gate_furniture_layout listed as a blocker for civil_drawing"
  );

  const sm = await Task.findOne({ projectId: project._id, taskType: "site_measurement" });
  const smAccess = await workflowEngine.evaluateTaskAccess(sm._id);
  assert(smAccess.canStart === true, "site_measurement is NOT blocked (no deps/gates)");
}

async function scenarioCascadeUnlock(project) {
  step("Scenario 3: Client approval cascade unblocks downstream tasks");

  // 3a. Approve site_measurement (prerequisite for furniture_layout)
  await Task.updateOne(
    { projectId: project._id, taskType: "site_measurement" },
    { status: "approved" }
  );

  // 3b. Close gate_furniture_layout via client approval cascade
  const result = await workflowEngine.onClientApprovalObtained({
    projectId: project._id,
    approvalType: "furniture_layout",
  });
  assert(result.closed === 1, `onClientApprovalObtained closed 1 gate (got ${result.closed})`);

  const gate = await ApprovalGate.findOne({ projectId: project._id, gateType: "gate_furniture_layout" });
  assert(gate.status === "closed", `gate_furniture_layout status = "closed" (got "${gate.status}")`);

  // 3c. Verify all 7 design tasks gated by furniture_layout have transitioned
  const gatedTypes = [
    "civil_drawing",
    "ac_coordination",
    "automation_coordination",
    "technical_drawing",
    "kitchen_drawing",
    "bathroom_drawing",
    "3d_render",
  ];
  for (const tt of gatedTypes) {
    const t = await Task.findOne({ projectId: project._id, taskType: tt });
    // 3d_render also depends on concept_making.approved, so it stays blocked.
    if (tt === "3d_render") {
      assert(t.status === "blocked", `${tt} stays "blocked" (still waiting on concept_making.approved)`);
    } else {
      assert(t.status === "not_started", `${tt} unblocked to "not_started" (got "${t.status}")`);
    }
  }
}

async function scenarioOverride(project) {
  step("Scenario 4: PM override of an open gate");

  // Pick an open gate that's still holding 3d_render
  const gate = await ApprovalGate.findOne({
    projectId: project._id,
    gateType: "gate_pd_3d_review",
  });
  assert(!!gate, "gate_pd_3d_review still open before override");

  const result = await workflowEngine.overrideGate(gate._id, {
    actorId: null,
    overrideReason: "Smoke test verbal override — written confirmation pending",
  });

  const reloaded = await ApprovalGate.findById(gate._id);
  assert(reloaded.status === "overridden", `Gate status = "overridden" (got "${reloaded.status}")`);
  assert(!!reloaded.overrideReason, "Override reason captured on gate");
  assert(typeof result.tasksUnblocked === "number", "overrideGate returned tasksUnblocked count");

  // Calling overrideGate again is a no-op
  const second = await workflowEngine.overrideGate(gate._id, {
    actorId: null,
    overrideReason: "second call",
  });
  assert(second.skipped === true, "Re-overriding an already-overridden gate is a no-op");
}

async function scenarioBackcompat() {
  step("Scenario 5: Legacy project (no workflow seed) still works");

  // Disable engine for this branch by creating a project AND skipping seedProject
  const { project } = await createSmokeProject({ skipSeed: true });

  assert(!project.workflowTemplateId, "Legacy project has no workflowTemplateId");
  assert(project.phase === "kickoff", "Legacy project gets default phase=kickoff");

  // No tasks/gates should exist
  const taskCount = await Task.countDocuments({ projectId: project._id });
  const gateCount = await ApprovalGate.countDocuments({ projectId: project._id });
  assert(taskCount === 0, "Legacy project has 0 tasks");
  assert(gateCount === 0, "Legacy project has 0 gates");

  // Manually create a legacy task (no dependsOn, no gateStatus) the way the
  // existing controller does — engine must not crash on it.
  const manualTask = await Task.create({
    projectId: project._id,
    taskType: "ac_coordination",
    title: "Legacy manual task",
    status: "in_progress",
  });
  const access = await workflowEngine.evaluateTaskAccess(manualTask._id);
  assert(access.canStart === true, "Legacy manual task is not blocked by the engine");
  assert(access.openGates.length === 0, "Legacy manual task has no open gates");
  assert(access.unmetDeps.length === 0, "Legacy manual task has no unmet deps");
}

async function cleanup() {
  step("Cleanup");
  const projects = await Project.find({ tags: SMOKE_TAG }).select("_id").lean();
  const projectIds = projects.map((p) => p._id);
  if (projectIds.length === 0) {
    console.log("  (nothing to clean)");
    return;
  }

  const [t, g, d, p] = await Promise.all([
    Task.deleteMany({ projectId: { $in: projectIds } }),
    ApprovalGate.deleteMany({ projectId: { $in: projectIds } }),
    TaskDependency.deleteMany({ projectId: { $in: projectIds } }),
    Project.deleteMany({ _id: { $in: projectIds } }),
  ]);
  console.log(
    `  Deleted: ${p.deletedCount} projects · ${t.deletedCount} tasks · ${g.deletedCount} gates · ${d.deletedCount} deps`
  );
}

async function main() {
  console.log(`Phase 1 smoke test — connecting to ${process.env.MONGO_URI ? "MongoDB" : "<no MONGO_URI>"}`);
  await mongoose.connect(process.env.MONGO_URI);

  try {
    await ensureTemplatesSeeded();
    const project = await scenarioSeed();
    await scenarioEnforcement(project);
    await scenarioCascadeUnlock(project);
    await scenarioOverride(project);
    await scenarioBackcompat();
  } finally {
    try { await cleanup(); } catch (e) { console.error("Cleanup failed:", e.message); }
    await mongoose.disconnect();
  }

  console.log(`\nResult: ${passed} passed, ${failures} failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
