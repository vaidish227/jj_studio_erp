/**
 * Planner Excel Import / Export
 * --------------------------------------------------------------
 * Export → builds a single-sheet XLSX of the project's master sheet rows
 *          with formatted headers, frozen top row, and auto-sized columns.
 *          The first column is `taskId` so the same file can be re-imported
 *          for safe row matching.
 *
 * Import → reads an uploaded XLSX, matches each row to an existing Task by
 *          `taskId`, validates the editable cells, then bulk-updates. Only
 *          a safe subset of fields is touched (title, dates, hours, progress,
 *          priority, notes, zone, floor, status). Reassignment is NOT done
 *          via import — names → User matching is error-prone, do it in UI.
 *          Rows without a matching taskId are skipped (logged) rather than
 *          created — keeps the round-trip safe.
 */
const ExcelJS = require("exceljs");
const mongoose = require("mongoose");

const Task        = require("../models/Task.model");
const Project     = require("../models/Project.model");
const ProjectPlan = require("../models/ProjectPlan.model");
const PlannerImportLog = require("../models/PlannerImportLog.model");
const { logActivity } = require("../../../shared/activityLogger");

const TASK_STATUSES = new Set([
  "not_started", "blocked", "in_progress",
  "pending_review", "revision_requested",
  "pending_client_approval",
  "approved", "released_to_site", "completed", "on_hold",
]);
const PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
// Master Sheet "Work Status" column — keep in sync with Task.model.js workStatus enum
const WORK_STATUSES = new Set(["pending", "in_progress", "completed", "on_hold", "cancelled"]);

const isOid = (v) => mongoose.Types.ObjectId.isValid(String(v || ""));

// Column definitions — single source of truth for both writer and reader.
// `key` matches the lean Task field path; `header` is the Excel column name.
const COLUMNS = [
  { key: "taskId",            header: "Task ID",         width: 26, editable: false },
  { key: "phase",             header: "Phase",           width: 16, editable: false },
  { key: "title",             header: "Drawing Name",    width: 36, editable: true  },
  { key: "taskType",          header: "Task Type",       width: 20, editable: false },
  { key: "status",            header: "Status",          width: 18, editable: true  },
  { key: "workStatus",        header: "Work Status",     width: 14, editable: true  },
  { key: "priority",          header: "Priority",        width: 12, editable: true  },
  { key: "zoneName",          header: "Zone",            width: 14, editable: true  },
  { key: "floor",             header: "Floor",           width: 10, editable: true  },
  { key: "assignedToName",    header: "Designer",        width: 22, editable: false },
  { key: "plannedStartDate",  header: "Planned Start",   width: 14, editable: true, isDate: true },
  { key: "plannedEndDate",    header: "Deadline",        width: 14, editable: true, isDate: true },
  { key: "plannedHours",      header: "Planned Hrs",     width: 12, editable: true, isNumber: true },
  { key: "actualHours",       header: "Actual Hrs",      width: 12, editable: true, isNumber: true },
  { key: "progressPercent",   header: "Progress %",      width: 12, editable: true, isNumber: true },
  { key: "notes",             header: "Notes",           width: 40, editable: true  },
];

const EDITABLE_KEYS = COLUMNS.filter((c) => c.editable).map((c) => c.key);

function getColumnByHeader(header) {
  const norm = String(header || "").trim().toLowerCase();
  return COLUMNS.find((c) => c.header.toLowerCase() === norm);
}

function coerce(value, col) {
  if (value === null || value === undefined || value === "") return null;
  if (col.isDate) {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) throw new Error(`Invalid date for ${col.header}`);
    return d;
  }
  if (col.isNumber) {
    const n = Number(value);
    if (Number.isNaN(n)) throw new Error(`Invalid number for ${col.header}`);
    return n;
  }
  return String(value).trim();
}

/**
 * GET /api/pms/planner/:projectId/export
 * Streams an XLSX of every task on the project.
 */
