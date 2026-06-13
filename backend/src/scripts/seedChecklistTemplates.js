/**
 * Seed Phase 1 ChecklistTemplate documents.
 *
 * Source: the DEFAULT_CHECKLISTS constant in Task.controller.js (kept until
 * cutover) reconciled with the PDF "Design Sub-Flow" checklists.
 *
 * Run once after deploying Phase 1 schema:
 *   node backend/src/scripts/seedChecklistTemplates.js
 *
 * Safe to re-run — uses upsert by `name`.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const ChecklistTemplate = require("../modules/pms/models/ChecklistTemplate.model");

const TEMPLATES = [
  {
    name: "ac_coordination_v1",
    taskType: "ac_coordination",
    description: "AC Coordination — 9 steps per PDF AC Checklist",
    items: [
      { label: "Take AC vendor number from Purchase", order: 1 },
      { label: "Inform Manager to create WhatsApp group (Designer + Principal Designer + Client + AC vendor)", order: 2 },
      { label: "Send AutoCAD final furniture layout to group/mail (all vendors if multiple)", order: 3 },
      { label: "Understand from Principal Designer: AC type and tentative location", order: 4 },
      { label: "Coordinate with vendor for drawings in group/call", order: 5 },
      { label: "Send all drawings to group", order: 6 },
      { label: "Close AC position drawing — get final consent from Principal Designer", order: 7 },
      { label: "Get pipeline drawing based on AC unit position and get approved", order: 8 },
      { label: "Ask for quotation based on final drawing", order: 9 },
    ],
  },
  {
    name: "technical_drawing_v1",
    taskType: "technical_drawing",
    description: "Technical Drawing — PDF Technical Checklist",
    items: [
      { label: "Tentative Wall Electrical drawing complete", order: 1 },
      { label: "Ceiling Electrical drawing complete", order: 2 },
      { label: "IT Drawings — Camera positions marked", order: 3 },
      { label: "IT Drawings — LAN / Phone / Internet points marked", order: 4 },
    ],
  },
  {
    name: "kitchen_drawing_v1",
    taskType: "kitchen_drawing",
    description: "Kitchen Drawing — PDF Kitchen Checklist (6 items)",
    items: [
      { label: "Make Layout", order: 1 },
      { label: "Take out concept + Moodboard", order: 2 },
      { label: "Make Basic Elevation", order: 3 },
      { label: "Update all Drawings", order: 4 },
      { label: "Appliance specifications confirmed", order: 5 },
      { label: "All material details finalised", order: 6 },
    ],
  },
  {
    name: "bathroom_drawing_v1",
    taskType: "bathroom_drawing",
    description: "Bathroom Drawing — material selection, 2D, 3D, working drawing",
    items: [
      { label: "Material selection confirmed (Fittings, Wall & Floor cladding)", order: 1 },
      { label: "Concept pic sent to client and approved (if needed)", order: 2 },
      { label: "Layout completed and approved", order: 3 },
      { label: "2D drawings complete", order: 4 },
      { label: "3D visualisation approved", order: 5 },
      { label: "Detail working drawing complete", order: 6 },
      { label: "All files uploaded to DLR", order: 7 },
    ],
  },
  {
    name: "furniture_layout_v1",
    taskType: "furniture_layout",
    description: "Furniture Layout — gating task for parallel design tracks",
    items: [
      { label: "Site measurements taken as per checklist", order: 1 },
      { label: "MEP drawings received from client", order: 2 },
      { label: "Furniture layout completed within deadline", order: 3 },
      { label: "Layout sent to WhatsApp group for client review", order: 4 },
      { label: "Client approval received", order: 5 },
    ],
  },
  {
    name: "civil_drawing_v1",
    taskType: "civil_drawing",
    description: "Civil Drawing — PDF Civil Checklist (5 items)",
    items: [
      { label: "Original Plan prepared", order: 1 },
      { label: "Original door/window schedule complete", order: 2 },
      { label: "Walls to be broken — marked on drawing", order: 3 },
      { label: "Walls to be constructed — marked on drawing", order: 4 },
      { label: "Door/window schedule updated as per furniture layout", order: 5 },
    ],
  },
  {
    name: "3d_render_v1",
    taskType: "3d_render",
    description: "3D Render — Principal Designer review loop then client",
    items: [
      { label: "Render created as per approved concept", order: 1 },
      { label: "Sent to Principal Designer for internal review", order: 2 },
      { label: "Client presentation completed", order: 3 },
      { label: "Client approval received", order: 4 },
      { label: "Working drawing completed post-approval and uploaded to DLR", order: 5 },
    ],
  },
  {
    name: "concept_making_v1",
    taskType: "concept_making",
    description: "Concept Making — first client meeting + feedback meeting",
    items: [
      { label: "Client meeting held with all style concepts presented", order: 1 },
      { label: "Concept refined area-wise as per client feedback", order: 2 },
      { label: "Client shortlisting meeting completed", order: 3 },
      { label: "Final concept direction confirmed (3D render / 2D)", order: 4 },
    ],
  },
  {
    name: "automation_coordination_v1",
    taskType: "automation_coordination",
    description: "Automation Coordination — EA vendor handoff to Designer C",
    items: [
      { label: "Drawing sent to Automation vendor (EA)", order: 1 },
      { label: "Quotation received and WhatsApp group created", order: 2 },
      { label: "Purchase department informed", order: 3 },
      { label: "Client approval obtained", order: 4 },
      { label: "Designer C drawing completed and approved", order: 5 },
      { label: "Drawing uploaded to DLR", order: 6 },
    ],
  },
  {
    name: "site_measurement_v1",
    taskType: "site_measurement",
    description: "Site Measurement — Designer B per PDF",
    items: [
      { label: "Measurements taken as per civil checklist", order: 1 },
      { label: "MEP drawing references collected from client", order: 2 },
    ],
  },
  // Phase 1 new task types
  {
    name: "mep_collection_v1",
    taskType: "mep_collection",
    description: "Collect MEP drawings from client (Designer B)",
    items: [
      { label: "Request MEP drawing set from client", order: 1 },
      { label: "Verify drawings received and complete", order: 2 },
      { label: "File copies in DLR for reference", order: 3 },
    ],
  },
  {
    name: "concept_first_meeting_v1",
    taskType: "concept_first_meeting",
    description: "First concept meeting with client (Designer E, D+3)",
    items: [
      { label: "Schedule meeting with client", order: 1 },
      { label: "Present all style concept work", order: 2 },
      { label: "Capture client feedback and preferences", order: 3 },
    ],
  },
  {
    name: "concept_feedback_meeting_v1",
    taskType: "concept_feedback_meeting",
    description: "Concept feedback / shortlisting meeting (Designer E, D+5)",
    items: [
      { label: "Prepare concept revisions per area", order: 1 },
      { label: "Meet with client to shortlist concepts", order: 2 },
      { label: "Confirm final concept direction (3D or 2D)", order: 3 },
    ],
  },
  {
    name: "handover_signoff_v1",
    taskType: "handover_signoff",
    description: "Design → Execution handover signoff",
    items: [
      { label: "Complete drawing set assembled", order: 1 },
      { label: "Supervisor walkthrough completed", order: 2 },
      { label: "Design lead signoff", order: 3 },
      { label: "Supervisor accept signoff", order: 4 },
    ],
  },

  // Phase 3b — Kitchen branch children (in_house)
  {
    name: "kitchen_detail_elevation_v1",
    taskType: "kitchen_detail_elevation",
    description: "Kitchen — Detail Elevation (in-house route)",
    items: [
      { label: "Capture exact dimensions on site", order: 1 },
      { label: "Draft front + side elevations", order: 2 },
      { label: "Mark out cabinet partitions and shutters", order: 3 },
      { label: "Annotate hardware positions (hinges, channels, handles)", order: 4 },
      { label: "Cross-check with electrical points", order: 5 },
      { label: "Internal review with Designer D", order: 6 },
    ],
  },
  {
    name: "kitchen_3d_v1",
    taskType: "kitchen_3d",
    description: "Kitchen — 3D Visualisation (in-house route)",
    items: [
      { label: "Model cabinet bodies + shutters per elevation", order: 1 },
      { label: "Apply approved materials + finishes", order: 2 },
      { label: "Place appliances and accessories", order: 3 },
      { label: "Lighting setup for daylight + warm scene", order: 4 },
      { label: "Render 3-4 hero angles", order: 5 },
      { label: "Principal Designer internal review", order: 6 },
    ],
  },
  {
    name: "kitchen_technical_drawings_v1",
    taskType: "kitchen_technical_drawings",
    description: "Kitchen — Technical Drawings (per checklist)",
    items: [
      { label: "Floor plan with cabinet footprint", order: 1 },
      { label: "Front + side elevations with dimensions", order: 2 },
      { label: "Electrical layout (sockets, switches, lights)", order: 3 },
      { label: "Plumbing layout (sink, RO, dishwasher)", order: 4 },
      { label: "Appliance specification sheet", order: 5 },
      { label: "Material BOQ", order: 6 },
      { label: "Cross-check DLR for prior drawings", order: 7 },
    ],
  },
  {
    name: "kitchen_release_ready_v1",
    taskType: "kitchen_release_ready",
    description: "Kitchen — Release Ready (DLR + Site)",
    items: [
      { label: "All drawings uploaded to DLR", order: 1 },
      { label: "Reference images attached", order: 2 },
      { label: "Print sets prepared (A3 / A4 as per design)", order: 3 },
      { label: "Supervisor briefed on site requirements", order: 4 },
      { label: "Release notes captured", order: 5 },
    ],
  },

  // Phase 3b — Kitchen branch children (outsourced)
  {
    name: "kitchen_vendor_purchase_v1",
    taskType: "kitchen_vendor_purchase",
    description: "Kitchen — Send to vendor via Purchase",
    items: [
      { label: "Identify approved kitchen vendor with Purchase", order: 1 },
      { label: "Share complete furniture layout + concept", order: 2 },
      { label: "Share materials + finishes preference", order: 3 },
      { label: "Confirm site visit slot for vendor measurement", order: 4 },
    ],
  },
  {
    name: "kitchen_tentative_quote_v1",
    taskType: "kitchen_tentative_quote",
    description: "Kitchen — Tentative Quote",
    items: [
      { label: "Receive vendor tentative quote", order: 1 },
      { label: "Cross-check with project budget", order: 2 },
      { label: "Flag variance and seek revisions if needed", order: 3 },
      { label: "Get internal approval to share with client", order: 4 },
    ],
  },
  {
    name: "kitchen_client_meeting_v1",
    taskType: "kitchen_client_meeting",
    description: "Kitchen — Client Meeting",
    items: [
      { label: "Schedule meeting with client + vendor + Designer D", order: 1 },
      { label: "Walk client through quote and design", order: 2 },
      { label: "Capture client preferences and changes", order: 3 },
      { label: "Confirm next steps", order: 4 },
    ],
  },
  {
    name: "kitchen_vendor_finalization_v1",
    taskType: "kitchen_vendor_finalization",
    description: "Kitchen — Vendor Finalisation",
    items: [
      { label: "Vendor revises quote based on client feedback", order: 1 },
      { label: "Client gives written approval", order: 2 },
      { label: "Open VendorEngagement for kitchen vendor", order: 3 },
      { label: "PO emission gated by client approval", order: 4 },
    ],
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    let created = 0;
    let updated = 0;

    for (const tplData of TEMPLATES) {
      const result = await ChecklistTemplate.findOneAndUpdate(
        { name: tplData.name },
        { $set: { ...tplData, isDefault: true, isActive: true } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      if (result.createdAt?.getTime() === result.updatedAt?.getTime()) {
        created++;
      } else {
        updated++;
      }
    }

    console.log(
      `Checklist template seed complete. ${created} created, ${updated} updated. Total: ${TEMPLATES.length}.`
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

module.exports = { TEMPLATES };
