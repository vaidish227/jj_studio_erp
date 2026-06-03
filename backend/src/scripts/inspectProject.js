/**
 * inspectProject — read-only QA helper.
 *
 * Prints the full workflow state of a project in one screen so you can verify
 * your manual UI actions against the DB without hand-rolling Mongo queries.
 *
 * Usage:
 *   node backend/src/scripts/inspectProject.js                    # list recent projects
 *   node backend/src/scripts/inspectProject.js <projectId>        # full state for one project
 *   node backend/src/scripts/inspectProject.js --tracking PRJ-...  # lookup by trackingId
 *
 * Read-only. Never writes anything.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");

const Project = require("../modules/pms/models/Project.model");
const Task = require("../modules/pms/models/Task.model");
const TaskDependency = require("../modules/pms/models/TaskDependency.model");
const ApprovalGate = require("../modules/pms/models/ApprovalGate.model");
const Approval = require("../modules/pms/models/Approval.model");
const Drawing = require("../modules/pms/models/Drawing.model");
const VendorEngagement = require("../modules/pms/models/VendorEngagement.model");
const WhatsAppProjectGroup = require("../modules/pms/models/WhatsAppProjectGroup.model");
const DrawingReleaseLog = require("../modules/pms/models/DrawingReleaseLog.model");
const Vendor = require("../modules/pms/models/Vendor.model");
const WorkflowTemplate = require("../modules/pms/models/WorkflowTemplate.model");

// Register populated-ref models so populate() doesn't crash.
// Each is wrapped in try/require so a missing model degrades gracefully.
try { require("../modules/crm/models/CRMClient.model"); } catch (e) { /* CRMClient optional in some envs */ }
try { require("../modules/auth/models/user.model");     } catch (e) { /* same */ }
try { require("../modules/pms/models/PurchaseOrder.model"); } catch (e) { /* same */ }

// ── tiny formatting helpers ──────────────────────────────────────────────────
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;
const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const BLUE = (s) => `\x1b[34m${s}\x1b[0m`;
const CYAN = (s) => `\x1b[36m${s}\x1b[0m`;

const colorStatus = (s) => {
  if (!s) return DIM("—");
  if (["approved", "closed", "obtained", "client_approved", "site_received", "delivered", "po_emitted", "released_to_site", "completed"].includes(s)) return GREEN(s);
  if (["blocked", "pending", "open", "requested", "quoted", "not_started", "draft"].includes(s)) return YELLOW(s);
  if (["rejected", "cancelled"].includes(s)) return RED(s);
  if (["overridden", "in_progress", "pending_review", "approved_with_changes", "sent_for_approval"].includes(s)) return BLUE(s);
  return s;
};

const fmtId = (id) => id ? String(id).slice(-6) : "—";

const fmtDate = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

function table(rows, headers) {
  if (!rows.length) {
    console.log(DIM("  (none)"));
    return;
  }
  // Compute column widths from raw text (strip ANSI for width calc)
  const stripAnsi = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, "");
  const widths = headers.map((h, i) => Math.max(
    stripAnsi(h).length,
    ...rows.map((r) => stripAnsi(String(r[i] ?? "")).length)
  ));
  const pad = (s, w) => {
    const visible = stripAnsi(String(s));
    return s + " ".repeat(Math.max(0, w - visible.length));
  };
  const sep = "  ";
  console.log("  " + BOLD(headers.map((h, i) => pad(h, widths[i])).join(sep)));
  console.log("  " + DIM(widths.map((w) => "─".repeat(w)).join("──")));
  for (const r of rows) {
    console.log("  " + r.map((c, i) => pad(c ?? "", widths[i])).join(sep));
  }
}

function section(title) {
  console.log("\n" + BOLD(CYAN(`── ${title} `.padEnd(72, "─"))));
}

// ── inspectors ──────────────────────────────────────────────────────────────

