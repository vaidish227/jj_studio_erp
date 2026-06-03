/**
 * Phase 3b — Handover + kitchen-child checklists + reminders + template admin.
 *
 * Validates:
 *   1. Handover request creates a package with all approved/released drawings
 *   2. Idempotent re-request returns the existing package
 *   3. Design lead sign blocked while drawings unwalked
 *   4. Sign blocked while blocker punch items unresolved
 *   5. Supervisor accept closes gate_handover + sets phase=execution
 *   6. Kitchen child tasks now have populated checklists from seeded templates
 *   7. cron.runDailyReminders runs without throwing (smoke)
 *   8. ChecklistTemplate snapshotForTaskType returns items for kitchen children
 *
 * Usage:  node backend/src/scripts/smokeTestPhase3b.js
 * Exits 0 on success, 1 on any failure. Self-cleaning.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");

const Project = require("../modules/pms/models/Project.model");
const Task = require("../modules/pms/models/Task.model");
const TaskDependency = require("../modules/pms/models/TaskDependency.model");
const ApprovalGate = require("../modules/pms/models/ApprovalGate.model");
const Approval = require("../modules/pms/models/Approval.model");
const Drawing = require("../modules/pms/models/Drawing.model");
const HandoverPackage = require("../modules/pms/models/HandoverPackage.model");
const WorkflowTemplate = require("../modules/pms/models/WorkflowTemplate.model");
const ChecklistTemplate = require("../modules/pms/models/ChecklistTemplate.model");

const workflowEngine = require("../modules/pms/services/workflowEngine");
const { runDailyReminders } = require("../modules/pms/cron/pmsReminders");
const handoverCtrl = require("../modules/pms/controllers/Handover.controller");

const { TEMPLATES: CHECKLIST_TEMPLATES } = require("./seedChecklistTemplates");
const { RESIDENTIAL_FULL } = require("./seedWorkflowTemplates");

const SMOKE_TAG = "WORKFLOW_SMOKE_TEST";
let failures = 0, passed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  PASS  ${msg}`); passed++; }
  else      { console.error(`  FAIL  ${msg}`); failures++; }
}
function step(label) { console.log(`\n— ${label}`); }

// Mock req/res for controller-level calls
function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}
function mockReq(overrides = {}) {
  return {
    user: { _id: new mongoose.Types.ObjectId(), permissions: ["*"], name: "Smoke Bot" },
    body: {}, params: {}, query: {},
    ...overrides,
  };
}

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
    name: `${SMOKE_TAG} P3b ${Date.now()}`,
    projectType: "Residential",
    siteAddress: { fullAddress: "Phase 3b smoke" },
    tags: [SMOKE_TAG],
    trackingId: `SMK3B-${Math.floor(Math.random() * 1e6)}`,
    startDate: new Date(),
  });
  await workflowEngine.seedProject(project._id);
  return Project.findById(project._id);
}

async function scenarioHandover() {
  step("Scenario 1–5: Handover lifecycle");
  const project = await createSeededProject();

  // Need at least one approved/released drawing for handover.request to succeed
  const d1 = await Drawing.create({
    projectId: project._id,
    title: "Smoke Drawing A",
    drawingType: "civil",
    fileUrl: "https://example.com/a.pdf",
    version: 1,
    status: "approved",
  });
  const d2 = await Drawing.create({
    projectId: project._id,
    title: "Smoke Drawing B",
    drawingType: "kitchen",
    fileUrl: "https://example.com/b.pdf",
    version: 1,
    status: "released_to_site",
    isReleased: true,
  });

  // 1. Request
  let req = mockReq({ params: { projectId: project._id.toString() }, body: {} });
  let res = mockRes();
  await handoverCtrl.requestHandover(req, res);
  assert(res.statusCode === 201, `requestHandover returned 201 (got ${res.statusCode})`);
  const handover = res.body.handover;
  assert(handover.drawings.length === 2, `Handover snapshot has 2 drawings (got ${handover.drawings.length})`);
  assert(handover.status === "requested", "Handover starts in 'requested'");

  // 2. Idempotent re-request
  res = mockRes();
  await handoverCtrl.requestHandover(req, res);
  assert(res.statusCode === 200 && res.body.skipped === "exists", "Re-request returns existing package (idempotent)");

  // 3. Sign blocked while drawings unwalked
  req = mockReq({ params: { id: handover._id.toString() }, body: {} });
  res = mockRes();
  await handoverCtrl.designLeadSign(req, res);
  assert(res.statusCode === 409 && res.body.code === "WALKTHROUGH_INCOMPLETE", "Sign blocked while drawings unwalked");

  // Walk all drawings
  for (const item of handover.drawings) {
    req = mockReq({
      params: { id: handover._id.toString(), itemId: item._id.toString() },
      body: { walked: true },
    });
    res = mockRes();
    await handoverCtrl.updateDrawingItem(req, res);
  }

  // Add a blocker punch item
  req = mockReq({
    params: { id: handover._id.toString() },
    body: { description: "Test blocker", severity: "blocker" },
  });
  res = mockRes();
  await handoverCtrl.addPunchItem(req, res);
  assert(res.statusCode === 201, "Punch item added");

  // 4. Sign blocked while blockers unresolved
  req = mockReq({ params: { id: handover._id.toString() }, body: {} });
  res = mockRes();
  await handoverCtrl.designLeadSign(req, res);
  assert(res.statusCode === 409 && res.body.code === "BLOCKERS_OPEN", "Sign blocked while blocker punch open");

  // Resolve the blocker
  const reloaded = await HandoverPackage.findById(handover._id);
  const punchId = reloaded.punchList[0]._id.toString();
  req = mockReq({
    params: { id: handover._id.toString(), punchId },
    body: { resolution: "Fixed in smoke test" },
  });
  res = mockRes();
  await handoverCtrl.resolvePunchItem(req, res);
  assert(res.statusCode === 200, "Punch item resolved");

  // Sign now succeeds
  req = mockReq({ params: { id: handover._id.toString() }, body: { notes: "Ready" } });
  res = mockRes();
  await handoverCtrl.designLeadSign(req, res);
  assert(res.statusCode === 200, `Sign succeeds after walkthrough complete + blockers resolved (got ${res.statusCode})`);

  // 5. Supervisor accept → gate closes + phase=execution
  req = mockReq({ params: { id: handover._id.toString() }, body: { notes: "Accepted" } });
  res = mockRes();
  await handoverCtrl.supervisorAccept(req, res);
  assert(res.statusCode === 200, `supervisorAccept returned 200 (got ${res.statusCode})`);

  const gate = await ApprovalGate.findOne({ projectId: project._id, gateType: "gate_handover" });
  assert(gate.status === "closed", `gate_handover closed (got "${gate.status}")`);

  const updatedProject = await Project.findById(project._id);
  assert(updatedProject.phase === "execution", `Project.phase = "execution" (got "${updatedProject.phase}")`);
  assert(updatedProject.status === "execution_phase", `Project.status = "execution_phase" (got "${updatedProject.status}")`);
}

async function scenarioKitchenChildrenChecklists() {
  step("Scenario 6: Kitchen children spawn with populated checklists");
  const project = await createSeededProject();
  const kitchen = await Task.findOne({ projectId: project._id, taskType: "kitchen_drawing" });
  await workflowEngine.spawnKitchenChildren(kitchen._id, "in_house");

  const children = await Task.find({
    projectId: project._id,
    dependsOn: kitchen._id,
  }).select("taskType checklist").lean();

  assert(children.length === 4, `4 kitchen children spawned (got ${children.length})`);

  const detailElev = children.find((c) => c.taskType === "kitchen_detail_elevation");
  assert(detailElev?.checklist?.length > 0, `kitchen_detail_elevation has a populated checklist (got ${detailElev?.checklist?.length || 0} items)`);

  const tech = children.find((c) => c.taskType === "kitchen_technical_drawings");
  assert(tech?.checklist?.length >= 6, `kitchen_technical_drawings has 6+ items (got ${tech?.checklist?.length})`);
}

async function scenarioReminders() {
  step("Scenario 7: Daily reminders cron runs without error");
  const result = await runDailyReminders();
  assert(typeof result.overdue.usersNotified === "number", "runDailyReminders returns overdue summary");
  assert(typeof result.idle.gatesNudged === "number", "runDailyReminders returns idle summary");
}

async function scenarioSnapshotHelper() {
  step("Scenario 8: ChecklistTemplate.snapshotForTaskType picks up new templates");
  const items = await ChecklistTemplate.snapshotForTaskType("kitchen_release_ready");
  assert(items.length >= 5, `snapshotForTaskType returns items for kitchen_release_ready (got ${items.length})`);
  assert(items.every((i) => i.item && i.isCompleted === false), "All items shaped { item, isCompleted: false }");
}

async function cleanup() {
  step("Cleanup");
  const projects = await Project.find({ tags: SMOKE_TAG }).select("_id").lean();
  const projectIds = projects.map((p) => p._id);
  if (!projectIds.length) { console.log("  (nothing to clean)"); return; }

  const [t, g, d, a, dr, h, p] = await Promise.all([
    Task.deleteMany({ projectId: { $in: projectIds } }),
    ApprovalGate.deleteMany({ projectId: { $in: projectIds } }),
    TaskDependency.deleteMany({ projectId: { $in: projectIds } }),
    Approval.deleteMany({ projectId: { $in: projectIds } }),
    Drawing.deleteMany({ projectId: { $in: projectIds } }),
    HandoverPackage.deleteMany({ projectId: { $in: projectIds } }),
    Project.deleteMany({ _id: { $in: projectIds } }),
  ]);
  console.log(`  Deleted: ${p.deletedCount} projects · ${t.deletedCount} tasks · ${g.deletedCount} gates · ${d.deletedCount} deps · ${a.deletedCount} approvals · ${dr.deletedCount} drawings · ${h.deletedCount} handovers`);
}

async function main() {
  console.log("Phase 3b smoke test — connecting to MongoDB");
  await mongoose.connect(process.env.MONGO_URI);
  try {
    await ensureTemplates();
    await scenarioHandover();
    await scenarioKitchenChildrenChecklists();
    await scenarioReminders();
    await scenarioSnapshotHelper();
  } finally {
    try { await cleanup(); } catch (e) { console.error("Cleanup failed:", e.message); }
    await mongoose.disconnect();
  }
  console.log(`\nResult: ${passed} passed, ${failures} failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Phase 3b smoke crashed:", err);
  process.exit(1);
});
