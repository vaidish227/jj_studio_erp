/**
 * Seed default quotation templates: Carpentry, Electrical, False Ceiling,
 * Marble/Stone, Plumbing, Civil.
 * Run once: node backend/src/scripts/seedQuotationTemplates.js
 * Safe to re-run — uses upsert by name.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const Template = require("../modules/proposal/models/Template.model");

// ---------------------------------------------------------------------------
// Column factory helpers
// ---------------------------------------------------------------------------
const col = (id, label, type = "text", width = "auto") => ({ id, label, type, width });

const STANDARD_COLS = {
  slno:  col("c_slno",  "Sl.No",       "label",  "60px"),
  desc:  col("c_desc",  "Description", "text",   "40%"),
  qty:   col("c_qty",   "Qty",         "number", "80px"),
  unit:  col("c_unit",  "Unit",        "text",   "100px"),
  rate:  col("c_rate",  "Rate (₹)",    "number", "110px"),
  amt:   col("c_amt",   "Amount (₹)",  "number", "120px"),
};

// ---------------------------------------------------------------------------
// Row factory helpers
// ---------------------------------------------------------------------------
let _rowSeq = 0;
const resetSeq = () => { _rowSeq = 0; };

const groupHeader = (label) => ({
  id: `r_gh_${++_rowSeq}`,
  isGroupHeader: true,
  cells: { c_desc: label },
});

const row = (desc, qty, unit, rate) => ({
  id: `r_${++_rowSeq}`,
  isGroupHeader: false,
  cells: {
    c_desc: desc,
    c_qty:  qty,
    c_unit: unit,
    c_rate: rate,
    c_amt:  0,
  },
});

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

// 1. CARPENTRY
resetSeq();
const carpentryTemplate = {
  name: "Carpentry Work",
  type: "residential",
  description: "Labour charge quotation for all carpentry and woodwork items.",
  structure: {
    columns: [
      STANDARD_COLS.slno,
      col("c_desc", "Particulars", "text", "45%"),
      STANDARD_COLS.qty,
      STANDARD_COLS.unit,
      STANDARD_COLS.rate,
      STANDARD_COLS.amt,
    ],
    rows: [
      row("Making and fixing of Wall Panelling — Commercial Finish",                              0, "SQFT",     175),
      row("Making and fixing of Wall Panelling — Veneer / Laminate / MDF Finish",                0, "SQFT/RFT", 280),
      row("Making and fixing of Mirror Wall Panelling Finish",                                   0, "SQFT/RFT", 325),
      row("Making and fixing of Wardrobe — Outside Veneer/Laminate/MDF Finish (incl. 2 Drawers)",0, "SQFT",     550),
      row("Making and fixing of Wardrobe — Inside Drawer",                                       0, "NOS",     1550),
      row("Making and fixing of Wardrobe & Cabinet — Inside Laminate",                           0, "SQFT",      40),
      row("Making and fixing of Wooden & Glass Partition — Veneer/Laminate/MDF Finish",          0, "SQFT",     350),
      row("Making and fixing of Wooden Ceiling — Veneer/Laminate/MDF Finish",                   0, "SQFT",     375),
      row("Making and fixing of Round Wooden Glass Partition — Veneer/Laminate/MDF Finish",     0, "SQFT",     475),
      row("Making and fixing of Wall Panelling / Wooden Partition / Wooden Ceiling — Extra Panel (6mm/12mm/19mm)", 0, "SQFT/RFT", 175),
      row("Making and fixing of Bed — Inside Laminate, Outside Veneer/Laminate/MDF Finish",      0, "JOB",    25500),
      row("Making and fixing of Bed Side Table — Veneer/Laminate/MDF Finish",                   0, "JOB",     8500),
      row("Making and fixing of Bed Head Board Panelling with Template",                         0, "SQFT",     325),
      row("Making and fixing of Wooden Door — Veneer/Laminate Finish",                           0, "JOB",    11500),
      row("Making and fixing of Door Frame Fixing",                                              0, "JOB",     3500),
      row("Making and fixing of Door Frame Panelling — Veneer/Laminate Finish",                  0, "JOB",     6000),
      row("Making and fixing of TV Unit — Veneer/Laminate/MDF Finish",                           1, "LUMP SUM",    0),
      row("Making and fixing of Basin Counter — Veneer/Laminate/MDF Finish",                    0, "JOB",    11500),
      row("Making and fixing of NIC Box — Veneer/Laminate/MDF Finish",                          1, "LUMP SUM",    0),
      row("Making and fixing of Crockery Cabinet — Veneer/Laminate/MDF Finish",                 1, "LUMP SUM", 22500),
      row("Making and fixing of Kitchen Counter Cabinet — Veneer/Laminate/MDF Finish",          0, "SQFT",     675),
      row("Making and fixing of Kitchen Overhead Cabinet — Veneer/Laminate/MDF Finish",         0, "SQFT",     525),
      row("Making and fixing of Multi Cabinet — Veneer/Laminate/MDF Finish",                    1, "LUMP SUM", 20500),
      row("Making and fixing of Profile Light Cutting",                                          0, "RFT",      175),
      row("Making and fixing of PVD Brass Profile Pasting",                                     0, "RFT",      225),
      row("Making and fixing of Dressing Table — Veneer/Laminate Finish",                       1, "LUMP SUM",    0),
      row("Making and fixing of Study Table — Veneer/Laminate Finish",                          1, "LUMP SUM",    0),
    ],
  },
};

// 2. ELECTRICAL
resetSeq();
const electricalTemplate = {
  name: "Electrical Work",
  type: "residential",
  description: "Labour charge quotation for all electrical, automation, and light-fitting work.",
  structure: {
    columns: [
      STANDARD_COLS.slno,
      col("c_desc", "Description", "text", "50%"),
      STANDARD_COLS.unit,
      STANDARD_COLS.qty,
      STANDARD_COLS.rate,
      STANDARD_COLS.amt,
    ],
    rows: [
      row(
        "Inside Electrical Work — DB Box to Switch Board Main Line, AC Main Line, Switch Box Fitting, Switch Fitting, Light Points, Plug Points, AC, Geysers, CCTV, Music System Wiring, Telephone & Internet etc.",
        0, "Sq.Ft", 80
      ),
      row(
        "Automation — Labour Charges Only: Internal Electrician Circuit, Conduit Design with 1.1 KV Grade PVC Insulated FR Grade Wire and PVC Conduit Laying for Automation Line Wiring (RNA Cable)",
        0, "Sq.Ft", 20
      ),
      row(
        "Automation — CCTV Networking, TATA SKY & WiFi: Labour Charges for Internal Concealed Area CCTV, Office Area WiFi Networking, Telephone, TATA SKY, CAT-6, Optical Jio Fibre Wire (complete as per spec.)",
        0, "Sq.Ft", 10
      ),
      row("Z Profile Light Fitting",      0, "Mtr", 175),
      row("Magnetic Track Light Fitting", 0, "Mtr", 450),
    ],
  },
};

// 3. FALSE CEILING
resetSeq();
const falseCeilingTemplate = {
  name: "False Ceiling Work",
  type: "residential",
  description: "Labour charge quotation for all false ceiling and gypsum work.",
  structure: {
    columns: [
      STANDARD_COLS.slno,
      col("c_desc", "Description", "text", "40%"),
      STANDARD_COLS.unit,
      STANDARD_COLS.qty,
      STANDARD_COLS.rate,
      STANDARD_COLS.amt,
    ],
    rows: [
      row("Plain Ceiling",       0, "Sq.Ft",       95),
      row("Drop Ceiling",        0, "Sq.Ft",       95),
      row("Vertical Ceiling",    0, "Sq.Ft",       95),
      row("Vertical Cach",       0, "Sq.Ft",       95),
      row("Drop Ceiling Dhar",   0, "Sq.Ft",       95),
      row("Traylight Patta",     0, "Sq.Ft",       95),
      row("Traylight Dhar",      0, "Sq.Ft",       95),
      row("Groove Ceiling",      0, "Sq.Ft",       95),
      row("Patta Paris",         0, "Sq.Ft",       50),
      row("Skirting Groove",     0, "Sq.Ft",       50),
      row("Patti Paris",         0, "Sq.Ft / RFT", 40),
      row("Light Cutting",       0, "Per Piece",   70),
      row("Wall Design",         1, "As per Design", 0),
    ],
  },
};

// 4. MARBLE / STONE / TILES WORK
resetSeq();
const marbleTemplate = {
  name: "Marble, Granite & Tiles Work",
  type: "residential",
  description: "Labour charge quotation for marble, granite, tiles, and related stone work.",
  structure: {
    columns: [
      STANDARD_COLS.slno,
      col("c_desc", "Description", "text", "45%"),
      STANDARD_COLS.unit,
      STANDARD_COLS.qty,
      STANDARD_COLS.rate,
      STANDARD_COLS.amt,
    ],
    rows: [
      // --- Italian Work ---
      groupHeader("Italian Work"),
      row("Italian Marble Floor and Mirror Polish",             0, "Sq.Ft", 140),
      row("Above 2\" Underbacking Materials — Extra Charges",   0, "Sq.Ft",  20),
      row("Italian Marble Skirting",                           0, "RFT",   120),
      row("Italian Marble Wall Cladding",                      0, "Sq.Ft", 250),
      row("Italian Marble 'V' Groove",                         0, "RFT",    80),
      row("Italian Marble 'C' Groove",                         0, "RFT",    80),
      row("Italian Marble Wall Patti",                         0, "RFT",   190),
      row("Italian Marble Single Pc Full Moulding",            0, "RFT",    80),
      row("Italian Marble Double Pc Gulla Moulding",           0, "RFT",   160),
      row("Italian Marble Edge Polish",                        0, "RFT",    70),
      row("Italian Marble Chamfer Moulding",                   0, "RFT",    80),
      row("Italian Marble Katri Moulding",                     0, "RFT",   110),
      row("Italian Marble Resin Applying in Floor — 3 Coats",  0, "Sq.Ft",  30),
      row("Italian Marble Floor Covering",                     0, "Sq.Ft",  10),

      // --- Granite Work ---
      groupHeader("Granite Work"),
      row("Granite Flooring",                    0, "Sq.Ft",  90),
      row("Granite Skirting",                    0, "RFT",    70),
      row("Granite Wall Cladding",               0, "Sq.Ft", 140),
      row("Granite Wall Patti",                  0, "RFT",   110),
      row("Granite 'V' Groove",                  0, "RFT",    80),
      row("Granite 'C' Groove",                  0, "RFT",    80),
      row("Granite Single Pc Full Moulding",     0, "RFT",    90),
      row("Granite Double Pc Gulla Moulding",    0, "RFT",   170),
      row("Granite Edge Polish",                 0, "RFT",    70),
      row("Granite Chamfer Moulding",            0, "RFT",    80),

      // --- Tiles Work ---
      groupHeader("Tiles Work"),
      row("Tiles Flooring (2' × 2')",               0, "Sq.Ft",  40),
      row("Tiles Flooring (2' × 4')",               0, "Sq.Ft",  55),
      row("Tiles Flooring (2'6\" × 5')",            0, "Sq.Ft",  65),
      row("Tiles Flooring (4' × 8')",               0, "RFT",    80),
      row("Tiles Wall Cladding (2' × 2')",          0, "Sq.Ft",  40),
      row("Tiles Wall Cladding (2' × 4')",          0, "Sq.Ft",  70),
      row("Tiles Wall Cladding (2'6\" × 5')",       0, "RFT",    80),
      row("Tiles Wall Cladding (4' × 8')",          0, "RFT",   120),

      // --- Miscellaneous ---
      groupHeader("Miscellaneous / Special Work"),
      row("Bathroom Work",                                              1, "Lump Sum",  0),
      row("Kitchen Work As per Design",                                 1, "Lump Sum",  0),
      row("Mandir As per Design",                                       1, "Lump Sum",  0),
      row("Inlay Work As per Design",                                   1, "Lump Sum",  0),
      row("Floor Chipping (Santarash Work)",                           0, "Sq.Ft",     9),
      row("Brick Cutting for Skirting",                                0, "RFT",      12),
      row("Lifting Charges (Sand, Cement, Marble — per sft/per floor)",0, "Sq.Ft",     6),
    ],
  },
};

// 5. PLUMBING
resetSeq();
const plumbingTemplate = {
  name: "Plumbing Work",
  type: "residential",
  description: "Labour charge quotation for plumbing and sanitary fitting work.",
  structure: {
    columns: [
      STANDARD_COLS.slno,
      col("c_desc", "Description", "text", "55%"),
      STANDARD_COLS.qty,
      col("c_unit", "Unit", "text", "100px"),
      STANDARD_COLS.rate,
      STANDARD_COLS.amt,
    ],
    rows: [
      row(
        "Full Toilet Plumbing — Fixing PVC/CPVC Pipes with all Fittings, B-end/Junction Offset, Socket Joints, Cutting & Chiselling, Hot Water Line, Fancy Fittings — WC (1 pc), Wash Basin (1 pc), Pressure Pump (1 pc), Concealed Cistern/Flash Valve, Stop Cock, Basin Mixture, Water Heater/Geyser Connection (complete)",
        1, "Per Toilet", 22000
      ),
      row(
        "Powder Toilet Plumbing — Same scope as above for Powder Room (WC + Wash Basin only, no Geyser)",
        1, "Per Toilet", 15000
      ),
      row(
        "Kitchen Plumbing — 3/4\" Dia CPVC Pipe, Hot & Cold Line Outlet/Inlet Pipe Fixing, Grove Cutting, Inside Accessory All Fitting",
        1, "Lump Sum", 12000
      ),
    ],
  },
};

// 6. CIVIL WORK
resetSeq();
const civilTemplate = {
  name: "Civil Work",
  type: "residential",
  description: "Labour charge quotation for civil construction, demolition, and finishing work.",
  structure: {
    columns: [
      STANDARD_COLS.slno,
      col("c_desc", "Description", "text", "45%"),
      STANDARD_COLS.unit,
      STANDARD_COLS.qty,
      STANDARD_COLS.rate,
      STANDARD_COLS.amt,
    ],
    rows: [
      // --- Brick / Masonry ---
      groupHeader("Brick & Masonry Work"),
      row("5\" × 3\" Brick Wall Making",  0, "Sq.Ft",  25),
      row("10\" Brick Wall Making",       0, "Sq.Ft",  28),
      row("Wall with 2' × 1' Bricks",    0, "Sq.Ft",  28),
      row("Wall Plaster",                0, "Sq.Ft",  20),
      row("Lintel",                      0, "Sq.Ft", 300),
      row("Door Frame Fixing",           0, "Sq.Ft", 1000),

      // --- Demolition & Chipping ---
      groupHeader("Demolition & Chipping"),
      row("Floor Demolition",      0, "Sq.Ft", 22),
      row("Wall Tiles Demolition", 0, "Sq.Ft", 22),
      row("Plaster Demolition",    0, "Sq.Ft", 20),
      row("Wall Breaking",         0, "Sq.Ft", 20),
      row("POP Chipping",          0, "Sq.Ft", 19),
      row("Deep Chipping",         0, "Sq.Ft", 15),
      row("Floor Jhar Chipping",   0, "Sq.Ft", 15),
      row("Rubbish Cleaning",      1, "Extra",   0),

      // --- Daily Labour ---
      groupHeader("Daily Labour Charges"),
      row("Raj Mistri (Daily Labour)", 0, "Day", 700),
      row("Labour (Daily)",            0, "Day", 600),
      row("Santras (Daily)",           0, "Day", 700),
    ],
  },
};

// ---------------------------------------------------------------------------
// Seed runner
// ---------------------------------------------------------------------------
const TEMPLATES = [
  carpentryTemplate,
  electricalTemplate,
  falseCeilingTemplate,
  marbleTemplate,
  plumbingTemplate,
  civilTemplate,
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    let created = 0;
    let updated = 0;

    for (const tpl of TEMPLATES) {
      const existing = await Template.findOne({ name: tpl.name });
      if (existing) {
        await Template.findByIdAndUpdate(existing._id, { $set: tpl });
        console.log(`  Updated : ${tpl.name}`);
        updated++;
      } else {
        await Template.create(tpl);
        console.log(`  Created : ${tpl.name}`);
        created++;
      }
    }

    console.log(`\nSeed complete. ${created} created, ${updated} updated.`);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
