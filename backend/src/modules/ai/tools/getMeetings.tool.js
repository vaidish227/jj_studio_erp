// Tool: get CRM meetings — scheduled calls / office / site visits with leads.
// Scoping mirrors getLeads: callers with wider perms see team-wide meetings,
// otherwise only meetings assigned to them.

const mongoose = require("mongoose");
const Meeting = require("../../crm/models/Metting.model");

const MEETING_STATUSES = ["scheduled", "rescheduled", "completed", "cancelled", "follow_up_required"];
const WIDER_PERMS = ["*", "crm.read", "users.manage"];

function hasWiderView(permissions = []) {
  return permissions.some((p) => WIDER_PERMS.includes(p));
}

// All date handling is anchored to IST (Asia/Kolkata) because this ERP serves
// India and meetings were scheduled in IST. Two sources of truth diverge if we
// don't: (a) the LLM serializes Date → ISO UTC and reads "04:30" as the time,
// (b) the day-range filter slips by 5.5h if the server runs in UTC.
const TZ = "Asia/Kolkata";
const TZ_LABEL = "IST";

const IST_DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  timeZone: TZ, day: "2-digit", month: "short", year: "numeric",
});
const IST_DATETIME_FMT = new Intl.DateTimeFormat("en-IN", {
  timeZone: TZ, day: "2-digit", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: true,
});
const IST_YMD_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
});

function fmtIstDay(d) {
  return IST_DATE_FMT.format(new Date(d));
}
function fmtIstDateTime(d) {
  return `${IST_DATETIME_FMT.format(new Date(d))} ${TZ_LABEL}`;
}

