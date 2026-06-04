/**
 * Seed Phase 1 WorkflowTemplate documents.
 *
 * Default template: "Residential Full" — implements the PDF "Design Sub-Flow":
 *   D0: mep_collection (B), site_measurement (B), concept_making (E)
 *   D+1: furniture_layout (A) depends on site_measurement
 *   D+5+ parallel design tracks (civil/B, ac/C, automation/C, technical/C, kitchen/D, bathroom/D, 3d/C)
 *   Gates: gate_furniture_layout, gate_ac_client, gate_automation_client,
 *          gate_kitchen_material, gate_bath_material, gate_cp_fittings,
 *          gate_wall_floor, gate_pd_3d_review, gate_handover
 *
 * Run after deploying Phase 1 schema:
 *   node backend/src/scripts/seedWorkflowTemplates.js
 *
 * Safe to re-run — uses upsert by `name`.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const WorkflowTemplate = require("../modules/pms/models/WorkflowTemplate.model");

const RESIDENTIAL_FULL = {
  name: "Residential Full",
  description:
    "JJ Studio Residential Design Sub-Flow — measurement, layout, parallel design tracks, drawing release, handover.",
  projectType: "Any",
  isDefault: true,
  isActive: true,

  // 7-phase canonical model: Kickoff → Layout → Design → Procurement → Release → Execution → Handover
  phases: [
    { name: "kickoff",     order: 1, taskKeys: ["mep_collection", "site_measurement", "concept_making"], gateKeys: [] },
    { name: "layout",      order: 2, taskKeys: ["furniture_layout"], gateKeys: ["gate_furniture_layout"] },
    {
      name: "design",
      order: 3,
      taskKeys: [
        "civil_drawing",
        "ac_coordination",
        "automation_coordination",
        "technical_drawing",
        "kitchen_drawing",
        "bathroom_drawing",
        "3d_render",
      ],
      gateKeys: ["gate_pd_3d_review"],
    },
    {
      // Procurement is when client material/vendor approvals are sought and POs emitted.
      name: "procurement",
      order: 4,
      taskKeys: [],
      gateKeys: [
        "gate_ac_client",
        "gate_automation_client",
        "gate_kitchen_material",
        "gate_bath_material",
        "gate_cp_fittings",
        "gate_wall_floor",
      ],
    },
    { name: "release",     order: 5, taskKeys: [],                  gateKeys: [] },
    { name: "execution",   order: 6, taskKeys: [],                  gateKeys: [] },
    { name: "handover",    order: 7, taskKeys: ["handover_signoff"], gateKeys: ["gate_handover"] },
  ],

  tasks: [
    // ── KICKOFF (D0) ────────────────────────────────────────────────────────
    {
      key: "mep_collection",
      title: "Collect MEP drawings from client",
      taskType: "mep_collection",
      responsibilitySlug: "furniture_measurements",
      dayOffsetFromProjectStart: 0,
      priority: "high",
      dependsOnKeys: [],
      requiresGateKeys: [],
      checklistTemplateName: "mep_collection_v1",
    },
    {
      key: "site_measurement",
      title: "Take site measurements per checklist",
      taskType: "site_measurement",
      responsibilitySlug: "furniture_measurements",
      dayOffsetFromProjectStart: 1,
      priority: "high",
      dependsOnKeys: [],
      requiresGateKeys: [],
      checklistTemplateName: "site_measurement_v1",
    },
    {
      key: "concept_making",
      title: "Concept making — initial direction",
      taskType: "concept_making",
      responsibilitySlug: "concept_3d",
      dayOffsetFromProjectStart: 3,
      priority: "medium",
      dependsOnKeys: [],
      requiresGateKeys: [],
      checklistTemplateName: "concept_making_v1",
    },

    // ── LAYOUT (D+1) ────────────────────────────────────────────────────────
    {
      key: "furniture_layout",
      title: "Make Furniture Layout",
      taskType: "furniture_layout",
      responsibilitySlug: "lead_designer",
      dayOffsetFromProjectStart: 2,
      priority: "high",
      dependsOnKeys: ["site_measurement"],
      requiresGateKeys: [],
      checklistTemplateName: "furniture_layout_v1",
    },

    // ── DESIGN (parallel, post-FL approval) ─────────────────────────────────
    {
      key: "civil_drawing",
      title: "Make Civil Drawing",
      taskType: "civil_drawing",
      responsibilitySlug: "furniture_measurements",
      dayOffsetFromProjectStart: 6,
      priority: "medium",
      dependsOnKeys: [],
      requiresGateKeys: ["gate_furniture_layout"],
      checklistTemplateName: "civil_drawing_v1",
    },
    {
      key: "ac_coordination",
      title: "AC Coordination",
      taskType: "ac_coordination",
      responsibilitySlug: "technical_drawings",
      dayOffsetFromProjectStart: 6,
      priority: "medium",
      dependsOnKeys: [],
      requiresGateKeys: ["gate_furniture_layout"],
      checklistTemplateName: "ac_coordination_v1",
    },
    {
      key: "automation_coordination",
      title: "Automation Coordination (EA)",
      taskType: "automation_coordination",
      responsibilitySlug: "technical_drawings",
      dayOffsetFromProjectStart: 6,
      priority: "medium",
      dependsOnKeys: [],
      requiresGateKeys: ["gate_furniture_layout"],
      checklistTemplateName: "automation_coordination_v1",
    },
    {
      key: "technical_drawing",
      title: "Technical Drawings",
      taskType: "technical_drawing",
      responsibilitySlug: "technical_drawings",
      dayOffsetFromProjectStart: 6,
      priority: "medium",
      dependsOnKeys: [],
      requiresGateKeys: ["gate_furniture_layout"],
      checklistTemplateName: "technical_drawing_v1",
    },
    {
      key: "kitchen_drawing",
      title: "Kitchen + Utility Drawing",
      taskType: "kitchen_drawing",
      responsibilitySlug: "bathroom_kitchen",
      dayOffsetFromProjectStart: 6,
      priority: "medium",
      dependsOnKeys: [],
      requiresGateKeys: ["gate_furniture_layout"],
      checklistTemplateName: "kitchen_drawing_v1",
    },
    {
      key: "bathroom_drawing",
      title: "Bathroom Drawing",
      taskType: "bathroom_drawing",
      responsibilitySlug: "bathroom_kitchen",
      dayOffsetFromProjectStart: 6,
      priority: "medium",
      dependsOnKeys: [],
      requiresGateKeys: ["gate_furniture_layout"],
      checklistTemplateName: "bathroom_drawing_v1",
    },
    {
      key: "3d_render",
      title: "3D Render",
      taskType: "3d_render",
      responsibilitySlug: "technical_drawings",
      dayOffsetFromProjectStart: 8,
      priority: "medium",
      dependsOnKeys: ["concept_making"],
      requiresGateKeys: ["gate_furniture_layout"],
      checklistTemplateName: "3d_render_v1",
    },

    // ── HANDOVER ────────────────────────────────────────────────────────────
    {
      key: "handover_signoff",
      title: "Design → Execution Handover Signoff",
      taskType: "handover_signoff",
      responsibilitySlug: "lead_designer",
      dayOffsetFromProjectStart: 30,
      priority: "high",
      dependsOnKeys: [],
      requiresGateKeys: [],
      checklistTemplateName: "handover_signoff_v1",
    },
  ],

  gates: [
    {
      key: "gate_furniture_layout",
      label: "Furniture Layout — Client Approval",
      gateType: "gate_furniture_layout",
      approverType: "client",
      listensTo: "furniture_layout",
      unblocks: [
        "civil_drawing",
        "ac_coordination",
        "automation_coordination",
        "technical_drawing",
        "kitchen_drawing",
        "bathroom_drawing",
        "3d_render",
      ],
      blockedActivities: ["task.submit"],
    },
    {
      key: "gate_pd_3d_review",
      label: "3D Render — Principal Designer Review",
      gateType: "gate_pd_3d_review",
      approverType: "principal_designer",
      unblocks: [],
      blockedActivities: ["drawing.send_to_client"],
    },
    {
      key: "gate_ac_client",
      label: "AC — Client Approval",
      gateType: "gate_ac_client",
      approverType: "client",
      listensTo: "ac",
      unblocks: [],
      blockedActivities: ["po.emit"],
    },
    {
      key: "gate_automation_client",
      label: "Automation — Client Approval",
      gateType: "gate_automation_client",
      approverType: "client",
      listensTo: "automation",
      unblocks: [],
      blockedActivities: ["po.emit"],
    },
    {
      key: "gate_kitchen_material",
      label: "Kitchen — Material / Outsource Approval",
      gateType: "gate_kitchen_material",
      approverType: "client",
      listensTo: "kitchen",
      unblocks: [],
      blockedActivities: ["po.emit"],
    },
    {
      key: "gate_bath_material",
      label: "Bathroom — Material Selection Approval",
      gateType: "gate_bath_material",
      approverType: "principal_and_client",
      listensTo: "bathroom_material",
      unblocks: [],
      blockedActivities: ["po.emit"],
    },
    {
      key: "gate_cp_fittings",
      label: "CP Fittings — Client Approval",
      gateType: "gate_cp_fittings",
      approverType: "client",
      listensTo: "cp_fittings",
      unblocks: [],
      blockedActivities: ["po.emit"],
    },
    {
      key: "gate_wall_floor",
      label: "Wall & Floor Material — Client Approval",
      gateType: "gate_wall_floor",
      approverType: "client",
      listensTo: "wall_floor_material",
      unblocks: [],
      blockedActivities: ["po.emit"],
    },
    {
      key: "gate_handover",
      label: "Design → Execution Handover",
      gateType: "gate_handover",
      approverType: "manager",
      unblocks: [],
      blockedActivities: ["site_execution.start"],
    },
  ],
};

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const result = await WorkflowTemplate.findOneAndUpdate(
      { name: RESIDENTIAL_FULL.name },
      { $set: RESIDENTIAL_FULL },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(
      `Workflow template "${RESIDENTIAL_FULL.name}" upserted. ` +
        `${result.tasks.length} tasks, ${result.gates.length} gates, ${result.phases.length} phases.`
    );
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

if (require.main === module) {
  seed();
}

module.exports = { RESIDENTIAL_FULL };
