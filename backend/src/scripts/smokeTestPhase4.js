/**
 * Phase 4 — Per-drawing PD review enforcement + Analytics aggregations.
 *
 * Validates:
 *   1. Approve on 3D drawing blocked without PD review
 *   2. Approve on 3D drawing succeeds after PD review approved
 *   3. Release on 3D drawing blocked without PD review (separate check)
 *   4. Non-3D drawings bypass the PD check
 *   5. Analytics: gateAging returns aged open gates with buckets
 *   6. Analytics: drawingReleaseSLA returns avg/median hours per type
 *   7. Analytics: designerUtilisation returns per-user stats
 *   8. Analytics: vendorPerformance returns per-vendor breakdown
 *   9. Analytics: projectProfitability returns variance per project
 *
 * Usage:  node backend/src/scripts/smokeTestPhase4.js
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
const Vendor = require("../modules/pms/models/Vendor.model");
const VendorEngagement = require("../modules/pms/models/VendorEngagement.model");
const PurchaseOrder = require("../modules/pms/models/PurchaseOrder.model");
const WorkflowTemplate = require("../modules/pms/models/WorkflowTemplate.model");
const ChecklistTemplate = require("../modules/pms/models/ChecklistTemplate.model");

const workflowEngine = require("../modules/pms/services/workflowEngine");
const drawingCtrl = require("../modules/pms/controllers/Drawing.controller");
const analyticsCtrl = require("../modules/pms/controllers/Analytics.controller");

const { TEMPLATES: CHECKLIST_TEMPLATES } = require("./seedChecklistTemplates");
const { RESIDENTIAL_FULL } = require("./seedWorkflowTemplates");

const SMOKE_TAG = "WORKFLOW_SMOKE_TEST";
let failures = 0, passed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  PASS  ${msg}`); passed++; }
  else      { console.error(`  FAIL  ${msg}`); failures++; }
}
function step(label) { console.log(`\n— ${label}`); }

function mockRes() {
  return {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(p) { this.body = p; return this; },
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
    name: `${SMOKE_TAG} P4 ${Date.now()}`,
    projectType: "Residential",
    siteAddress: { fullAddress: "Phase 4 smoke" },
    tags: [SMOKE_TAG],
    trackingId: `SMK4-${Math.floor(Math.random() * 1e6)}`,
    startDate: new Date(),
    budget: 1000000,
  });
  await workflowEngine.seedProject(project._id);
  return Project.findById(project._id);
}

async function scenarioPDPerDrawing() {
  step("Scenario 1-4: Per-drawing PD review enforcement");
  const project = await createSeededProject();

  const threeD = await Drawing.create({
    projectId: project._id,
    title: "Smoke 3D Render",
    drawingType: "3d_render",
    fileUrl: "https://example.com/3d.pdf",
    version: 1,
    status: "sent_for_approval",
  });
  const civil = await Drawing.create({
    projectId: project._id,
    title: "Smoke Civil Drawing",
    drawingType: "civil",
    fileUrl: "https://example.com/civil.pdf",
    version: 1,
    status: "sent_for_approval",
  });

  // 1. Approve on 3D blocked without PD review
  let req = mockReq({ params: { id: threeD._id.toString() }, body: {} });
  let res = mockRes();
  await drawingCtrl.approveDrawing(req, res);
  assert(
    res.statusCode === 409 && res.body.code === "PD_REVIEW_REQUIRED",
    `Approve on 3D blocked without PD review (got ${res.statusCode} ${res.body?.code})`
  );

  // 4. Non-3D bypasses the check
  req = mockReq({ params: { id: civil._id.toString() }, body: {} });
  res = mockRes();
  await drawingCtrl.approveDrawing(req, res);
  assert(res.statusCode === 200, `Non-3D drawing approve succeeds (got ${res.statusCode})`);

  // Record an approved PD review for the 3D drawing
  const gate = await ApprovalGate.findOne({ projectId: project._id, gateType: "gate_pd_3d_review" });
  await Approval.create({
    projectId: project._id,
    targetType: "drawing",
    targetId: threeD._id,
    approverType: "principal_designer",
    status: "approved",
    gateId: gate?._id,
    respondedAt: new Date(),
  });

  // 2. Now approve succeeds
  // Reset status since previous attempt left it untouched
  await Drawing.updateOne({ _id: threeD._id }, { $set: { status: "sent_for_approval" } });
  req = mockReq({ params: { id: threeD._id.toString() }, body: {} });
  res = mockRes();
  await drawingCtrl.approveDrawing(req, res);
  assert(res.statusCode === 200, `3D approve succeeds after PD review (got ${res.statusCode})`);

  // 3. Release path: create another 3D without PD review, try to release
  const threeD2 = await Drawing.create({
    projectId: project._id,
    title: "Smoke 3D Render 2",
    drawingType: "3d_render",
    fileUrl: "https://example.com/3d2.pdf",
    version: 1,
    status: "approved",
  });
  req = mockReq({ params: { id: threeD2._id.toString() }, body: {} });
  res = mockRes();
  await drawingCtrl.releaseDrawing(req, res);
  assert(
    res.statusCode === 409 && res.body.code === "PD_REVIEW_REQUIRED",
    `Release on 3D blocked without PD review (got ${res.statusCode} ${res.body?.code})`
  );
}

async function scenarioAnalytics() {
  step("Scenario 5-9: Analytics endpoints");
  // Use the project that exists from previous scenarios + create some PO data
  const project = await createSeededProject();

  // Force-create some past data for analytics
  await Drawing.create({
    projectId: project._id,
    title: "Old released",
    drawingType: "civil",
    fileUrl: "https://example.com/x.pdf",
    version: 1,
    status: "released_to_site",
    isReleased: true,
    approvalDate: new Date(Date.now() - 5 * 86400000),  // 5 days ago
    releasedAt: new Date(Date.now() - 3 * 86400000),    // 3 days ago → SLA = 2 days
  });

  const vendor = await Vendor.create({
    name: "Smoke Analytics Vendor",
    category: "AC",
    phone: "+919999900099",
    rating: 4,
  });
  const eng = await VendorEngagement.create({
    projectId: project._id,
    vendorId: vendor._id,
    vendorKind: "ac",
    status: "site_received",
    history: [
      { fromStatus: null, toStatus: "requested", at: new Date(Date.now() - 10 * 86400000) },
      { fromStatus: "requested", toStatus: "quoted", at: new Date(Date.now() - 8 * 86400000) },
      { fromStatus: "quoted", toStatus: "client_approved", at: new Date(Date.now() - 6 * 86400000) },
      { fromStatus: "client_approved", toStatus: "po_emitted", at: new Date(Date.now() - 5 * 86400000) },
      { fromStatus: "po_emitted", toStatus: "delivered", at: new Date(Date.now() - 2 * 86400000) },
      { fromStatus: "delivered", toStatus: "site_received", at: new Date() },
    ],
    amount: 75000,
  });

  // PO so profitability has data
  await PurchaseOrder.create({
    projectId: project._id,
    vendorId: vendor._id,
    items: [{ itemName: "AC Unit", quantity: 1, unit: "unit", rate: 75000, amount: 75000 }],
    totalAmount: 75000,
    status: "delivered",
  });

  // Assign a task so designer utilisation has data
  const userId = new mongoose.Types.ObjectId();
  // patch a task to be assigned + approved
  const t = await Task.findOne({ projectId: project._id, taskType: "site_measurement" });
  t.assignedTo = userId;
  t.status = "approved";
  t.approvedAt = new Date();
  await t.save();

  // 5. Gate aging
  let res = mockRes();
  await analyticsCtrl.gateAging(mockReq(), res);
  assert(res.statusCode === 200, "gateAging returns 200");
  assert(typeof res.body.total === "number", "gateAging has total");
  assert(res.body.buckets && "0-3" in res.body.buckets, "gateAging has buckets");
  assert(Array.isArray(res.body.gates), "gateAging gates list");

  // 6. Drawing release SLA
  res = mockRes();
  await analyticsCtrl.drawingReleaseSLA(mockReq(), res);
  assert(res.statusCode === 200, "drawingReleaseSLA returns 200");
  assert(res.body.total > 0, `drawingReleaseSLA total > 0 (got ${res.body.total})`);
  assert(res.body.avgHours >= 0, "drawingReleaseSLA avgHours present");

  // 7. Designer utilisation
  res = mockRes();
  await analyticsCtrl.designerUtilisation(mockReq(), res);
  assert(res.statusCode === 200, "designerUtilisation returns 200");
  assert(Array.isArray(res.body.designers), "designerUtilisation designers array");
  const myRow = res.body.designers.find((d) => String(d.userId) === String(userId));
  assert(myRow?.completed >= 1, "Smoke user shows at least 1 completed task");

  // 8. Vendor performance
  res = mockRes();
  await analyticsCtrl.vendorPerformance(mockReq(), res);
  assert(res.statusCode === 200, "vendorPerformance returns 200");
  const myVendor = res.body.vendors.find((v) => String(v.vendorId) === String(vendor._id));
  assert(myVendor?.siteReceived >= 1, "Smoke vendor shows 1 site_received");
  assert(myVendor?.successRate === 100, `Smoke vendor successRate = 100 (got ${myVendor?.successRate})`);

  // 9. Project profitability
  res = mockRes();
  await analyticsCtrl.projectProfitability(mockReq(), res);
  assert(res.statusCode === 200, "projectProfitability returns 200");
  const myProj = res.body.projects.find((p) => String(p.projectId) === String(project._id));
  assert(myProj?.spend === 75000, `Smoke project spend = 75000 (got ${myProj?.spend})`);
  assert(myProj?.budget === 1000000, `Smoke project budget = 1000000 (got ${myProj?.budget})`);
  assert(myProj?.variance === 925000, `Smoke project variance = 925000 (got ${myProj?.variance})`);
}

async function cleanup() {
  step("Cleanup");
  const projects = await Project.find({ tags: SMOKE_TAG }).select("_id").lean();
  const projectIds = projects.map((p) => p._id);
  const vendors = await Vendor.find({ name: /Smoke / }).select("_id").lean();
  const vendorIds = vendors.map((v) => v._id);
  if (!projectIds.length && !vendorIds.length) { console.log("  (nothing to clean)"); return; }

  const [t, g, d, a, e, w, po, dr, p, v] = await Promise.all([
    Task.deleteMany({ projectId: { $in: projectIds } }),
    ApprovalGate.deleteMany({ projectId: { $in: projectIds } }),
    TaskDependency.deleteMany({ projectId: { $in: projectIds } }),
    Approval.deleteMany({ projectId: { $in: projectIds } }),
    VendorEngagement.deleteMany({ projectId: { $in: projectIds } }),
    require("../modules/pms/models/WhatsAppProjectGroup.model").deleteMany({ projectId: { $in: projectIds } }),
    PurchaseOrder.deleteMany({ projectId: { $in: projectIds } }),
    Drawing.deleteMany({ projectId: { $in: projectIds } }),
    Project.deleteMany({ _id: { $in: projectIds } }),
    Vendor.deleteMany({ _id: { $in: vendorIds } }),
  ]);
  console.log(
    `  Deleted: ${p.deletedCount} projects · ${t.deletedCount} tasks · ${g.deletedCount} gates · ` +
    `${d.deletedCount} deps · ${a.deletedCount} approvals · ${e.deletedCount} engagements · ` +
    `${po.deletedCount} POs · ${dr.deletedCount} drawings · ${v.deletedCount} vendors`
  );
}

async function main() {
  console.log("Phase 4 smoke test — connecting to MongoDB");
  await mongoose.connect(process.env.MONGO_URI);
  // Ensure engine flag is treated as on for the in-process controller calls
  process.env.WORKFLOW_ENGINE_V1 = "true";
  try {
    await ensureTemplates();
    await scenarioPDPerDrawing();
    await scenarioAnalytics();
  } finally {
    try { await cleanup(); } catch (e) { console.error("Cleanup failed:", e.message); }
    await mongoose.disconnect();
  }
  console.log(`\nResult: ${passed} passed, ${failures} failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Phase 4 smoke crashed:", err);
  process.exit(1);
});
