/**
 * Seed workflow / master-sheet templates per project type.
 *
 * Two templates are upserted:
 *   1. "Residential Full"   — projectType: "Residential", isDefault: true
 *   2. "Commercial Full"    — projectType: "Commercial",  isDefault: true
 *
 * When a new project is created, the workflowEngine picks the default template
 * matching the project's projectType and stamps every taskDef into a Task doc.
 * That Task list becomes the initial master-sheet rows.
 *
 * Run after deploying schema changes:
 *   node backend/src/scripts/seedWorkflowTemplates.js
 *
 * Safe to re-run — uses upsert by `name`.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const WorkflowTemplate = require("../modules/pms/models/WorkflowTemplate.model");

// ---------------------------------------------------------------------------
// RESIDENTIAL FULL — JJ Studio's residential interior design flow.
// ---------------------------------------------------------------------------
const RESIDENTIAL_FULL = {
  name: "Residential Full",
  description:
    "JJ Studio Residential Design Sub-Flow — measurement, layout, parallel design tracks, drawing release, handover.",
  projectType: "Residential",
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
    { key: "mep_collection",  title: "Collect MEP drawings from client",  taskType: "mep_collection",  responsibilitySlug: "furniture_measurements", dayOffsetFromProjectStart: 0, priority: "high",   dependsOnKeys: [], requiresGateKeys: [], checklistTemplateName: "mep_collection_v1" },
    { key: "site_measurement", title: "Take site measurements per checklist", taskType: "site_measurement", responsibilitySlug: "furniture_measurements", dayOffsetFromProjectStart: 1, priority: "high",   dependsOnKeys: [], requiresGateKeys: [], checklistTemplateName: "site_measurement_v1" },
    { key: "concept_making",   title: "Concept making — initial direction",  taskType: "concept_making",  responsibilitySlug: "concept_3d",            dayOffsetFromProjectStart: 3, priority: "medium", dependsOnKeys: [], requiresGateKeys: [], checklistTemplateName: "concept_making_v1" },

    // ── LAYOUT (D+1) ────────────────────────────────────────────────────────
    { key: "furniture_layout", title: "Make Furniture Layout", taskType: "furniture_layout", responsibilitySlug: "lead_designer", dayOffsetFromProjectStart: 2, priority: "high", dependsOnKeys: ["site_measurement"], requiresGateKeys: [], checklistTemplateName: "furniture_layout_v1" },

    // ── DESIGN (parallel, post-FL approval) ─────────────────────────────────
    { key: "civil_drawing",            title: "Make Civil Drawing",         taskType: "civil_drawing",            responsibilitySlug: "furniture_measurements", dayOffsetFromProjectStart: 6, priority: "medium", dependsOnKeys: [],                 requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "civil_drawing_v1" },
    { key: "ac_coordination",          title: "AC Coordination",            taskType: "ac_coordination",          responsibilitySlug: "technical_drawings",     dayOffsetFromProjectStart: 6, priority: "medium", dependsOnKeys: [],                 requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "ac_coordination_v1" },
    { key: "automation_coordination",  title: "Automation Coordination (EA)", taskType: "automation_coordination",  responsibilitySlug: "technical_drawings",   dayOffsetFromProjectStart: 6, priority: "medium", dependsOnKeys: [],                 requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "automation_coordination_v1" },
    { key: "technical_drawing",        title: "Technical Drawings",         taskType: "technical_drawing",        responsibilitySlug: "technical_drawings",     dayOffsetFromProjectStart: 6, priority: "medium", dependsOnKeys: [],                 requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "technical_drawing_v1" },
    { key: "kitchen_drawing",          title: "Kitchen + Utility Drawing",  taskType: "kitchen_drawing",          responsibilitySlug: "bathroom_kitchen",       dayOffsetFromProjectStart: 6, priority: "medium", dependsOnKeys: [],                 requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "kitchen_drawing_v1" },
    { key: "bathroom_drawing",         title: "Bathroom Drawing",           taskType: "bathroom_drawing",         responsibilitySlug: "bathroom_kitchen",       dayOffsetFromProjectStart: 6, priority: "medium", dependsOnKeys: [],                 requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "bathroom_drawing_v1" },
    { key: "3d_render",                title: "3D Render",                  taskType: "3d_render",                responsibilitySlug: "technical_drawings",     dayOffsetFromProjectStart: 8, priority: "medium", dependsOnKeys: ["concept_making"], requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "3d_render_v1" },

    // ── HANDOVER ────────────────────────────────────────────────────────────
    { key: "handover_signoff", title: "Design → Execution Handover Signoff", taskType: "handover_signoff", responsibilitySlug: "lead_designer", dayOffsetFromProjectStart: 30, priority: "high", dependsOnKeys: [], requiresGateKeys: [], checklistTemplateName: "handover_signoff_v1" },
  ],

  gates: [
    { key: "gate_furniture_layout", label: "Furniture Layout — Client Approval", gateType: "gate_furniture_layout", approverType: "client", listensTo: "furniture_layout", unblocks: ["civil_drawing","ac_coordination","automation_coordination","technical_drawing","kitchen_drawing","bathroom_drawing","3d_render"], blockedActivities: ["task.submit"] },
    { key: "gate_pd_3d_review",     label: "3D Render — Principal Designer Review", gateType: "gate_pd_3d_review", approverType: "principal_designer", unblocks: [], blockedActivities: ["drawing.send_to_client"] },
    { key: "gate_ac_client",        label: "AC — Client Approval",                gateType: "gate_ac_client",        approverType: "client", listensTo: "ac",                  unblocks: [], blockedActivities: ["po.emit"] },
    { key: "gate_automation_client", label: "Automation — Client Approval",       gateType: "gate_automation_client", approverType: "client", listensTo: "automation",          unblocks: [], blockedActivities: ["po.emit"] },
    { key: "gate_kitchen_material", label: "Kitchen — Material / Outsource Approval", gateType: "gate_kitchen_material", approverType: "client", listensTo: "kitchen",          unblocks: [], blockedActivities: ["po.emit"] },
    { key: "gate_bath_material",    label: "Bathroom — Material Selection Approval", gateType: "gate_bath_material", approverType: "principal_and_client", listensTo: "bathroom_material", unblocks: [], blockedActivities: ["po.emit"] },
    { key: "gate_cp_fittings",      label: "CP Fittings — Client Approval",       gateType: "gate_cp_fittings",      approverType: "client", listensTo: "cp_fittings",          unblocks: [], blockedActivities: ["po.emit"] },
    { key: "gate_wall_floor",       label: "Wall & Floor Material — Client Approval", gateType: "gate_wall_floor",   approverType: "client", listensTo: "wall_floor_material",  unblocks: [], blockedActivities: ["po.emit"] },
    { key: "gate_handover",         label: "Design → Execution Handover",         gateType: "gate_handover",         approverType: "manager", unblocks: [], blockedActivities: ["site_execution.start"] },
  ],
};

// ---------------------------------------------------------------------------
// COMMERCIAL FULL — JJ Studio's commercial fit-out flow.
// Commercial projects are usually larger and have more coordination work
// (HVAC, fire safety, electrical/data, signage) and fewer "personal" zones.
// ---------------------------------------------------------------------------
const COMMERCIAL_FULL = {
  name: "Commercial Full",
  description:
    "JJ Studio Commercial Fit-Out Flow — site survey, space planning, parallel coordination tracks (HVAC, fire, electrical/data), zone 3Ds, handover.",
  projectType: "Commercial",
  isDefault: true,
  isActive: true,

  phases: [
    { name: "kickoff", order: 1, taskKeys: ["mep_collection", "site_measurement", "concept_making"], gateKeys: [] },
    {
      name: "layout",
      order: 2,
      taskKeys: ["space_planning", "furniture_layout"],
      gateKeys: ["gate_space_planning", "gate_furniture_layout"],
    },
    {
      name: "design",
      order: 3,
      taskKeys: [
        "civil_drawing",
        "electrical_data_layout",
        "hvac_coordination",
        "fire_safety_coordination",
        "automation_coordination",
        "technical_drawing",
        "workstation_detail",
        "reception_3d",
        "conference_3d",
        "cafeteria_layout",
        "restroom_drawing",
        "signage_branding",
      ],
      gateKeys: ["gate_pd_3d_review"],
    },
    {
      name: "procurement",
      order: 4,
      taskKeys: [],
      gateKeys: [
        "gate_hvac_client",
        "gate_fire_client",
        "gate_workstation_material",
        "gate_signage_client",
        "gate_wall_floor",
      ],
    },
    { name: "release",   order: 5, taskKeys: [],                  gateKeys: [] },
    { name: "execution", order: 6, taskKeys: [],                  gateKeys: [] },
    { name: "handover",  order: 7, taskKeys: ["handover_signoff"], gateKeys: ["gate_handover"] },
  ],

  tasks: [
    // ── KICKOFF ─────────────────────────────────────────────────────────────
    { key: "mep_collection",   title: "Collect base building MEP / client brief", taskType: "mep_collection",  responsibilitySlug: "furniture_measurements", dayOffsetFromProjectStart: 0, priority: "high",   dependsOnKeys: [], requiresGateKeys: [], checklistTemplateName: "mep_collection_v1" },
    { key: "site_measurement",  title: "Site survey & built-form measurement",    taskType: "site_measurement", responsibilitySlug: "furniture_measurements", dayOffsetFromProjectStart: 1, priority: "high",   dependsOnKeys: [], requiresGateKeys: [], checklistTemplateName: "site_measurement_v1" },
    { key: "concept_making",    title: "Concept & brand direction",               taskType: "concept_making",   responsibilitySlug: "concept_3d",             dayOffsetFromProjectStart: 3, priority: "medium", dependsOnKeys: [], requiresGateKeys: [], checklistTemplateName: "concept_making_v1" },

    // ── LAYOUT — space planning first, then furniture ──────────────────────
    { key: "space_planning",   title: "Space planning — zoning & circulation",  taskType: "furniture_layout", responsibilitySlug: "lead_designer", dayOffsetFromProjectStart: 4, priority: "high", dependsOnKeys: ["site_measurement"], requiresGateKeys: [], checklistTemplateName: "furniture_layout_v1" },
    { key: "furniture_layout", title: "Furniture layout — workstations & meeting rooms", taskType: "furniture_layout", responsibilitySlug: "lead_designer", dayOffsetFromProjectStart: 6, priority: "high", dependsOnKeys: ["space_planning"], requiresGateKeys: ["gate_space_planning"], checklistTemplateName: "furniture_layout_v1" },

    // ── DESIGN (parallel post-FL approval) ─────────────────────────────────
    { key: "civil_drawing",            title: "Civil Drawing",                          taskType: "civil_drawing",            responsibilitySlug: "furniture_measurements", dayOffsetFromProjectStart: 8,  priority: "medium", dependsOnKeys: [], requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "civil_drawing_v1" },
    { key: "electrical_data_layout",   title: "Electrical + Data / Networking Layout",  taskType: "technical_drawing",        responsibilitySlug: "technical_drawings",     dayOffsetFromProjectStart: 8,  priority: "medium", dependsOnKeys: [], requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "technical_drawing_v1" },
    { key: "hvac_coordination",        title: "HVAC Coordination",                      taskType: "ac_coordination",          responsibilitySlug: "technical_drawings",     dayOffsetFromProjectStart: 8,  priority: "high",   dependsOnKeys: [], requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "ac_coordination_v1" },
    { key: "fire_safety_coordination", title: "Fire Safety / Sprinkler Coordination",   taskType: "ac_coordination",          responsibilitySlug: "technical_drawings",     dayOffsetFromProjectStart: 8,  priority: "high",   dependsOnKeys: [], requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "ac_coordination_v1" },
    { key: "automation_coordination",  title: "Building Automation / Access Control",   taskType: "automation_coordination",  responsibilitySlug: "technical_drawings",     dayOffsetFromProjectStart: 8,  priority: "medium", dependsOnKeys: [], requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "automation_coordination_v1" },
    { key: "technical_drawing",        title: "Technical Drawings (false ceiling, partitions)", taskType: "technical_drawing", responsibilitySlug: "technical_drawings",   dayOffsetFromProjectStart: 8,  priority: "medium", dependsOnKeys: [], requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "technical_drawing_v1" },
    { key: "workstation_detail",       title: "Workstation Detail Drawing",             taskType: "technical_drawing",        responsibilitySlug: "technical_drawings",     dayOffsetFromProjectStart: 9,  priority: "medium", dependsOnKeys: [], requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "technical_drawing_v1" },
    { key: "reception_3d",             title: "Reception / Lobby 3D Render",            taskType: "3d_render",                responsibilitySlug: "concept_3d",             dayOffsetFromProjectStart: 10, priority: "medium", dependsOnKeys: ["concept_making"], requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "3d_render_v1" },
    { key: "conference_3d",            title: "Conference / Board Room 3D Render",      taskType: "3d_render",                responsibilitySlug: "concept_3d",             dayOffsetFromProjectStart: 11, priority: "medium", dependsOnKeys: ["concept_making"], requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "3d_render_v1" },
    { key: "cafeteria_layout",         title: "Cafeteria / Pantry Layout & 3D",         taskType: "kitchen_drawing",          responsibilitySlug: "bathroom_kitchen",       dayOffsetFromProjectStart: 10, priority: "medium", dependsOnKeys: [], requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "kitchen_drawing_v1" },
    { key: "restroom_drawing",         title: "Restroom Drawing",                       taskType: "bathroom_drawing",         responsibilitySlug: "bathroom_kitchen",       dayOffsetFromProjectStart: 10, priority: "medium", dependsOnKeys: [], requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "bathroom_drawing_v1" },
    { key: "signage_branding",         title: "Signage & Branding Detail",              taskType: "technical_drawing",        responsibilitySlug: "concept_3d",             dayOffsetFromProjectStart: 12, priority: "low",    dependsOnKeys: ["concept_making"], requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "technical_drawing_v1" },

    // ── HANDOVER ────────────────────────────────────────────────────────────
    { key: "handover_signoff", title: "Design → Execution Handover Signoff", taskType: "handover_signoff", responsibilitySlug: "lead_designer", dayOffsetFromProjectStart: 40, priority: "high", dependsOnKeys: [], requiresGateKeys: [], checklistTemplateName: "handover_signoff_v1" },
  ],

  gates: [
    { key: "gate_space_planning",       label: "Space Planning — Client Approval",     gateType: "gate_furniture_layout",  approverType: "client",            listensTo: "space_planning",     unblocks: ["furniture_layout"], blockedActivities: ["task.submit"] },
    { key: "gate_furniture_layout",     label: "Furniture Layout — Client Approval",   gateType: "gate_furniture_layout",  approverType: "client",            listensTo: "furniture_layout",   unblocks: ["civil_drawing","electrical_data_layout","hvac_coordination","fire_safety_coordination","automation_coordination","technical_drawing","workstation_detail","reception_3d","conference_3d","cafeteria_layout","restroom_drawing","signage_branding"], blockedActivities: ["task.submit"] },
    { key: "gate_pd_3d_review",         label: "3D Renders — Principal Designer Review", gateType: "gate_pd_3d_review",    approverType: "principal_designer", unblocks: [], blockedActivities: ["drawing.send_to_client"] },
    { key: "gate_hvac_client",          label: "HVAC — Client Approval",               gateType: "gate_ac_client",         approverType: "client",            listensTo: "hvac",                unblocks: [], blockedActivities: ["po.emit"] },
    { key: "gate_fire_client",          label: "Fire Safety — Consultant Approval",    gateType: "gate_ac_client",         approverType: "principal_and_client", listensTo: "fire_safety",       unblocks: [], blockedActivities: ["po.emit"] },
    { key: "gate_workstation_material", label: "Workstation Material Approval",        gateType: "gate_kitchen_material",  approverType: "client",            listensTo: "workstation_material", unblocks: [], blockedActivities: ["po.emit"] },
    { key: "gate_signage_client",       label: "Signage / Branding — Client Approval", gateType: "gate_cp_fittings",       approverType: "client",            listensTo: "signage",             unblocks: [], blockedActivities: ["po.emit"] },
    { key: "gate_wall_floor",           label: "Wall & Floor Material — Client Approval", gateType: "gate_wall_floor",     approverType: "client",            listensTo: "wall_floor_material", unblocks: [], blockedActivities: ["po.emit"] },
    { key: "gate_handover",             label: "Design → Execution Handover",          gateType: "gate_handover",          approverType: "manager",           unblocks: [], blockedActivities: ["site_execution.start"] },
  ],
};

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    for (const tpl of [RESIDENTIAL_FULL, COMMERCIAL_FULL]) {
      const result = await WorkflowTemplate.findOneAndUpdate(
        { name: tpl.name },
        { $set: tpl },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(
        `✓ "${tpl.name}" (${tpl.projectType}) upserted — ` +
        `${result.tasks.length} tasks, ${result.gates.length} gates, ${result.phases.length} phases.`
      );
    }
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

module.exports = { RESIDENTIAL_FULL, COMMERCIAL_FULL };