async function inspectProject(projectId) {
  const project = await Project.findById(projectId)
    .populate("clientId", "name email phone")
    .populate("workflowTemplateId", "name")
    .lean();

  if (!project) {
    console.log(RED(`Project ${projectId} not found.`));
    return;
  }

  // ── Header ───────────────────────────────────────────────────────────────
  section("PROJECT");
  console.log("  Name           " + BOLD(project.name));
  console.log("  Tracking       " + project.trackingId);
  console.log("  Id             " + DIM(project._id.toString()));
  console.log("  Client         " + (project.clientId?.name || DIM("—")));
  console.log("  Status         " + colorStatus(project.status));
  console.log("  Phase          " + BOLD(colorStatus(project.phase || "—")));
  console.log("  Template       " + (project.workflowTemplateId?.name || DIM("none — legacy")));
  console.log("  Progress       " + (project.progressPercent ?? 0) + "%");
  console.log("  Workflow flag  " + (process.env.WORKFLOW_ENGINE_V1 === "true" ? GREEN("ENABLED") : RED("OFF — engine will skip seeding!")));

  // ── Client approvals (project-level) ─────────────────────────────────────
  section("CLIENT APPROVALS");
  table(
    (project.clientApprovals || []).map((a) => [
      a.type,
      colorStatus(a.status),
      fmtDate(a.obtainedAt),
      a.notes || "",
    ]),
    ["Type", "Status", "Obtained At", "Notes"]
  );

  // ── Tasks ────────────────────────────────────────────────────────────────
  const tasks = await Task.find({ projectId })
    .populate("assignedTo", "name email")
    .sort({ dayOffsetFromProjectStart: 1, createdAt: 1 })
    .lean();
  section(`TASKS (${tasks.length})`);
  table(
    tasks.map((t) => [
      t.taskType,
      t.title.length > 32 ? t.title.slice(0, 30) + "…" : t.title,
      colorStatus(t.status),
      t.gateStatus !== "none" ? colorStatus(t.gateStatus) : DIM("—"),
      t.dependsOn?.length ? `${t.dependsOn.length} dep(s)` : DIM("—"),
      t.routing ? BLUE(t.routing) : DIM("—"),
      t.assignedTo?.name || DIM("unassigned"),
      DIM(fmtId(t._id)),
    ]),
    ["Type", "Title", "Status", "Gate", "Deps", "Routing", "Assignee", "Id"]
  );

  // ── Gates ────────────────────────────────────────────────────────────────
  const gates = await ApprovalGate.find({ projectId })
    .sort({ status: 1, gateType: 1 })
    .lean();
  section(`APPROVAL GATES (${gates.length})`);
  for (const g of gates) {
    const age = Math.floor((Date.now() - new Date(g.createdAt).getTime()) / 86400000);
    console.log(
      "  " +
      BOLD(g.gateType.padEnd(28)) +
      colorStatus(g.status.padEnd(12)) +
      DIM(`approver=`) + g.approverType.padEnd(24) +
      DIM(`listens=`) + (g.listensTo || "—").padEnd(20) +
      DIM(`age=`) + `${age}d`.padEnd(6) +
      DIM(`blocks=`) + `${(g.blockedTaskIds || []).length} task(s)`
    );
    if (g.overrideReason) {
      console.log("    " + RED("override: ") + g.overrideReason);
    }
  }

  // ── Approval records (PD reviews + others) ────────────────────────────────
  const approvals = await Approval.find({ projectId })
    .populate("approverId", "name email")
    .sort({ createdAt: -1 })
    .lean();
  section(`APPROVAL RECORDS (${approvals.length})`);
  table(
    approvals.map((a) => [
      a.approverType,
      a.targetType,
      DIM(fmtId(a.targetId)),
      colorStatus(a.status),
      a.gateId ? DIM(fmtId(a.gateId)) : DIM("—"),
      a.approverId?.name || DIM("—"),
      DIM(fmtDate(a.respondedAt || a.createdAt)),
    ]),
    ["Approver", "Target", "Target Id", "Status", "Gate Id", "Reviewer", "When"]
  );

  // ── Drawings ─────────────────────────────────────────────────────────────
  const drawings = await Drawing.find({ projectId }).sort({ createdAt: -1 }).lean();
  section(`DRAWINGS (${drawings.length})`);
  table(
    drawings.map((d) => [
      d.title.length > 28 ? d.title.slice(0, 26) + "…" : d.title,
      d.drawingType,
      `v${d.version || 1}`,
      colorStatus(d.status),
      d.isReleased ? GREEN("YES") : DIM("no"),
      DIM(fmtId(d._id)),
    ]),
    ["Title", "Type", "Ver", "Status", "Released", "Id"]
  );

  // ── Release logs ─────────────────────────────────────────────────────────
  const logs = await DrawingReleaseLog.find({ projectId }).sort({ releasedAt: -1 }).lean();
  if (logs.length > 0) {
    section(`DRAWING RELEASE LOGS (${logs.length})`);
    for (const l of logs) {
      const acked = l.recipients.filter((r) => r.ackedAt).length;
      console.log(
        "  " + BOLD(l.title || DIM(fmtId(l.drawingId))) +
        DIM(`  v${l.version}  released ${fmtDate(l.releasedAt)}  `) +
        `${acked}/${l.recipients.length} acked`
      );
      for (const r of l.recipients) {
        console.log(
          "    " + DIM("·") + " " +
          (r.name || r.phone || "—").padEnd(22) +
          DIM("ch=") + r.channel.padEnd(10) +
          (r.ackedAt ? GREEN("✓ " + fmtDate(r.ackedAt)) : YELLOW("pending"))
        );
      }
    }
  }

  // ── Vendor engagements ───────────────────────────────────────────────────
  const engagements = await VendorEngagement.find({ projectId })
    .populate("vendorId", "name category")
    .populate("whatsappGroupId", "groupName syncStatus")
    .populate("poId", "poNumber status")
    .sort({ createdAt: -1 })
    .lean();
  section(`VENDOR ENGAGEMENTS (${engagements.length})`);
  for (const e of engagements) {
    console.log(
      "  " +
      BOLD(e.vendorKind.toUpperCase().padEnd(12)) +
      (e.vendorId?.name || DIM("—")).padEnd(24) +
      colorStatus(e.status.padEnd(18)) +
      DIM(`amount=`) + (e.amount ? `₹${e.amount.toLocaleString("en-IN")}` : "—").padEnd(14) +
      DIM(`po=`) + (e.poId?.poNumber || DIM("—")).padEnd(16) +
      DIM(`wa=`) + (e.whatsappGroupId ? GREEN("✓") : DIM("—"))
    );
    if (e.whatsappGroupId) {
      console.log("    " + DIM("WA group: ") + e.whatsappGroupId.groupName);
    }
    if (e.history?.length) {
      const last = e.history[e.history.length - 1];
      console.log("    " + DIM("last transition: ") + (last.fromStatus || "∅") + " → " + last.toStatus + DIM(" @ " + fmtDate(last.at)));
    }
  }

  // ── WhatsApp groups (custom + main + others) ─────────────────────────────
  const waGroups = await WhatsAppProjectGroup.find({ projectId }).sort({ createdAt: -1 }).lean();
  if (waGroups.length > 0) {
    section(`WHATSAPP GROUPS (${waGroups.length})`);
    table(
      waGroups.map((g) => [
        g.groupType,
        g.groupName.length > 50 ? g.groupName.slice(0, 48) + "…" : g.groupName,
        colorStatus(g.syncStatus),
        `${g.members?.length || 0} member(s)`,
        DIM(fmtId(g._id)),
      ]),
      ["Type", "Name", "Sync", "Members", "Id"]
    );
  }

  console.log("\n" + DIM(`── tip: run \`node ${require("path").basename(__filename)} ${project._id}\` to inspect again after each UI action.`));
}

