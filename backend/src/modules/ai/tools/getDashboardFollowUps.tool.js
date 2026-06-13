// Tool: get the dashboard's upcoming-followups panel — pending follow-ups sorted
// by date (closest first), each tagged OVERDUE / TODAY / TOMORROW / future.
// IST-anchored so badges match what the user sees on the dashboard.

const mongoose = require("mongoose");
const FollowUp = require("../../crm/models/FollowUp.model");

const WIDER_PERMS = ["*", "crm.read", "users.manage"];

function hasWiderView(permissions = []) {
  return permissions.some((p) => WIDER_PERMS.includes(p));
}

const TZ = "Asia/Kolkata";
const TZ_LABEL = "IST";

const IST_YMD_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
});
const IST_DATETIME_FMT = new Intl.DateTimeFormat("en-IN", {
  timeZone: TZ, day: "2-digit", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: true,
});

function istYmd(d) {
  const parts = IST_YMD_FMT.formatToParts(new Date(d));
  const y  = parts.find((p) => p.type === "year").value;
  const mo = parts.find((p) => p.type === "month").value;
  const da = parts.find((p) => p.type === "day").value;
  return `${y}-${mo}-${da}`;
}

function fmtIstDateTime(d) {
  return `${IST_DATETIME_FMT.format(new Date(d))} ${TZ_LABEL}`;
}

function urgencyBadge(dueDate, todayYmd) {
  const dueYmd = istYmd(dueDate);
  if (dueYmd < todayYmd) return "OVERDUE";
  if (dueYmd === todayYmd) return "TODAY";
  const tomorrow = new Date(`${todayYmd}T00:00:00+05:30`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dueYmd === istYmd(tomorrow)) return "TOMORROW";
  return "UPCOMING";
}

module.exports = {
  name: "getDashboardFollowUps",
  permission: "crm.read",
  description:
    "Get pending CRM follow-ups for the dashboard, sorted by due date (closest first). Each item is tagged OVERDUE / TODAY / TOMORROW / UPCOMING. Use for 'upcoming follow-ups', 'what follow-ups are due', 'overdue follow-ups', 'follow-ups for today'. Default scope auto-widens for managers/admins.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      scope: {
        type: "string",
        enum: ["me", "team"],
        description: "'me' = only follow-ups assigned to me. 'team' = everything I'm allowed to see. Defaults to 'team' for crm.read; otherwise 'me'.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        description: "Max follow-ups to return (default 5).",
      },
      onlyOverdue: {
        type: "boolean",
        description: "If true, return only overdue pending follow-ups.",
      },
    },
    required: [],
  },

  handler: async (args, ctx) => {
    const canSeeTeam = hasWiderView(ctx.permissions);
    const scope = args.scope || (canSeeTeam ? "team" : "me");
    const limit = Math.min(args.limit || 5, 50);

    if (scope === "team" && !canSeeTeam) {
      return {
        ok: false,
        error: "denied",
        summaryText: "You don't have permission to view team-wide follow-ups.",
        uiHint: "error",
      };
    }

    const q = { status: "pending" };
    if (scope === "me") q.assignedTo = new mongoose.Types.ObjectId(ctx.userId);

    const todayYmd = istYmd(new Date());
    if (args.onlyOverdue) {
      q.date = { $lt: new Date(`${todayYmd}T00:00:00+05:30`) };
    }

    const [followups, total] = await Promise.all([
      FollowUp.find(q)
        .populate("leadId", "name trackingId phone city projectType status")
        .populate("assignedTo", "name role")
        .sort({ date: 1 })
        .limit(limit)
        .lean(),
      FollowUp.countDocuments(q),
    ]);

    const items = followups.map((f) => {
      const badge = urgencyBadge(f.date, todayYmd);
      return {
        id: String(f._id),
        date: f.date,
        note: f.note || null,
        nextFollowupDate: f.nextFollowupDate || null,
        badge,
        lead: f.leadId
          ? {
              id: String(f.leadId._id),
              name: f.leadId.name,
              trackingId: f.leadId.trackingId,
              phone: f.leadId.phone,
              city: f.leadId.city,
              projectType: f.leadId.projectType,
              status: f.leadId.status,
            }
          : null,
        assignee: f.assignedTo
          ? { id: String(f.assignedTo._id), name: f.assignedTo.name, role: f.assignedTo.role }
          : null,
        url: "/crm/follow-ups",
      };
    });

    const overdueCount = items.filter((i) => i.badge === "OVERDUE").length;
    const todayCount = items.filter((i) => i.badge === "TODAY").length;
    const ownership = scope === "team" ? "" : "your ";

    let summaryText;
    if (items.length === 0) {
      summaryText = args.onlyOverdue
        ? `No overdue ${ownership}follow-ups. 🎯`
        : `No pending ${ownership}follow-ups.`;
    } else if (total > items.length) {
      summaryText = `Showing ${items.length} of ${total} pending ${ownership}follow-up${total === 1 ? "" : "s"} — ${overdueCount} overdue, ${todayCount} today.`;
    } else {
      summaryText = `${total} pending ${ownership}follow-up${total === 1 ? "" : "s"} — ${overdueCount} overdue, ${todayCount} today.`;
    }

    return {
      data: items,
      total,
      shown: items.length,
      viewAllUrl: "/crm/follow-ups",
      summaryText,
      uiHint: "followupList",
      llmSummary: {
        scope,
        total,
        shown: items.length,
        overdue: overdueCount,
        today: todayCount,
        truncated: total > items.length,
        items: items.slice(0, 10).map((i) => ({
          id: i.id,
          when: fmtIstDateTime(i.date),
          badge: i.badge,
          note: i.note,
          leadName: i.lead?.name || null,
          leadTrackingId: i.lead?.trackingId || null,
          assignee: i.assignee?.name || null,
        })),
      },
    };
  },
};
