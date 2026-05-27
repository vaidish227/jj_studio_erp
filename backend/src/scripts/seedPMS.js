/**
 * PMS / DDMS Dummy Data Seeder
 *
 * Creates realistic test data for the PMS and Drawing Library modules.
 * Safe to re-run — clears only the records tagged [SEED] then re-inserts.
 *
 * Usage:
 *   node backend/src/scripts/seedPMS.js
 *
 * What it seeds:
 *   • 7 test users  (password: Test@1234)
 *   • 3 CRM clients
 *   • 3 projects
 *   • 14 tasks  (4–5 per project, various task types)
 *   • 9 drawings (3 per project, mix of statuses)
 *   • 5 vendors
 *   • 6 site logs (on the execution-phase project)
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

const mongoose = require("mongoose");
const bcrypt   = require("bcrypt");

// ─── Models ──────────────────────────────────────────────────────────────────
const User      = require("../modules/auth/models/user.model");
const CRMClient = require("../modules/crm/models/CRMClient.model");
const Project   = require("../modules/pms/models/Project.model");
const Task      = require("../modules/pms/models/Task.model");
const Drawing   = require("../modules/pms/models/Drawing.model");
const Vendor    = require("../modules/pms/models/Vendor.model");
const SiteLog   = require("../modules/pms/models/SiteLog.model");

// ─── Helpers ─────────────────────────────────────────────────────────────────
const SEED_TAG  = "[SEED]"; // marker to identify seeded records
const PASSWORD  = "Test@1234";

function daysAgo(n) { return new Date(Date.now() - n * 86400000); }
function daysFromNow(n) { return new Date(Date.now() + n * 86400000); }

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB\n");

  // ── 1. Clear old seed data ──────────────────────────────────────────────
  console.log("🧹 Removing previous [SEED] records...");
  await SiteLog.deleteMany({ notes: SEED_TAG });
  await Drawing.deleteMany({ notes: SEED_TAG });
  await Task.deleteMany({ notes: SEED_TAG });
  await Project.deleteMany({ notes: SEED_TAG });

  await Vendor.deleteMany({ notes: new RegExp(SEED_TAG) });
  await CRMClient.deleteMany({ notes: new RegExp(SEED_TAG) });
  await User.deleteMany({ email: /@jjseed\.dev$/ });

  console.log("✅ Old seed data cleared\n");

  // ── 2. Users ───────────────────────────────────────────────────────────
  console.log("👤 Seeding users...");
  const hash = await bcrypt.hash(PASSWORD, 10);

  const usersData = [
    { name: "Priya Sharma",  email: "priya@jjseed.dev",    role: "manager",    phone: "9876540001" },
    { name: "Aditya Mehta",  email: "aditya@jjseed.dev",   role: "designer",   phone: "9876540002" },
    { name: "Kavya Reddy",   email: "kavya@jjseed.dev",    role: "designer",   phone: "9876540003" },
    { name: "Rohan Joshi",   email: "rohan@jjseed.dev",    role: "designer",   phone: "9876540004" },
    { name: "Neha Patel",    email: "neha@jjseed.dev",     role: "designer",   phone: "9876540005" },
    { name: "Arjun Singh",   email: "arjun@jjseed.dev",    role: "designer",   phone: "9876540006" },
    { name: "Rajesh Kumar",  email: "rajesh@jjseed.dev",   role: "supervisor", phone: "9876540007" },
  ];

  const createdUsers = await User.insertMany(
    usersData.map((u) => ({ ...u, password: hash }))
  );

  const [manager, designerA, designerB, designerC, designerD, designerE, supervisor] = createdUsers;
  console.log(`   Created ${createdUsers.length} users (password: ${PASSWORD})`);

  // ── 3. CRM Clients ─────────────────────────────────────────────────────
  console.log("\n🏠 Seeding CRM clients...");

  const clientsData = [
    {
      name: "Suresh Mehta",
      phone: "9988770011",
      email: "suresh.mehta@gmail.com",
      source: "referral",
      status: "converted",
      lifecycleStage: "converted",
      projectType: "Residential",
      area: 2200,
      budget: 5500000,
      city: "Mumbai",
      siteAddress: {
        buildingName: "Prestige Heights",
        tower: "B",
        unit: "1204",
        floor: "12",
        fullAddress: "1204, Tower B, Prestige Heights, Andheri West, Mumbai",
        city: "Mumbai",
      },
      notes: `Client is very particular about luxury finishes. ${SEED_TAG}`,
      assignedTo: manager._id,
    },
    {
      name: "Anita Desai",
      phone: "9988770022",
      email: "anita.desai@desaigroup.in",
      source: "website",
      status: "converted",
      lifecycleStage: "converted",
      projectType: "Commercial",
      area: 4800,
      budget: 12000000,
      city: "Pune",
      siteAddress: {
        buildingName: "Desai Corporate Park",
        tower: "Wing A",
        unit: "Ground Floor",
        floor: "G",
        fullAddress: "Ground Floor, Wing A, Desai Corporate Park, Hinjewadi Phase 1, Pune",
        city: "Pune",
      },
      notes: `Corporate client. Open office concept with cabins. ${SEED_TAG}`,
      assignedTo: manager._id,
    },
    {
      name: "Kapil Sharma",
      phone: "9988770033",
      email: "kapil.sharma@yahoo.com",
      source: "instagram",
      status: "converted",
      lifecycleStage: "converted",
      projectType: "Residential",
      area: 1800,
      budget: 3200000,
      city: "Bangalore",
      siteAddress: {
        buildingName: "Sobha Dream Gardens",
        tower: "C",
        unit: "302",
        floor: "3",
        fullAddress: "302, Tower C, Sobha Dream Gardens, Whitefield, Bangalore",
        city: "Bangalore",
      },
      notes: `First-time home buyer. Wants modern minimalist style. ${SEED_TAG}`,
      assignedTo: manager._id,
    },
  ];

  // insertMany fires all pre-save hooks concurrently → same countDocuments() → duplicate trackingId.
  // Use sequential create() so each auto-increment reads the updated count.
  const clientMehta  = await CRMClient.create(clientsData[0]);
  const clientDesai  = await CRMClient.create(clientsData[1]);
  const clientSharma = await CRMClient.create(clientsData[2]);
  console.log(`   Created ${clientsData.length} CRM clients`);

  // ── 4. Vendors ─────────────────────────────────────────────────────────
  console.log("\n🏪 Seeding vendors...");

  const vendorsData = [
    {
      name: "AirCool Solutions",
      category: "AC",
      contactPerson: "Ramesh Tiwari",
      phone: "9911220001",
      email: "sales@aircoolsolutions.com",
      address: "Plot 12, MIDC, Andheri East, Mumbai",
      rating: 4,
      status: "active",
      notes: `Daikin authorised dealer. 5-year AMC available. ${SEED_TAG}`,
    },
    {
      name: "SmartHome India",
      category: "Automation",
      contactPerson: "Vivek Nanda",
      phone: "9911220002",
      email: "vivek@smarthomeindia.in",
      address: "F-21, DLF Cyber City, Gurugram",
      rating: 5,
      status: "active",
      notes: `Crestron & Lutron certified. Preferred for high-end projects. ${SEED_TAG}`,
    },
    {
      name: "Modular Kitchen Pro",
      category: "Kitchen",
      contactPerson: "Sonal Gupta",
      phone: "9911220003",
      email: "sonal@modularkitchenpro.com",
      address: "Shop 5, Design Square, Borivali West, Mumbai",
      rating: 4,
      status: "active",
      notes: `Hafele hardware. Lead time 6-8 weeks. ${SEED_TAG}`,
    },
    {
      name: "WoodCraft Industries",
      category: "Carpentry",
      contactPerson: "Rajendra Sawant",
      phone: "9911220004",
      email: "rajendra@woodcraft.in",
      address: "Shed 7, Bhiwandi Warehouse Zone, Thane",
      rating: 3,
      status: "active",
      notes: `Good quality but sometimes delays. Follow up required. ${SEED_TAG}`,
    },
    {
      name: "ElectroPro Services",
      category: "Electrical",
      contactPerson: "Sunil Kore",
      phone: "9911220005",
      email: "sunil@electropro.in",
      address: "Office 3, Kalyani Nagar, Pune",
      rating: 4,
      status: "active",
      notes: `Legrand authorised. Handle site wiring and panel work. ${SEED_TAG}`,
    },
  ];

  const [vendorAC, vendorAuto, vendorKitchen, vendorCarpentry, vendorElec] = await Vendor.insertMany(vendorsData);
  console.log(`   Created ${vendorsData.length} vendors`);

  // ── 5. Projects ────────────────────────────────────────────────────────
  console.log("\n📁 Seeding projects...");

  const projectsData = [
    {
      clientId:  clientMehta._id,
      name:      "Mehta Villa — 3BHK Redesign",
      projectType: "Residential",
      siteAddress: clientMehta.siteAddress,
      area:   2200,
      budget: 5500000,
      status: "design_phase",
      primaryDesigner: designerA._id,
      designerB:       designerB._id,
      designerC:       designerC._id,
      designerD:       designerD._id,
      designerE:       designerE._id,
      supervisor:      supervisor._id,
      startDate:       daysAgo(25),
      estimatedCompletionDate: daysFromNow(90),
      kickstartCompleted: true,
      kickstartData: {
        mainGroupCreated:        true,
        drawingGroupCreated:     true,
        supervisionGroupCreated: true,
        paymentGroupCreated:     true,
        detailFormSentToClient:  true,
        labourQuotationSent:     true,
      },
      clientApprovals: [
        { type: "ac",               status: "obtained",       obtainedAt: daysAgo(10), notes: "Samsung 4-ton cassette units approved" },
        { type: "automation",       status: "pending",        notes: "Lutron vs Crestron still being evaluated" },
        { type: "kitchen",          status: "pending" },
        { type: "bathroom_material",status: "not_applicable", notes: "Client using own contractor for bathrooms" },
        { type: "cp_fittings",      status: "pending" },
        { type: "wall_floor_material", status: "pending" },
      ],
      notes: SEED_TAG,
      tags: ["luxury", "mumbai", "residential"],
    },
    {
      clientId:  clientDesai._id,
      name:      "Desai Corporate Office — Open Plan",
      projectType: "Commercial",
      siteAddress: clientDesai.siteAddress,
      area:   4800,
      budget: 12000000,
      status: "execution_phase",
      primaryDesigner: designerA._id,
      designerB:       designerB._id,
      designerC:       designerC._id,
      supervisor:      supervisor._id,
      startDate:       daysAgo(60),
      estimatedCompletionDate: daysFromNow(30),
      kickstartCompleted: true,
      kickstartData: {
        mainGroupCreated:        true,
        drawingGroupCreated:     true,
        supervisionGroupCreated: true,
        paymentGroupCreated:     true,
        detailFormSentToClient:  true,
        labourQuotationSent:     true,
      },
      clientApprovals: [
        { type: "ac",               status: "obtained",  obtainedAt: daysAgo(40) },
        { type: "automation",       status: "obtained",  obtainedAt: daysAgo(35) },
        { type: "kitchen",          status: "not_applicable", notes: "No kitchen — only pantry area" },
        { type: "bathroom_material",status: "obtained",  obtainedAt: daysAgo(30) },
        { type: "cp_fittings",      status: "obtained",  obtainedAt: daysAgo(28) },
        { type: "wall_floor_material", status: "obtained", obtainedAt: daysAgo(20) },
      ],
      notes: SEED_TAG,
      tags: ["commercial", "pune", "office"],
    },
    {
      clientId:  clientSharma._id,
      name:      "Sharma Residence — Minimalist 2BHK",
      projectType: "Residential",
      siteAddress: clientSharma.siteAddress,
      area:   1800,
      budget: 3200000,
      status: "design_phase",
      primaryDesigner: designerA._id,
      designerB:       designerB._id,
      designerD:       designerD._id,
      designerE:       designerE._id,
      supervisor:      supervisor._id,
      startDate:       daysAgo(10),
      estimatedCompletionDate: daysFromNow(120),
      kickstartCompleted: false,
      kickstartData: {
        mainGroupCreated:        true,
        drawingGroupCreated:     true,
        supervisionGroupCreated: false,
        paymentGroupCreated:     true,
        detailFormSentToClient:  false,
        labourQuotationSent:     false,
      },
      clientApprovals: [
        { type: "ac",               status: "pending" },
        { type: "automation",       status: "not_applicable", notes: "No automation on this project" },
        { type: "kitchen",          status: "pending" },
        { type: "bathroom_material",status: "pending" },
        { type: "cp_fittings",      status: "pending" },
        { type: "wall_floor_material", status: "pending" },
      ],
      notes: SEED_TAG,
      tags: ["minimalist", "bangalore", "residential"],
    },
  ];

  // Sequential creates — Project also uses countDocuments() for trackingId auto-increment.
  const projMehta  = await Project.create(projectsData[0]);
  const projDesai  = await Project.create(projectsData[1]);
  const projSharma = await Project.create(projectsData[2]);
  console.log(`   Created ${projectsData.length} projects`);

  // ── 6. Tasks ───────────────────────────────────────────────────────────
  console.log("\n✅ Seeding tasks...");

  const tasksData = [
    // ─── Mehta Villa (design_phase) ───
    {
      projectId: projMehta._id,
      taskType:  "concept_making",
      title:     "Concept Mood Board — Living & Master Bedroom",
      assignedTo: designerE._id,
      status:    "completed",
      priority:  "high",
      dueDate:   daysAgo(15),
      startDate: daysAgo(25),
      completedAt: daysAgo(16),
      checklist: [
        { item: "Gather reference images from client", isCompleted: true, completedAt: daysAgo(22) },
        { item: "Create 3 mood board options", isCompleted: true, completedAt: daysAgo(18) },
        { item: "Client presentation and sign-off", isCompleted: true, completedAt: daysAgo(16) },
      ],
      notes: SEED_TAG,
    },
    {
      projectId: projMehta._id,
      taskType:  "furniture_layout",
      title:     "Furniture Layout — All Rooms",
      assignedTo: designerB._id,
      status:    "in_progress",
      priority:  "high",
      dueDate:   daysFromNow(10),
      startDate: daysAgo(15),
      checklist: [
        { item: "Living room furniture plan", isCompleted: true, completedAt: daysAgo(10) },
        { item: "Master bedroom layout", isCompleted: true, completedAt: daysAgo(7) },
        { item: "Children's room layout", isCompleted: false },
        { item: "Kitchen + utility area", isCompleted: false },
      ],
      notes: SEED_TAG,
    },
    {
      projectId: projMehta._id,
      taskType:  "ac_coordination",
      title:     "AC Ducting Layout & Vendor Coordination",
      assignedTo: designerC._id,
      status:    "in_progress",
      priority:  "medium",
      dueDate:   daysFromNow(20),
      startDate: daysAgo(5),
      externalCoordination: {
        isNeeded:          true,
        vendorId:          vendorAC._id,
        quotationUrl:      "https://drive.google.com/file/ac-quotation-mehta",
        amount:            285000,
        isApprovedByClient: true,
      },
      checklist: [
        { item: "Site measurement by AC vendor", isCompleted: true, completedAt: daysAgo(3) },
        { item: "Ducting layout drawing submitted", isCompleted: false },
        { item: "Coordination with civil for false ceiling", isCompleted: false },
      ],
      notes: SEED_TAG,
    },
    {
      projectId: projMehta._id,
      taskType:  "kitchen_drawing",
      title:     "Modular Kitchen — Working Drawings",
      assignedTo: designerD._id,
      status:    "not_started",
      priority:  "medium",
      dueDate:   daysFromNow(25),
      startDate: daysFromNow(5),
      externalCoordination: {
        isNeeded: true,
        vendorId: vendorKitchen._id,
      },
      checklist: [
        { item: "Collect site dimensions", isCompleted: false },
        { item: "Create preliminary kitchen layout", isCompleted: false },
        { item: "Material and finish selection", isCompleted: false },
        { item: "Vendor shop drawing approval", isCompleted: false },
      ],
      notes: SEED_TAG,
    },
    {
      projectId: projMehta._id,
      taskType:  "technical_drawing",
      title:     "False Ceiling & Electrical Points Drawing",
      assignedTo: designerC._id,
      status:    "not_started",
      priority:  "medium",
      dueDate:   daysFromNow(30),
      checklist: [
        { item: "Ceiling height verification at site", isCompleted: false },
        { item: "AC duct and light integration", isCompleted: false },
        { item: "Submit to client for sign-off", isCompleted: false },
      ],
      notes: SEED_TAG,
    },

    // ─── Desai Corporate (execution_phase) ───
    {
      projectId: projDesai._id,
      taskType:  "technical_drawing",
      title:     "Partition & Ceiling — As-Built Drawing",
      assignedTo: designerC._id,
      status:    "released_to_site",
      priority:  "high",
      dueDate:   daysAgo(20),
      startDate: daysAgo(55),
      completedAt: daysAgo(22),
      checklist: [
        { item: "Site survey complete", isCompleted: true, completedAt: daysAgo(50) },
        { item: "Drawing prepared", isCompleted: true, completedAt: daysAgo(35) },
        { item: "Approved by manager", isCompleted: true, completedAt: daysAgo(25) },
        { item: "Released to site contractor", isCompleted: true, completedAt: daysAgo(22) },
      ],
      notes: SEED_TAG,
    },
    {
      projectId: projDesai._id,
      taskType:  "ac_coordination",
      title:     "Central AC & VRF System Coordination",
      assignedTo: designerC._id,
      status:    "completed",
      priority:  "high",
      dueDate:   daysAgo(30),
      startDate: daysAgo(58),
      completedAt: daysAgo(32),
      externalCoordination: {
        isNeeded:          true,
        vendorId:          vendorAC._id,
        quotationUrl:      "https://drive.google.com/file/ac-quotation-desai",
        amount:            680000,
        isApprovedByClient: true,
      },
      notes: SEED_TAG,
    },
    {
      projectId: projDesai._id,
      taskType:  "automation_coordination",
      title:     "Lighting Automation & AV System",
      assignedTo: designerC._id,
      status:    "completed",
      priority:  "medium",
      dueDate:   daysAgo(25),
      completedAt: daysAgo(28),
      externalCoordination: {
        isNeeded:          true,
        vendorId:          vendorAuto._id,
        quotationUrl:      "https://drive.google.com/file/automation-desai",
        amount:            420000,
        isApprovedByClient: true,
      },
      notes: SEED_TAG,
    },
    {
      projectId: projDesai._id,
      taskType:  "3d_render",
      title:     "Open Office 3D Walkthrough",
      assignedTo: designerE._id,
      status:    "completed",
      priority:  "medium",
      dueDate:   daysAgo(40),
      completedAt: daysAgo(42),
      checklist: [
        { item: "Raw 3D model from floor plan", isCompleted: true, completedAt: daysAgo(48) },
        { item: "Lighting and material rendering", isCompleted: true, completedAt: daysAgo(44) },
        { item: "Client presentation", isCompleted: true, completedAt: daysAgo(42) },
      ],
      notes: SEED_TAG,
    },

    // ─── Sharma Residence (design_phase — early stage) ───
    {
      projectId: projSharma._id,
      taskType:  "site_measurement",
      title:     "Initial Site Measurement — All Rooms",
      assignedTo: designerB._id,
      status:    "completed",
      priority:  "high",
      dueDate:   daysAgo(5),
      startDate: daysAgo(10),
      completedAt: daysAgo(6),
      checklist: [
        { item: "Living room measurements", isCompleted: true, completedAt: daysAgo(8) },
        { item: "Bedrooms measurements", isCompleted: true, completedAt: daysAgo(8) },
        { item: "Kitchen & bathrooms", isCompleted: true, completedAt: daysAgo(7) },
        { item: "Upload to shared drive", isCompleted: true, completedAt: daysAgo(6) },
      ],
      notes: SEED_TAG,
    },
    {
      projectId: projSharma._id,
      taskType:  "concept_making",
      title:     "Minimalist Concept — Moodboard & References",
      assignedTo: designerE._id,
      status:    "in_progress",
      priority:  "high",
      dueDate:   daysFromNow(7),
      startDate: daysAgo(4),
      checklist: [
        { item: "Collect client Pinterest board references", isCompleted: true, completedAt: daysAgo(3) },
        { item: "Prepare 2 concept options", isCompleted: false },
        { item: "Client review meeting", isCompleted: false },
      ],
      notes: SEED_TAG,
    },
    {
      projectId: projSharma._id,
      taskType:  "kitchen_drawing",
      title:     "Modular Kitchen — Design Draft",
      assignedTo: designerD._id,
      status:    "not_started",
      priority:  "medium",
      dueDate:   daysFromNow(20),
      externalCoordination: { isNeeded: true, vendorId: vendorKitchen._id },
      notes: SEED_TAG,
    },
    {
      projectId: projSharma._id,
      taskType:  "furniture_layout",
      title:     "Furniture Layout — Living & Bedrooms",
      assignedTo: designerB._id,
      status:    "not_started",
      priority:  "medium",
      dueDate:   daysFromNow(15),
      notes: SEED_TAG,
    },
  ];

  const insertedTasks = await Task.insertMany(tasksData);
  console.log(`   Created ${insertedTasks.length} tasks`);

  // Build a quick map: projectId → [taskIds]
  const tasksByProject = {};
  for (const t of insertedTasks) {
    const key = t.projectId.toString();
    if (!tasksByProject[key]) tasksByProject[key] = [];
    tasksByProject[key].push(t);
  }

  const [taskConceptMehta, taskFurnitureMehta] = tasksByProject[projMehta._id.toString()];
  const [taskTechnicalDesai, taskACDesai]       = tasksByProject[projDesai._id.toString()];
  const [taskMeasureSharma]                    = tasksByProject[projSharma._id.toString()];

  // ── 7. Drawings ────────────────────────────────────────────────────────
  console.log("\n🖼️  Seeding drawings...");

  const drawingsData = [
    // ─── Mehta Villa drawings ───
    {
      projectId: projMehta._id,
      taskId:    taskConceptMehta._id,
      title:     "Living Room — Concept Layout v1",
      drawingType: "concept",
      fileUrl:   "https://drive.google.com/file/d/mehta-concept-living-v1",
      fileName:  "mehta_concept_living_v1.pdf",
      fileType:  "application/pdf",
      fileSize:  2048000,
      version:   2,
      revisionNotes: "Updated per client feedback — more neutral palette",
      revisionHistory: [
        {
          version:    1,
          fileUrl:    "https://drive.google.com/file/d/mehta-concept-living-v0",
          fileName:   "mehta_concept_living_v0.pdf",
          uploadedBy: designerE._id,
          uploadedAt: daysAgo(20),
          notes:      "Initial concept — bold colours",
        },
      ],
      status:      "approved",
      uploadedBy:  designerE._id,
      approvedBy:  manager._id,
      approvalDate: daysAgo(14),
      remarks:     "Approved. Proceed with detailed drawings.",
      notes: SEED_TAG,
    },
    {
      projectId: projMehta._id,
      taskId:    taskFurnitureMehta._id,
      title:     "Living Room — Furniture Layout",
      drawingType: "plan",
      fileUrl:   "https://drive.google.com/file/d/mehta-furniture-living",
      fileName:  "mehta_furniture_living.dwg",
      fileType:  "application/dwg",
      fileSize:  512000,
      version:   1,
      status:    "sent_for_approval",
      uploadedBy: designerB._id,
      notes: SEED_TAG,
    },
    {
      projectId: projMehta._id,
      title:     "Master Bedroom — Elevation View",
      drawingType: "elevation",
      fileUrl:   "https://drive.google.com/file/d/mehta-elevation-mbr",
      fileName:  "mehta_elevation_mbr.pdf",
      fileType:  "application/pdf",
      fileSize:  1024000,
      version:   1,
      status:    "draft",
      uploadedBy: designerA._id,
      notes: SEED_TAG,
    },

    // ─── Desai Office drawings ───
    {
      projectId: projDesai._id,
      taskId:    taskTechnicalDesai._id,
      title:     "Office Floor Plan — Partitions & Workstations",
      drawingType: "plan",
      fileUrl:   "https://drive.google.com/file/d/desai-floorplan-v2",
      fileName:  "desai_floor_plan_v2.pdf",
      fileType:  "application/pdf",
      fileSize:  3072000,
      version:   2,
      revisionNotes: "Revised as per client's team size update (120 → 140 seats)",
      status:    "released_to_site",
      uploadedBy: designerA._id,
      approvedBy: manager._id,
      approvalDate: daysAgo(25),
      isReleased:  true,
      releasedAt:  daysAgo(22),
      releasedBy:  manager._id,
      notes: SEED_TAG,
    },
    {
      projectId: projDesai._id,
      taskId:    taskACDesai._id,
      title:     "Central AC — Ducting Layout",
      drawingType: "ac_coordination",
      fileUrl:   "https://drive.google.com/file/d/desai-ac-ducting",
      fileName:  "desai_ac_ducting.pdf",
      fileType:  "application/pdf",
      fileSize:  1536000,
      version:   1,
      status:    "released_to_site",
      uploadedBy: designerC._id,
      approvedBy: manager._id,
      approvalDate: daysAgo(35),
      isReleased:  true,
      releasedAt:  daysAgo(32),
      releasedBy:  manager._id,
      notes: SEED_TAG,
    },
    {
      projectId: projDesai._id,
      title:     "Reception — Elevation & Material Schedule",
      drawingType: "elevation",
      fileUrl:   "https://drive.google.com/file/d/desai-reception-elevation",
      fileName:  "desai_reception_elevation.pdf",
      fileType:  "application/pdf",
      fileSize:  896000,
      version:   1,
      status:    "approved",
      uploadedBy: designerB._id,
      approvedBy: manager._id,
      approvalDate: daysAgo(18),
      notes: SEED_TAG,
    },

    // ─── Sharma Residence drawings ───
    {
      projectId: projSharma._id,
      taskId:    taskMeasureSharma._id,
      title:     "Site Measurement — As-Existing Plan",
      drawingType: "plan",
      fileUrl:   "https://drive.google.com/file/d/sharma-existing-plan",
      fileName:  "sharma_as_existing.pdf",
      fileType:  "application/pdf",
      fileSize:  768000,
      version:   1,
      status:    "approved",
      uploadedBy: designerB._id,
      approvedBy: manager._id,
      approvalDate: daysAgo(5),
      notes: SEED_TAG,
    },
    {
      projectId: projSharma._id,
      title:     "Living Room — Concept Sketch v1",
      drawingType: "concept",
      fileUrl:   "https://drive.google.com/file/d/sharma-concept-v1",
      fileName:  "sharma_concept_sketch_v1.pdf",
      fileType:  "application/pdf",
      fileSize:  512000,
      version:   1,
      status:    "draft",
      uploadedBy: designerE._id,
      notes: SEED_TAG,
    },
    {
      projectId: projSharma._id,
      title:     "Kitchen Layout — Preliminary",
      drawingType: "kitchen",
      fileUrl:   "https://drive.google.com/file/d/sharma-kitchen-prelim",
      fileName:  "sharma_kitchen_prelim.pdf",
      fileType:  "application/pdf",
      fileSize:  256000,
      version:   1,
      status:    "rejected",
      uploadedBy: designerD._id,
      rejectedBy: manager._id,
      rejectedAt: daysAgo(2),
      rejectionReason: "L-shape layout does not match client's preferred U-shape. Please revise.",
      notes: SEED_TAG,
    },
  ];

  const insertedDrawings = await Drawing.insertMany(drawingsData);
  console.log(`   Created ${insertedDrawings.length} drawings`);

  // ── 8. Site Logs (execution-phase project only) ───────────────────────
  console.log("\n📋 Seeding site logs...");

  const siteLogsData = [
    {
      projectId:    projDesai._id,
      supervisorId: supervisor._id,
      logDate:      daysAgo(28),
      workPerformed: "Demolition of existing partitions completed. False ceiling metal framework started in Zone A (reception + conference rooms).",
      manpowerCount: 18,
      issuesReported: "Found concealed drainage pipe behind column D4. Requires civil rerouting before false ceiling can proceed in that zone.",
      blockers: "Civil rerouting of drainage pipe — estimate 3 days delay.",
      notes: SEED_TAG,
    },
    {
      projectId:    projDesai._id,
      supervisorId: supervisor._id,
      logDate:      daysAgo(21),
      workPerformed: "False ceiling gypsum board work 60% complete. AC duct installation in progress in Zone B. Electrical conduit laying done in 80% of area.",
      manpowerCount: 22,
      issuesReported: "AC vendor team arrived 2 hours late. Work extended to 8pm.",
      blockers: "",
      notes: SEED_TAG,
    },
    {
      projectId:    projDesai._id,
      supervisorId: supervisor._id,
      logDate:      daysAgo(14),
      workPerformed: "False ceiling 100% complete. AC installation done. Flooring work started — vitrified tiles in reception and carpet in open office area.",
      manpowerCount: 25,
      issuesReported: "Tile batch 3 has slight colour variation compared to approved sample. Manager review required.",
      blockers: "Awaiting manager approval on tile colour before laying in visible zones.",
      notes: SEED_TAG,
    },
    {
      projectId:    projDesai._id,
      supervisorId: supervisor._id,
      logDate:      daysAgo(7),
      workPerformed: "Flooring 85% done. Glass partition installation started between workstations. Pantry tile work complete. Reception desk fabrication in progress at workshop.",
      manpowerCount: 20,
      issuesReported: "",
      blockers: "",
      notes: SEED_TAG,
    },
    {
      projectId:    projDesai._id,
      supervisorId: supervisor._id,
      logDate:      daysAgo(2),
      workPerformed: "Glass partitions 100% installed. Furniture delivery scheduled for tomorrow. Touch-up painting and snagging list being prepared.",
      manpowerCount: 14,
      issuesReported: "AV vendor requires 2 more days for projection screen installation.",
      blockers: "AV installation delay — may push handover by 2 days.",
      notes: SEED_TAG,
    },
    {
      projectId:    projDesai._id,
      supervisorId: supervisor._id,
      logDate:      daysAgo(1),
      workPerformed: "Furniture installation 70% complete. Snagging list prepared — 23 items identified. AV system cabling done, screen installation pending.",
      manpowerCount: 16,
      issuesReported: "2 workstation chairs damaged in transit. Replacement ordered.",
      blockers: "",
      notes: SEED_TAG,
    },
  ];

  const insertedLogs = await SiteLog.insertMany(siteLogsData);
  console.log(`   Created ${insertedLogs.length} site logs`);

  // ── 9. Summary ─────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(55));
  console.log("🎉 PMS seed complete! Here's what was created:\n");
  console.log(`   Users (password: ${PASSWORD})`);
  console.log(`   ───────────────────────────────────────────`);
  for (const u of createdUsers) {
    console.log(`   ${u.email.padEnd(30)} role: ${u.role}`);
  }
  console.log(`\n   Projects`);
  console.log(`   ───────────────────────────────────────────`);
  console.log(`   ${projMehta.trackingId}  Mehta Villa (design_phase)`);
  console.log(`   ${projDesai.trackingId}  Desai Office (execution_phase)`);
  console.log(`   ${projSharma.trackingId}  Sharma Residence (design_phase)`);
  console.log(`\n   Other records`);
  console.log(`   ───────────────────────────────────────────`);
  console.log(`   CRM Clients:  ${clientsData.length}`);
  console.log(`   Tasks:        ${insertedTasks.length}`);
  console.log(`   Drawings:     ${insertedDrawings.length}`);
  console.log(`   Vendors:      ${vendorsData.length}`);
  console.log(`   Site Logs:    ${insertedLogs.length}`);
  console.log("─".repeat(55) + "\n");
}

seed()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => {
    mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  });
