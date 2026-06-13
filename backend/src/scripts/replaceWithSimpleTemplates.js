/**
 * One-shot migration: replace the "Full" master templates with "Simple" ones.
 *
 *   - Deletes  "Residential Full" and "Commercial Full"
 *   - Inserts  "Residential Simple" (Residential, default) and
 *              "Commercial Simple"  (Commercial,  default)
 *
 * Phases use engine-known slugs (kickoff / design / procurement / handover) so
 * auto-advance continues to work. Sign-offs use the canonical gateType ids
 * recognised by gateEnforcement.js.
 *
 * Run once:
 *   node backend/src/scripts/replaceWithSimpleTemplates.js
 *
 * Existing projects are NOT affected — they keep their original snapshot.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const WorkflowTemplate = require("../modules/pms/models/WorkflowTemplate.model");

// ─── RESIDENTIAL SIMPLE ──────────────────────────────────────────────────────
const RESIDENTIAL_SIMPLE = {
  name: "Residential Simple",
  description:
    "Simplified residential design flow — Initiate, Design, Material Finalization, Handover.",
  projectType: "Residential",
  isDefault: true,
  isActive: true,

  phases: [
    { name: "kickoff",     order: 1, taskKeys: ["mep_collection", "site_measurement"],                                      gateKeys: [] },
    { name: "design",      order: 2, taskKeys: ["concept_making", "furniture_layout", "civil_drawing", "3d_render"],         gateKeys: ["gate_furniture_layout"] },
    { name: "procurement", order: 3, taskKeys: [],                                                                          gateKeys: ["gate_material"] },
    { name: "handover",    order: 4, taskKeys: ["handover_signoff"],                                                        gateKeys: ["gate_handover"] },
  ],

  tasks: [
    // ── Kickoff
    { key: "mep_collection",   title: "MEP Collection",       taskType: "mep_collection",   responsibilitySlug: "furniture_measurements", dayOffsetFromProjectStart: 0, plannedDays: 1, plannedHours: 4,  priority: "high",   dependsOnKeys: [], requiresGateKeys: [], checklistTemplateName: "mep_collection_v1" },
    { key: "site_measurement", title: "Site Measurement",     taskType: "site_measurement", responsibilitySlug: "furniture_measurements", dayOffsetFromProjectStart: 1, plannedDays: 2, plannedHours: 8,  priority: "high",   dependsOnKeys: [], requiresGateKeys: [], checklistTemplateName: "site_measurement_v1" },

    // ── Design
    { key: "concept_making",   title: "Concept Making",       taskType: "concept_making",   responsibilitySlug: "concept_3d",             dayOffsetFromProjectStart: 3, plannedDays: 3, plannedHours: 16, priority: "high",   dependsOnKeys: [],                 requiresGateKeys: [],                         checklistTemplateName: "concept_making_v1" },
    { key: "furniture_layout", title: "Furniture Layout",     taskType: "furniture_layout", responsibilitySlug: "lead_designer",          dayOffsetFromProjectStart: 5, plannedDays: 3, plannedHours: 16, priority: "high",   dependsOnKeys: ["site_measurement"], requiresGateKeys: [],                         checklistTemplateName: "furniture_layout_v1" },
    { key: "civil_drawing",    title: "Civil Drawing",        taskType: "civil_drawing",    responsibilitySlug: "furniture_measurements", dayOffsetFromProjectStart: 8, plannedDays: 3, plannedHours: 12, priority: "medium", dependsOnKeys: [],                 requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "civil_drawing_v1" },
    { key: "3d_render",        title: "3D Render",            taskType: "3d_render",        responsibilitySlug: "concept_3d",             dayOffsetFromProjectStart: 10, plannedDays: 3, plannedHours: 24, priority: "medium", dependsOnKeys: [],                 requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "3d_render_v1" },

    // ── Handover
    { key: "handover_signoff", title: "Handover Sign-off",    taskType: "handover_signoff", responsibilitySlug: "lead_designer",          dayOffsetFromProjectStart: 25, plannedDays: 1, plannedHours: 4, priority: "high", dependsOnKeys: [], requiresGateKeys: ["gate_material"], checklistTemplateName: "handover_signoff_v1" },
  ],

  gates: [
    { key: "gate_furniture_layout", label: "Furniture Layout — Client Approval", gateType: "gate_furniture_layout", approverType: "client",                listensTo: "furniture_layout", unblocks: ["civil_drawing", "3d_render"], blockedActivities: ["task.submit"] },
    { key: "gate_material",         label: "Material Selection — Client Approval", gateType: "gate_wall_floor",     approverType: "client",                listensTo: "wall_floor_material", unblocks: [],                            blockedActivities: ["po.emit"] },
    { key: "gate_handover",         label: "Handover — Principal + Client Sign-off", gateType: "gate_handover",     approverType: "principal_and_client", unblocks: [],                            blockedActivities: ["site_execution.start"] },
  ],
};

// ─── COMMERCIAL SIMPLE ───────────────────────────────────────────────────────
const COMMERCIAL_SIMPLE = {
  name: "Commercial Simple",
  description:
    "Simplified commercial fit-out flow — Initiate, Design (parallel tracks), Material Finalization, Handover.",
  projectType: "Commercial",
  isDefault: true,
  isActive: true,

  phases: [
    { name: "kickoff",     order: 1, taskKeys: ["mep_collection", "site_measurement"],                                                                                                          gateKeys: [] },
    { name: "design",      order: 2, taskKeys: ["concept_making", "furniture_layout", "civil_drawing", "ac_coordination", "electrical_data", "fire_safety", "3d_render"],                       gateKeys: ["gate_furniture_layout"] },
    { name: "procurement", order: 3, taskKeys: [],                                                                                                                                              gateKeys: ["gate_material"] },
    { name: "handover",    order: 4, taskKeys: ["handover_signoff"],                                                                                                                            gateKeys: ["gate_handover"] },
  ],

  tasks: [
    // ── Kickoff
    { key: "mep_collection",   title: "MEP Collection",         taskType: "mep_collection",   responsibilitySlug: "furniture_measurements", dayOffsetFromProjectStart: 0, plannedDays: 1, plannedHours: 4,  priority: "high",   dependsOnKeys: [], requiresGateKeys: [], checklistTemplateName: "mep_collection_v1" },
    { key: "site_measurement", title: "Site Measurement",       taskType: "site_measurement", responsibilitySlug: "furniture_measurements", dayOffsetFromProjectStart: 1, plannedDays: 2, plannedHours: 8,  priority: "high",   dependsOnKeys: [], requiresGateKeys: [], checklistTemplateName: "site_measurement_v1" },

    // ── Design (parallel tracks after furniture layout approved)
    { key: "concept_making",   title: "Concept Making",         taskType: "concept_making",   responsibilitySlug: "concept_3d",             dayOffsetFromProjectStart: 3,  plannedDays: 3, plannedHours: 16, priority: "high",   dependsOnKeys: [],                 requiresGateKeys: [],                         checklistTemplateName: "concept_making_v1" },
    { key: "furniture_layout", title: "Furniture Layout",       taskType: "furniture_layout", responsibilitySlug: "lead_designer",          dayOffsetFromProjectStart: 5,  plannedDays: 3, plannedHours: 20, priority: "high",   dependsOnKeys: ["site_measurement"], requiresGateKeys: [],                         checklistTemplateName: "furniture_layout_v1" },
    { key: "civil_drawing",    title: "Civil Drawing",          taskType: "civil_drawing",    responsibilitySlug: "furniture_measurements", dayOffsetFromProjectStart: 8,  plannedDays: 4, plannedHours: 16, priority: "medium", dependsOnKeys: [],                 requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "civil_drawing_v1" },
    { key: "ac_coordination",  title: "AC Coordination",        taskType: "ac_coordination",  responsibilitySlug: "technical_drawings",     dayOffsetFromProjectStart: 8,  plannedDays: 4, plannedHours: 16, priority: "medium", dependsOnKeys: [],                 requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "ac_coordination_v1" },
    { key: "electrical_data",  title: "Electrical / Data Layout", taskType: "technical_drawing", responsibilitySlug: "technical_drawings",   dayOffsetFromProjectStart: 8,  plannedDays: 4, plannedHours: 16, priority: "medium", dependsOnKeys: [],                 requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "technical_drawing_v1" },
    { key: "fire_safety",      title: "Fire Safety Drawings",   taskType: "technical_drawing", responsibilitySlug: "technical_drawings",     dayOffsetFromProjectStart: 10, plannedDays: 3, plannedHours: 12, priority: "medium", dependsOnKeys: [],                 requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "technical_drawing_v1" },
    { key: "3d_render",        title: "3D Render",              taskType: "3d_render",        responsibilitySlug: "concept_3d",             dayOffsetFromProjectStart: 11, plannedDays: 4, plannedHours: 24, priority: "medium", dependsOnKeys: [],                 requiresGateKeys: ["gate_furniture_layout"], checklistTemplateName: "3d_render_v1" },

    // ── Handover
    { key: "handover_signoff", title: "Handover Sign-off",      taskType: "handover_signoff", responsibilitySlug: "lead_designer",          dayOffsetFromProjectStart: 30, plannedDays: 1, plannedHours: 4, priority: "high", dependsOnKeys: [], requiresGateKeys: ["gate_material"], checklistTemplateName: "handover_signoff_v1" },
  ],

  gates: [
    { key: "gate_furniture_layout", label: "Furniture Layout — Client Approval", gateType: "gate_furniture_layout", approverType: "client",                listensTo: "furniture_layout",    unblocks: ["civil_drawing", "ac_coordination", "electrical_data", "fire_safety", "3d_render"], blockedActivities: ["task.submit"] },
    { key: "gate_material",         label: "Material Selection — Client Approval", gateType: "gate_wall_floor",     approverType: "client",                listensTo: "wall_floor_material", unblocks: [],                            blockedActivities: ["po.emit"] },
    { key: "gate_handover",         label: "Handover — Principal + Client Sign-off", gateType: "gate_handover",     approverType: "principal_and_client", unblocks: [],                            blockedActivities: ["site_execution.start"] },
  ],
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log("✔ Mongo connected");

  // Step 1 — clear the default flag on legacy templates so the unique-default
  // constraint doesn't trip when the new ones come in as default.
  await WorkflowTemplate.updateMany(
    { name: { $in: ["Residential Full", "Commercial Full", "Residential Simple", "Commercial Simple"] } },
    { $set: { isDefault: false } }
  );

  // Step 2 — delete the legacy "Full" templates.
  const delRes = await WorkflowTemplate.deleteMany({ name: { $in: ["Residential Full", "Commercial Full"] } });
  console.log(`✔ Deleted legacy templates: ${delRes.deletedCount}`);

  // Step 3 — upsert the new "Simple" templates.
  for (const tpl of [RESIDENTIAL_SIMPLE, COMMERCIAL_SIMPLE]) {
    await WorkflowTemplate.updateOne(
      { name: tpl.name },
      { $set: tpl },
      { upsert: true }
    );
    console.log(`✔ Upserted: ${tpl.name}`);
  }

  // Step 4 — verify
  const out = await WorkflowTemplate.find({}).select("name projectType isDefault isActive phases tasks gates").lean();
  console.log("\n--- Final state ---");
  console.table(out.map((t) => ({
    name: t.name,
    type: t.projectType,
    default: t.isDefault,
    active: t.isActive,
    phases: t.phases?.length,
    tasks: t.tasks?.length,
    gates: t.gates?.length,
  })));

  await mongoose.disconnect();
  console.log("✔ Done.");
  process.exit(0);
})().catch((err) => {
  console.error("✖ Failed:", err);
  process.exit(1);
});
