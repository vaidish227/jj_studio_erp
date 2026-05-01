const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Template = require("./src/modules/proposal/models/Template.model");

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const generateId = () => Math.random().toString(36).substring(2, 9);

const seedTemplates = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB for seeding...");

    // Clear existing templates for a clean slate
    await Template.deleteMany({});
    console.log("Cleared existing templates.");

    // 1. Plumbing Material
    const pCol1 = generateId();
    const pCol2 = generateId();
    await Template.create({
      name: "Quotation For Plumbing Material",
      type: "residential",
      description: "Standard plumbing material quotation",
      structure: {
        columns: [
          { id: pCol1, label: "DESCRIPTION", type: "text", width: "auto" },
          { id: pCol2, label: "RATE", type: "number", width: "auto" }
        ],
        rows: [
          { id: generateId(), isGroupHeader: false, cells: { [pCol1]: "Fixing PVC pipe including all PVC Fittings B end or Junction offset. Access pipes Socket joint including cutting, chiselling holes etc. Fixing CPVC pipes including CPVC fitting, hot water, line fixing, fancy fitting WC (1 pc) Wash basin (1 pc), Pressure pump (1 pc), concealed cistern/flash value, stop cock, basin mixture, water heater/ geyser connection complete for one toilet inside work.", [pCol2]: 22000 } },
          { id: generateId(), isGroupHeader: false, cells: { [pCol1]: "Fixing PVC pipe including all PVC Fittings B end or Junction offset. Access pipes Socket joint including cutting, chiselling holes etc. Fixing CPVC pipes including CPVC fitting, hot water, line fixing, fancy fitting WC (1 pc) Wash basin (1 pc), Pressure pump (1 pc), concealed cistern/flash value, stop cock, basin mixture, water heater/ geyser connection complete for one Powder toilet inside work.", [pCol2]: 15000 } },
          { id: generateId(), isGroupHeader: false, cells: { [pCol1]: "Kitchen inside 3/4\" dia CPVC pipe, hot and cold line outlet / inlet pipe fixing. Grove cutting, Inside accessary all fitting", [pCol2]: 12000 } }
        ]
      }
    });

    // 2. Civil Work
    const cCol1 = generateId();
    const cCol2 = generateId();
    const cCol3 = generateId();
    await Template.create({
      name: "Quotation for Civil work",
      type: "residential",
      structure: {
        columns: [
          { id: cCol1, label: "DESCRIPTION", type: "text" },
          { id: cCol2, label: "UNIT", type: "text" },
          { id: cCol3, label: "RATE", type: "number" }
        ],
        rows: [
          { id: generateId(), isGroupHeader: false, cells: { [cCol1]: "5\" * 3\" brick wall making", [cCol2]: "Sq,Ft.", [cCol3]: 25 } },
          { id: generateId(), isGroupHeader: false, cells: { [cCol1]: "10\" brick wall making", [cCol2]: "Sq,Ft.", [cCol3]: 28 } },
          { id: generateId(), isGroupHeader: false, cells: { [cCol1]: "Wall with 2' * 1' bricks", [cCol2]: "Sq,Ft.", [cCol3]: 28 } },
          { id: generateId(), isGroupHeader: false, cells: { [cCol1]: "Wall Plaster", [cCol2]: "Sq,Ft.", [cCol3]: 20 } },
          { id: generateId(), isGroupHeader: false, cells: { [cCol1]: "Lintell", [cCol2]: "Sq,Ft.", [cCol3]: 300 } },
          { id: generateId(), isGroupHeader: false, cells: { [cCol1]: "Door frame fixing", [cCol2]: "Sq,Ft.", [cCol3]: 1000 } },
          { id: generateId(), isGroupHeader: false, cells: { [cCol1]: "Floor demolition", [cCol2]: "Sq,Ft.", [cCol3]: 22 } },
          { id: generateId(), isGroupHeader: false, cells: { [cCol1]: "Wall tiles demolition", [cCol2]: "Sq,Ft.", [cCol3]: 22 } },
          { id: generateId(), isGroupHeader: false, cells: { [cCol1]: "Plaster demolition", [cCol2]: "Sq.Ft", [cCol3]: 20 } },
          { id: generateId(), isGroupHeader: false, cells: { [cCol1]: "Wall breaking", [cCol2]: "Sq.Ft", [cCol3]: 20 } },
        ]
      }
    });

    // 3. Marble Work (with Group Headers)
    const mCol1 = generateId();
    const mCol2 = generateId();
    await Template.create({
      name: "Quotation for Marble Work",
      type: "residential",
      structure: {
        columns: [
          { id: mCol1, label: "DESCRIPTION", type: "text" },
          { id: mCol2, label: "RATE (Rs)", type: "text" }
        ],
        rows: [
          { id: generateId(), isGroupHeader: true, cells: { [mCol1]: "Italian Work" } },
          { id: generateId(), isGroupHeader: false, cells: { [mCol1]: "Italian Marble Floor And Mirror Polish", [mCol2]: "140.00 per sft" } },
          { id: generateId(), isGroupHeader: false, cells: { [mCol1]: "Above 2\" Underbacking Materials Extra Charges", [mCol2]: "20.00 per sft" } },
          { id: generateId(), isGroupHeader: false, cells: { [mCol1]: "Italian Marble Skirting", [mCol2]: "120.00 per rft" } },
          
          { id: generateId(), isGroupHeader: true, cells: { [mCol1]: "Granite Work" } },
          { id: generateId(), isGroupHeader: false, cells: { [mCol1]: "Granite Flooring", [mCol2]: "90.00 per sft" } },
          { id: generateId(), isGroupHeader: false, cells: { [mCol1]: "Granite Skirting", [mCol2]: "70.00 per rft" } },
          
          { id: generateId(), isGroupHeader: true, cells: { [mCol1]: "Tiles work" } },
          { id: generateId(), isGroupHeader: false, cells: { [mCol1]: "Tiles flooring(2'*2')", [mCol2]: "40 per sft" } },
          { id: generateId(), isGroupHeader: false, cells: { [mCol1]: "Tiles flooring work (2'*4')", [mCol2]: "55 per sft" } }
        ]
      }
    });

    // 4. False Ceiling
    const fCol1 = generateId();
    const fCol2 = generateId();
    const fCol3 = generateId();
    await Template.create({
      name: "Quotation for False Ceiling",
      type: "residential",
      structure: {
        columns: [
          { id: fCol1, label: "DESCRIPTION", type: "text" },
          { id: fCol2, label: "Unit", type: "text" },
          { id: fCol3, label: "Rate", type: "number" }
        ],
        rows: [
          { id: generateId(), isGroupHeader: false, cells: { [fCol1]: "Plain Ceiling", [fCol2]: "Sq.Ft", [fCol3]: 95 } },
          { id: generateId(), isGroupHeader: false, cells: { [fCol1]: "Drop Ceiling", [fCol2]: "Sq.Ft", [fCol3]: 95 } },
          { id: generateId(), isGroupHeader: false, cells: { [fCol1]: "Vertical Ceiling", [fCol2]: "Sq.Ft", [fCol3]: 95 } },
          { id: generateId(), isGroupHeader: false, cells: { [fCol1]: "Patta Paris", [fCol2]: "Sq.Ft", [fCol3]: 50 } },
          { id: generateId(), isGroupHeader: false, cells: { [fCol1]: "Light Cutting", [fCol2]: "Per Piece", [fCol3]: 70 } },
        ]
      }
    });

    // 5. Electric Work
    const eCol1 = generateId();
    const eCol2 = generateId();
    const eCol3 = generateId();
    await Template.create({
      name: "Quotation for Electric Work",
      type: "residential",
      structure: {
        columns: [
          { id: eCol1, label: "DESCRIPTION", type: "text" },
          { id: eCol2, label: "Unit", type: "text" },
          { id: eCol3, label: "Rate", type: "number" }
        ],
        rows: [
          { id: generateId(), isGroupHeader: false, cells: { [eCol1]: "Inside electrical work for DB box. DB to switch board main line, AC main line, switch box fitting, Switch fitting, total Light points, fitting total plug points, AC, Gysers, CCTV, music system wiring and telephone Internet etc.", [eCol2]: "Sq,Ft.", [eCol3]: 80 } },
          { id: generateId(), isGroupHeader: false, cells: { [eCol1]: "Automation: only labour charges, basic for internal electrician circuit, condit design with 1. 1 KV grade PVC insulated FR grade wire and PVC conduct laying for automation line wiring RNA Cable applicable for automation area.", [eCol2]: "Sq,Ft.", [eCol3]: 20 } },
          { id: generateId(), isGroupHeader: false, cells: { [eCol1]: "Automation: CCTV Net working, TATA SKY and WIFY only labour charges for internal concel area CCTV office area WIFY Net Working, Telephone TATA SKY CAT - 6 optical Jio Fibre wire complete as per specification", [eCol2]: "Sq,Ft.", [eCol3]: 10 } },
          { id: generateId(), isGroupHeader: false, cells: { [eCol1]: "Z Profile light fitting", [eCol2]: "Mtr", [eCol3]: 175 } },
          { id: generateId(), isGroupHeader: false, cells: { [eCol1]: "Magnetic Track light fitting", [eCol2]: "Mtr", [eCol3]: 450 } },
        ]
      }
    });

    console.log("All 5 templates successfully seeded!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
};

seedTemplates();