exports.exportMasterSheet = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!isOid(projectId)) return res.status(400).json({ message: "Invalid projectId" });

    const project = await Project.findById(projectId)
      .select("name trackingId startDate estimatedCompletionDate")
      .lean();
    if (!project) return res.status(404).json({ message: "Project not found" });

    const tasks = await Task.find({ projectId })
      .populate({ path: "assignedTo", select: "name" })
      .sort({ "planning.plannedStartDate": 1, createdAt: 1 })
      .lean();

    const wb = new ExcelJS.Workbook();
    wb.creator = "JJ Studio ERP";
    wb.created = new Date();
    const ws = wb.addWorksheet("Master Sheet", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    // Header row
    ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A2E" } };
    ws.getRow(1).alignment = { vertical: "middle", horizontal: "left" };
    ws.getRow(1).height = 22;

    // Body rows
    for (const t of tasks) {
      ws.addRow({
        taskId:            String(t._id),
        phase:             t.phase || "",
        title:             t.title || "",
        taskType:          t.taskType || "",
        status:            t.status || "",
        workStatus:        t.workStatus || "pending",
        priority:          t.priority || "",
        zoneName:          t.planning?.zoneName || "",
        floor:             t.planning?.floor || "",
        assignedToName:    t.assignedTo?.name || "",
        plannedStartDate:  t.planning?.plannedStartDate || null,
        plannedEndDate:    t.planning?.plannedEndDate || null,
        plannedHours:      t.planning?.plannedHours ?? 0,
        actualHours:       t.planning?.actualHours ?? 0,
        progressPercent:   t.planning?.progressPercent ?? 0,
        notes:             t.notes || "",
      });
    }

    // Format date columns
    const dateColLetters = COLUMNS
      .map((c, idx) => (c.isDate ? String.fromCharCode(65 + idx) : null))
      .filter(Boolean);
    for (const letter of dateColLetters) {
      ws.getColumn(letter).numFmt = "dd-mmm-yyyy";
    }

    // Read-only columns get a subtle grey tint so users know not to edit them
    const readOnlyIdxs = COLUMNS.map((c, idx) => (!c.editable ? idx + 1 : null)).filter(Boolean);
    for (const idx of readOnlyIdxs) {
      ws.getColumn(idx).eachCell({ includeEmpty: false }, (cell, rowNumber) => {
        if (rowNumber === 1) return;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
      });
    }

    await logActivity({
      projectId,
      actorId: req.user?._id,
      entityType: "project",
      entityId: projectId,
      action: "planner.exported",
      description: `Master sheet exported (${tasks.length} rows)`,
      metadata: { rowCount: tasks.length },
    });

    const filename = `master-sheet_${project.trackingId || project._id}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("[PlannerExcel.exportMasterSheet]", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to export master sheet" });
    }
  }
};

// Human-readable help strings shown on the Instructions sheet of the template.
// Keep tone short — these render as a single description column per row.
const COLUMN_HELP = {
  taskId:           "REQUIRED. The unique ID of an existing task. Use Export first to obtain valid IDs. Rows without a Task ID will be skipped.",
  phase:            "Read-only. Set at project initiation and cannot be changed via import.",
  title:            "Editable. Short name shown in the master sheet. Cannot be empty.",
  taskType:         "Read-only. Task type is fixed once the row is created.",
  status:           "Editable. One of: not_started, blocked, in_progress, pending_review, revision_requested, pending_client_approval, approved, released_to_site, completed, on_hold.",
  workStatus:       "Editable. Manual tracking status. One of: pending, in_progress, completed, on_hold, cancelled.",
  priority:         "Editable. One of: low, medium, high, urgent.",
  zoneName:         "Editable. Free-text zone label (e.g. Living Room, Master Bath).",
  floor:            "Editable. Free-text floor label (e.g. G, 1, 2).",
  assignedToName:   "Read-only via import. Use the Designer cell in the planner UI to (re)assign — name matching here is too error-prone.",
  plannedStartDate: "Editable. Date format dd-mmm-yyyy preferred (Excel will format it automatically).",
  plannedEndDate:   "Editable. Must be on/after Planned Start.",
  plannedHours:     "Editable. Whole or decimal hours (e.g. 4, 8.5). Must be ≥ 0.",
  actualHours:      "Editable. Whole or decimal hours. Must be ≥ 0.",
  progressPercent:  "Editable. Whole number 0–100.",
  notes:            "Editable. Free-text. Visible to anyone with planner access.",
};

/**
 * GET /api/pms/planner/import-template
 * Returns a blank XLSX with the same column structure as Export, plus one
 * sample row tinted yellow ("Example — delete before importing"), and a
 * second "Instructions" sheet that lists each column with its rules.
 *
 * Not project-scoped — same template for every project, so any user with
 * planner.read can pull it.
 */
exports.getImportTemplate = async (req, res) => {
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = "JJ Studio ERP";
    wb.created = new Date();

    // ─── Sheet 1: Template ──────────────────────────────────────────────────
    const ws = wb.addWorksheet("Template", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));

    // Header band
    ws.getRow(1).font      = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A2E" } };
    ws.getRow(1).alignment = { vertical: "middle", horizontal: "left" };
    ws.getRow(1).height    = 22;

    // One example row demoing each editable field. Read-only columns get a
    // visible "—" placeholder so the user knows what they are.
    ws.addRow({
      taskId:            "PASTE-EXISTING-ID-HERE",
      phase:             "design",
      title:             "Living Room — Furniture Layout v2",
      taskType:          "furniture_layout",
      status:            "in_progress",
      workStatus:        "in_progress",
      priority:          "high",
      zoneName:          "Living Room",
      floor:             "G",
      assignedToName:    "(read-only — use UI to change)",
      plannedStartDate:  new Date(),
      plannedEndDate:    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      plannedHours:      12,
      actualHours:       4,
      progressPercent:   30,
      notes:             "Example row — delete me before uploading.",
    });

    // Tint the sample row yellow + italic so it visually screams "example"
    const sampleRow = ws.getRow(2);
    sampleRow.eachCell({ includeEmpty: false }, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7CC" } };
      cell.font = { italic: true, color: { argb: "FF7A5C00" } };
    });

    // Format dates
    COLUMNS.forEach((c, idx) => {
      if (c.isDate) ws.getColumn(idx + 1).numFmt = "dd-mmm-yyyy";
    });

    // Tint read-only column cells grey (just the example row — header keeps dark band)
    COLUMNS.forEach((c, idx) => {
      if (!c.editable) {
        const cell = sampleRow.getCell(idx + 1);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } };
      }
    });

    // ─── Sheet 2: Instructions ──────────────────────────────────────────────
    const help = wb.addWorksheet("Instructions");
    help.columns = [
      { header: "Column",       key: "col",     width: 22 },
      { header: "Editable?",    key: "editable", width: 12 },
      { header: "What it means", key: "help",   width: 100 },
    ];
    help.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    help.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A2E" } };
    help.getRow(1).height = 22;

    for (const c of COLUMNS) {
      help.addRow({
        col:      c.header,
        editable: c.editable ? "Yes" : "No",
        help:     COLUMN_HELP[c.key] || "",
      });
    }
    help.getColumn("help").alignment = { wrapText: true, vertical: "top" };

    // Workflow note at the bottom
    help.addRow({});
    const noteHeader = help.addRow({ col: "Workflow", editable: "", help: "" });
    noteHeader.font = { bold: true };
    help.addRow({
      col:  "1.",
      help: "Click Export in the planner header to download every existing row with its Task ID.",
    });
    help.addRow({
      col:  "2.",
      help: "Open the exported file in Excel/Google Sheets and edit ONLY the editable columns.",
    });
    help.addRow({
      col:  "3.",
      help: "Save as .xlsx and upload via Import → Preview → Confirm.",
    });
    help.addRow({
      col:  "4.",
      help: "This blank template is for reference only — it can't be uploaded directly because the Task ID column is blank.",
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="master-sheet_import-template.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("[PlannerExcel.getImportTemplate]", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to build template" });
    }
  }
};

/**
 * Parse an uploaded buffer into an array of { rowNum, data } objects.
 * `data` is keyed by COLUMN.key. Stops at the first all-empty row.
 */
async function parseWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Workbook has no sheets");

  // Map header columns by name → column letter index
  const headerRow = ws.getRow(1);
  const colByIdx = new Map(); // idx (1-based) → COLUMN def
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const def = getColumnByHeader(cell.value);
    if (def) colByIdx.set(colNumber, def);
  });

  if (!colByIdx.size) throw new Error("No recognised columns found in the first row");
  if (![...colByIdx.values()].some((c) => c.key === "taskId")) {
    throw new Error("'Task ID' column is required — export the sheet first to get IDs");
  }

  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const data = {};
    let allEmpty = true;
    for (const [colIdx, def] of colByIdx.entries()) {
      const raw = row.getCell(colIdx).value;
      if (raw !== null && raw !== undefined && raw !== "") allEmpty = false;
      data[def.key] = raw;
    }
    if (!allEmpty) rows.push({ rowNum: rowNumber, data });
  });
  return rows;
}

/**
 * Validate one row + return a Mongo $set payload, or { error } on failure.
 * Only editable columns are written; unknown columns are silently ignored.
 */
function buildUpdate(data) {
  const set = {};
  for (const key of EDITABLE_KEYS) {
    if (!(key in data)) continue;
    const col = COLUMNS.find((c) => c.key === key);
    let v;
    try { v = coerce(data[key], col); }
    catch (e) { return { error: e.message }; }

    if (v === null && (col.isDate || col.isNumber)) continue; // skip empties for dates/numbers
    if (v === null) v = ""; // strings can be cleared

    if (key === "status") {
      const s = String(v).toLowerCase();
      if (!TASK_STATUSES.has(s)) return { error: `Invalid status "${v}"` };
      set.status = s;
    } else if (key === "workStatus") {
      // Tolerate the display label form too ("In Progress" → "in_progress")
      const w = String(v).toLowerCase().trim().replace(/\s+/g, "_");
      if (!WORK_STATUSES.has(w)) return { error: `Invalid work status "${v}"` };
      set.workStatus = w;
    } else if (key === "priority") {
      const p = String(v).toLowerCase();
      if (!PRIORITIES.has(p)) return { error: `Invalid priority "${v}"` };
      set.priority = p;
    } else if (key === "title") {
      if (!String(v).trim()) return { error: "Title cannot be empty" };
      set.title = String(v).trim();
    } else if (key === "notes") {
      set.notes = String(v);
    } else if (key === "zoneName") {
      set["planning.zoneName"] = String(v);
    } else if (key === "floor") {
      set["planning.floor"] = String(v);
    } else if (key === "plannedStartDate") {
      set["planning.plannedStartDate"] = v;
    } else if (key === "plannedEndDate") {
      set["planning.plannedEndDate"] = v;
    } else if (key === "plannedHours") {
      if (v < 0) return { error: "Planned Hrs cannot be negative" };
      set["planning.plannedHours"] = v;
    } else if (key === "actualHours") {
      if (v < 0) return { error: "Actual Hrs cannot be negative" };
      set["planning.actualHours"] = v;
    } else if (key === "progressPercent") {
      if (v < 0 || v > 100) return { error: "Progress % must be 0–100" };
      set["planning.progressPercent"] = v;
    }
  }

  // Task.bulkWrite bypasses model middleware — mirror the status→workStatus
  // auto-sync here. An explicit Work Status cell in the same row still wins.
  if (set.status && !Object.prototype.hasOwnProperty.call(set, "workStatus")) {
    const ws = Task.WORK_STATUS_FROM_STATUS[set.status];
    if (ws) set.workStatus = ws;
  }

  // Cross-field check
  if (set["planning.plannedStartDate"] && set["planning.plannedEndDate"]
      && set["planning.plannedEndDate"] < set["planning.plannedStartDate"]) {
    return { error: "Deadline cannot be before Planned Start" };
  }

  return { set };
}

/**
 * POST /api/pms/planner/:projectId/import
 * Form-data: file (XLSX), dryRun (truthy → no DB writes; preview only)
 */
exports.importMasterSheet = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!isOid(projectId)) return res.status(400).json({ message: "Invalid projectId" });
    if (!req.file?.buffer) return res.status(400).json({ message: "No file uploaded" });

    const dryRun = String(req.body?.dryRun || req.query?.dryRun || "").toLowerCase() === "true";

    const project = await Project.findById(projectId).select("_id").lean();
    if (!project) return res.status(404).json({ message: "Project not found" });

    let rows;
    try { rows = await parseWorkbook(req.file.buffer); }
    catch (e) { return res.status(400).json({ message: e.message }); }

    // Bulk-fetch all tasks referenced — one query, not N
    const taskIds = [...new Set(
      rows.map((r) => String(r.data.taskId || "").trim()).filter(isOid)
    )];
    const existing = await Task.find({ _id: { $in: taskIds }, projectId })
      .select("_id")
      .lean();
    const existingIds = new Set(existing.map((t) => String(t._id)));

    const errors = [];
    const ops = [];
    let skipped = 0;

    for (const { rowNum, data } of rows) {
      const tid = String(data.taskId || "").trim();
      if (!isOid(tid)) {
        skipped++;
        errors.push({ row: rowNum, taskId: tid, message: "Missing or invalid Task ID — row skipped (creating new tasks via import is not supported in v1)" });
        continue;
      }
      if (!existingIds.has(tid)) {
        skipped++;
        errors.push({ row: rowNum, taskId: tid, message: "Task ID does not belong to this project — skipped" });
        continue;
      }
      const built = buildUpdate(data);
      if (built.error) {
        errors.push({ row: rowNum, taskId: tid, message: built.error });
        continue;
      }
      if (!Object.keys(built.set).length) {
        skipped++;
        continue; // nothing to change
      }
      ops.push({ updateOne: { filter: { _id: tid }, update: { $set: built.set } } });
    }

    let updated = 0;
    if (!dryRun && ops.length) {
      const result = await Task.bulkWrite(ops, { ordered: false });
      updated = result.modifiedCount || ops.length;
    }

    const failures = errors.filter((e) =>
      !/skipped/.test(e.message)
    ).length;
    const truncated = errors.length > 200;
    const trimmedErrors = errors.slice(0, 200);

    const log = await PlannerImportLog.create({
      projectId,
      importedBy: req.user?._id,
      fileName: req.file.originalname || "",
      rowsRead:    rows.length,
      rowsUpdated: updated,
      rowsSkipped: skipped,
      rowsFailed:  failures,
      errors: trimmedErrors,
      truncated,
      dryRun,
    });

    if (!dryRun) {
      // Link the log to the project plan so the planner UI can show history later.
      ProjectPlan.updateOne(
        { projectId },
        { $push: { excelImportLogIds: log._id } },
        { upsert: true }
      ).catch(() => {});

      await logActivity({
        projectId,
        actorId: req.user?._id,
        entityType: "project",
        entityId: projectId,
        action: "planner.imported",
        description: `Master sheet imported — ${updated} updated, ${skipped} skipped, ${failures} failed`,
        metadata: { rowsRead: rows.length, updated, skipped, failures, fileName: req.file.originalname },
      });
    }

    res.json({
      ok: true,
      dryRun,
      rowsRead:    rows.length,
      rowsUpdated: dryRun ? ops.length : updated,
      rowsSkipped: skipped,
      rowsFailed:  failures,
      errors:      trimmedErrors,
      truncated,
      logId:       log._id,
    });
  } catch (err) {
    console.error("[PlannerExcel.importMasterSheet]", err);
    res.status(500).json({ message: "Failed to import master sheet" });
  }
};