async function listRecentProjects() {
  console.log(BOLD("\nRecent projects:\n"));
  const list = await Project.find({})
    .sort({ createdAt: -1 })
    .limit(20)
    .select("name trackingId phase status workflowTemplateId createdAt")
    .lean();

  if (!list.length) {
    console.log(DIM("  No projects in DB."));
    return;
  }

  table(
    list.map((p) => [
      p.trackingId,
      p.name.length > 36 ? p.name.slice(0, 34) + "…" : p.name,
      colorStatus(p.phase || "—"),
      colorStatus(p.status),
      p.workflowTemplateId ? GREEN("seeded") : DIM("legacy"),
      DIM(fmtDate(p.createdAt)),
      DIM(String(p._id)),
    ]),
    ["Tracking", "Name", "Phase", "Status", "Workflow", "Created", "Id"]
  );

  console.log("\n" + DIM("Run with a project Id to inspect:") + " node " + require("path").basename(__filename) + " <projectId>");
}

async function findByTracking(trackingId) {
  const p = await Project.findOne({ trackingId }).select("_id").lean();
  if (!p) {
    console.log(RED(`No project with trackingId "${trackingId}"`));
    return null;
  }
  return p._id;
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const args = process.argv.slice(2);
  try {
    let projectId = null;
    if (args.length === 0) {
      await listRecentProjects();
    } else if (args[0] === "--tracking" && args[1]) {
      projectId = await findByTracking(args[1]);
      if (projectId) await inspectProject(projectId);
    } else if (mongoose.Types.ObjectId.isValid(args[0])) {
      await inspectProject(args[0]);
    } else {
      // try as trackingId
      projectId = await findByTracking(args[0]);
      if (projectId) await inspectProject(projectId);
      else console.log(RED("Argument is neither a valid ObjectId nor an existing trackingId."));
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("inspectProject crashed:", err);
  process.exit(1);
});