// Parse a user/LLM-supplied datetime string, treating naive datetimes as IST.
//   "2026-05-28"                  → 2026-05-28 00:00 IST
//   "2026-05-28T10:00"            → 2026-05-28 10:00 IST
//   "2026-05-28T10:00:00+05:30"   → respected as given
//   "2026-05-28T04:30:00Z"        → respected as given (UTC)
//   anything else parseable       → fall back to native Date (server local)
function parseLocalIst(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dateOnly) {
    const d = new Date(`${s}T00:00:00+05:30`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dt = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (dt) {
    const [, y, mo, da, h, mi, se] = dt;
    const d = new Date(`${y}-${mo}-${da}T${h}:${mi}:${se || "00"}+05:30`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Return [start, end) covering the entire IST calendar day that `input` falls on.
function parseDayRangeIst(input) {
  const d = parseLocalIst(input);
  if (!d) return null;
  const parts = IST_YMD_FMT.formatToParts(d);
  const y  = parts.find((p) => p.type === "year").value;
  const mo = parts.find((p) => p.type === "month").value;
  const da = parts.find((p) => p.type === "day").value;
  const start = new Date(`${y}-${mo}-${da}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

module.exports = {
  name: "getMeetings",
  permission: "crm.read",
  description:
    "Get CRM meetings (calls, office meetings, site visits) scheduled with leads. Use for 'how many meetings today', 'meetings on 28 May 2026', 'my meetings this week', 'show site visits scheduled'. Default scope: managers/admins (crm.read) see team meetings; others see only meetings assigned to them. Default status: 'scheduled' — pass status='all' to include completed/cancelled.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      date: {
        type: "string",
        description: "A single day (e.g. '2026-05-28', 'today', 'tomorrow'). Returns meetings whose start falls on that calendar day (local time). Ignored if 'from' or 'to' is provided.",
        minLength: 3,
        maxLength: 64,
      },
      from: {
        type: "string",
        description: "Range start (inclusive). Any parseable datetime. Use with 'to' for week/month queries.",
        minLength: 3,
        maxLength: 64,
      },
      to: {
        type: "string",
        description: "Range end (exclusive). Any parseable datetime.",
        minLength: 3,
        maxLength: 64,
      },
      status: {
        type: "string",
        enum: ["scheduled", "rescheduled", "completed", "cancelled", "follow_up_required", "all"],
        description: "Filter by status. Defaults to 'scheduled'. Use 'all' for every status.",
      },
      type: {
        type: "string",
        enum: ["call", "office", "site"],
        description: "Filter by meeting type.",
      },
      scope: {
        type: "string",
        enum: ["me", "team"],
        description: "'me' = meetings assigned to me. 'team' = all meetings I'm allowed to see. Defaults to 'team' for users with crm.read; otherwise 'me'.",
      },
      limit: { type: "integer", minimum: 1, maximum: 50 },
    },
    required: [],
  },

  handler: async (args, ctx) => {
    const canSeeTeam = hasWiderView(ctx.permissions);
    const scope = args.scope || (canSeeTeam ? "team" : "me");
    const limit = Math.min(args.limit || 20, 50);

    if (scope === "team" && !canSeeTeam) {
      return {
        ok: false,
        error: "denied",
        summaryText: "You don't have permission to view team-wide meetings.",
        uiHint: "error",
      };
    }

    // Resolve the date filter. Priority: explicit from/to range > single date > none.
    let rangeStart = null;
    let rangeEnd = null;
    let rangeLabel = "";

    const fromDt = parseLocalIst(args.from);
    const toDt = parseLocalIst(args.to);
    if (fromDt || toDt) {
      if (args.from && !fromDt) {
        return { ok: false, error: "invalid_args", summaryText: `Invalid 'from' date: ${args.from}`, uiHint: "error" };
      }
      if (args.to && !toDt) {
        return { ok: false, error: "invalid_args", summaryText: `Invalid 'to' date: ${args.to}`, uiHint: "error" };
      }
      rangeStart = fromDt;
      rangeEnd = toDt;
      rangeLabel = `${fromDt ? fmtIstDay(fromDt) : "…"} – ${toDt ? fmtIstDay(toDt) : "…"}`;
    } else if (args.date) {
      const day = parseDayRangeIst(args.date);
      if (!day) {
        return { ok: false, error: "invalid_args", summaryText: `Invalid date: ${args.date}`, uiHint: "error" };
      }
      rangeStart = day.start;
      rangeEnd = day.end;
      rangeLabel = `on ${fmtIstDay(day.start)}`;
    }
    // If no date filter at all, the query returns upcoming meetings (no time bound).

    const q = {};
    if (scope === "me") q.assignedTo = new mongoose.Types.ObjectId(ctx.userId);

    if (args.status && args.status !== "all") {
      q.status = args.status;
    } else if (!args.status) {
      q.status = "scheduled";
    }
    if (args.type) q.type = args.type;

    if (rangeStart || rangeEnd) {
      q.date = {};
      if (rangeStart) q.date.$gte = rangeStart;
      if (rangeEnd) q.date.$lt = rangeEnd;
    }

    const sort = rangeStart || rangeEnd ? { date: 1 } : { date: 1, createdAt: -1 };

    const [meetings, total] = await Promise.all([
      Meeting.find(q)
        .populate("leadId", "name trackingId phone city projectType")
        .populate("assignedTo", "name role")
        .sort(sort)
        .limit(limit)
        .lean(),
      Meeting.countDocuments(q),
    ]);

    const items = meetings.map((m) => ({
      id: String(m._id),
      date: m.date,
      type: m.type,
      status: m.status,
      durationMinutes: m.durationMinutes,
      notes: m.notes || null,
      lead: m.leadId
        ? {
            id: String(m.leadId._id),
            name: m.leadId.name,
            trackingId: m.leadId.trackingId,
            phone: m.leadId.phone,
            city: m.leadId.city,
            projectType: m.leadId.projectType,
          }
        : null,
      assignee: m.assignedTo ? { id: String(m.assignedTo._id), name: m.assignedTo.name, role: m.assignedTo.role } : null,
      url: "/crm/meetings",
    }));

    const ownership = scope === "team" ? "" : "your ";
    const statusLabel = args.status && args.status !== "all" ? args.status : "scheduled";
    const where = rangeLabel ? ` ${rangeLabel}` : " upcoming";

    let summaryText;
    if (items.length === 0) {
      summaryText = `No ${statusLabel} ${ownership}meetings${where}.`;
    } else if (total > items.length) {
      summaryText = `Showing ${items.length} of ${total} ${statusLabel} ${ownership}meetings${where}`;
    } else {
      summaryText = `${total} ${statusLabel} ${ownership}meeting${total === 1 ? "" : "s"}${where}`;
    }

    return {
      data: items,
      total,
      shown: items.length,
      viewAllUrl: "/crm/meetings",
      summaryText,
      uiHint: "meetingList",
      llmSummary: {
        total,
        shown: items.length,
        truncated: total > items.length,
        scope,
        statusFilter: statusLabel,
        rangeLabel: rangeLabel || "upcoming",
        viewAllUrl: "/crm/meetings",
        // `when` is pre-formatted in IST so the LLM never has to interpret a
        // raw UTC ISO string (which led to a 5.5h-off bug). Frontend keeps the
        // raw Date via `data[i].date` and renders it with the browser's locale.
        items: items.slice(0, 10).map((m) => ({
          id: m.id,
          when: fmtIstDateTime(m.date),
          type: m.type,
          status: m.status,
          durationMinutes: m.durationMinutes,
          leadName: m.lead?.name || null,
          leadTrackingId: m.lead?.trackingId || null,
          city: m.lead?.city || null,
          assignee: m.assignee?.name || null,
        })),
      },
    };
  },
};
