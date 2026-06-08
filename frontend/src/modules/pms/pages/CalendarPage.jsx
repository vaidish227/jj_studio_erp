import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, AlertTriangle, Users, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Loader } from '../../../shared/components';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { useAuth } from '../../../shared/context/AuthContext';

const EVENT_COLORS = {
  task_due:         { dot: 'bg-[var(--primary)]',      badge: 'bg-[var(--primary)]/10 text-[var(--primary)]' },
  milestone:        { dot: 'bg-[var(--accent-blue)]',  badge: 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]' },
  site_visit:       { dot: 'bg-[var(--accent-teal)]',  badge: 'bg-[var(--accent-teal)]/10 text-[var(--accent-teal)]' },
  po_delivery:      { dot: 'bg-[var(--warning)]',      badge: 'bg-[var(--warning)]/10 text-[var(--warning)]' },
  project_deadline: { dot: 'bg-[var(--error)]',        badge: 'bg-[var(--error)]/10 text-[var(--error)]' },
};

const EVENT_TYPE_LABELS = {
  task_due:         'Task',
  milestone:        'Milestone',
  site_visit:       'Site Visit',
  po_delivery:      'PO Delivery',
  project_deadline: 'Deadline',
};

// Statuses that count an event as "done" — anything else past its due date is overdue.
const DONE_STATUSES = new Set([
  'approved', 'completed', 'released_to_site', 'done',
  'completed_on_time', 'completed_late',
  'delivered', 'received',
  'cancelled',
]);

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const isSameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();
const isPastDay = (date, today) => startOfDay(date) < startOfDay(today);
const isEventDone = (e) => DONE_STATUSES.has(String(e.status || '').toLowerCase());

const CalendarPage = () => {
  const { error: toastError } = useToast();
  const { user: currentUser } = useAuth() || {};

  const [today]    = useState(new Date());
  const [current,  setCurrent]  = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [events,   setEvents]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(false);

  // Filters
  const [userFilter,    setUserFilter]    = useState('all');     // 'all' | 'mine' | <assigneeId>
  const [projectFilter, setProjectFilter] = useState('all');
  const [pendingOnly,   setPendingOnly]   = useState(false);

  // Hover popover: shows the full task list for a day, anchored to the cell rect.
  const [hoverInfo, setHoverInfo] = useState(null); // { date, events, rect }

  const year  = current.getFullYear();
  const month = current.getMonth();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const startDate = new Date(year, month, 1).toISOString().slice(0, 10);
    const endDate   = new Date(year, month + 1, 0).toISOString().slice(0, 10);
    try {
      const res = await pmsService.getCalendarEvents({ startDate, endDate });
      setEvents(res.events || []);
    } catch {
      toastError('Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const prevMonth = () => setCurrent(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrent(new Date(year, month + 1, 1));
  const goToToday = () => setCurrent(new Date(today.getFullYear(), today.getMonth(), 1));

  // Unique users + projects present in this month's events, for the dropdowns.
  const { userOptions, projectOptions } = useMemo(() => {
    const usersMap = new Map();
    const projsMap = new Map();
    events.forEach((e) => {
      if (e.assigneeId && e.assignee) usersMap.set(String(e.assigneeId), e.assignee);
      if (e.projectId && e.projectName) projsMap.set(String(e.projectId), e.projectName);
    });
    return {
      userOptions:    Array.from(usersMap, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      projectOptions: Array.from(projsMap, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [events]);

  // Apply filters once, then index by ISO day for fast cell lookup.
  const eventsByDay = useMemo(() => {
    const myId = currentUser?._id ? String(currentUser._id) : null;
    const filtered = events.filter((e) => {
      if (pendingOnly && isEventDone(e)) return false;
      if (projectFilter !== 'all' && String(e.projectId || '') !== projectFilter) return false;
      if (userFilter === 'all') return true;
      if (userFilter === 'mine') return myId && String(e.assigneeId || '') === myId;
      return String(e.assigneeId || '') === userFilter;
    });

    const map = new Map();
    filtered.forEach((e) => {
      const key = startOfDay(new Date(e.date)).getTime();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return map;
  }, [events, pendingOnly, projectFilter, userFilter, currentUser]);

  const eventsForDay = (date) => {
    if (!date) return [];
    return eventsByDay.get(startOfDay(date).getTime()) || [];
  };

  // Build grid — weeks that cover the month
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedEvents = selected ? eventsForDay(selected) : [];

  // Header summary across the visible (filtered) month.
  const monthSummary = useMemo(() => {
    let total = 0, overdue = 0, pending = 0;
    eventsByDay.forEach((dayEvents, key) => {
      const d = new Date(key);
      dayEvents.forEach((e) => {
        total += 1;
        const done = isEventDone(e);
        if (!done) pending += 1;
        if (!done && isPastDay(d, today)) overdue += 1;
      });
    });
    return { total, overdue, pending };
  }, [eventsByDay, today]);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--text-primary)]">Project Calendar</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Deadlines, milestones, deliveries and site visits across all users
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToToday}
            className="px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg)] transition-colors"
          >
            Today
          </button>
          <button onClick={prevMonth} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--bg)] transition-colors text-[var(--text-muted)]">
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[140px] text-center text-sm font-bold text-[var(--text-primary)]">
            {MONTHS[month]} {year}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--bg)] transition-colors text-[var(--text-muted)]">
            <ChevronRight size={16} />
          </button>
          <button onClick={fetchEvents} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--bg)] transition-colors text-[var(--text-muted)]" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Month summary chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
          {monthSummary.total} total
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--warning)]/10 text-[var(--warning)] text-[10px] font-black uppercase tracking-widest">
          {monthSummary.pending} pending
        </span>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest
          ${monthSummary.overdue > 0
            ? 'bg-[var(--error)]/12 text-[var(--error)]'
            : 'bg-[var(--bg)] text-[var(--text-muted)] border border-[var(--border)]'}`}
        >
          <AlertTriangle size={11} />
          {monthSummary.overdue} overdue
        </span>
      </div>

      {/* Filters */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
          <Filter size={12} /> Filters
        </div>

        {/* User filter */}
        <label className="flex items-center gap-2">
          <Users size={12} className="text-[var(--text-muted)]" />
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="bg-[var(--bg)] border border-[var(--border)] rounded-md px-2 py-1 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          >
            <option value="all">All users</option>
            {currentUser?._id && <option value="mine">Mine only</option>}
            {userOptions.length > 0 && <option disabled>──────────</option>}
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>

        {/* Project filter */}
        <label className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Project</span>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="bg-[var(--bg)] border border-[var(--border)] rounded-md px-2 py-1 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          >
            <option value="all">All projects</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        {/* Pending only */}
        <label className="ml-auto flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] cursor-pointer">
          <input
            type="checkbox"
            checked={pendingOnly}
            onChange={(e) => setPendingOnly(e.target.checked)}
            className="accent-[var(--primary)]"
          />
          Pending only
        </label>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {Object.entries(EVENT_TYPE_LABELS).map(([type, label]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${EVENT_COLORS[type]?.dot}`} />
            <span className="text-xs text-[var(--text-muted)]">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[var(--error)]/15 border border-[var(--error)]/40" />
          <span className="text-xs text-[var(--text-muted)]">Overdue day</span>
        </div>
      </div>

      {/* Hover popover — shows the full day's task list anchored to the cell.
          Rendered with position:fixed so it isn't clipped by the calendar's
          overflow-hidden container. Prefers side placement (right, then left)
          since that feels like a natural tooltip; falls back to below/above
          with bottom-anchoring so the popover always hugs the cell edge. */}
      {hoverInfo && (() => {
        const POP_W = 300;
        const POP_MAX_H = 380;
        const PAD = 12;
        const GAP = 8;
        const vw = typeof window !== 'undefined' ? window.innerWidth  : 1280;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
        const rect = hoverInfo.rect;

        const fitsRight = rect.right + GAP + POP_W <= vw - PAD;
        const fitsLeft  = rect.left  - GAP - POP_W >= PAD;

        let style;
        if (fitsRight || fitsLeft) {
          const left = fitsRight ? rect.right + GAP : rect.left - GAP - POP_W;
          const top  = Math.max(PAD, Math.min(rect.top, vh - POP_MAX_H - PAD));
          style = { top, left, width: POP_W, maxHeight: POP_MAX_H };
        } else {
          const left = Math.min(Math.max(PAD, rect.left), vw - POP_W - PAD);
          const fitsBelow = rect.bottom + GAP + 140 <= vh - PAD;
          style = fitsBelow
            ? { top: rect.bottom + GAP,           left, width: POP_W, maxHeight: POP_MAX_H }
            : { bottom: vh - rect.top + GAP,     left, width: POP_W, maxHeight: POP_MAX_H };
        }

        const overdueOnDay = hoverInfo.events.filter(
          (e) => !isEventDone(e) && isPastDay(hoverInfo.date, today),
        ).length;
        return (
          <div
            className="fixed z-50 pointer-events-none bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden"
            style={style}
          >
            <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--bg)] flex items-center justify-between gap-2">
              <p className="text-xs font-extrabold text-[var(--text-primary)]">
                {hoverInfo.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                {hoverInfo.events.length} {hoverInfo.events.length === 1 ? 'item' : 'items'}
                {overdueOnDay > 0 && (
                  <span className="ml-1.5 text-[var(--error)]">· {overdueOnDay} overdue</span>
                )}
              </span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: POP_MAX_H - 38 }}>
              {hoverInfo.events.map((e, i) => {
                const done    = isEventDone(e);
                const overdue = !done && isPastDay(hoverInfo.date, today);
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2 px-3 py-2 border-b border-[var(--border)] last:border-b-0
                      ${overdue ? 'bg-[var(--error)]/6' : ''}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${EVENT_COLORS[e.type]?.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[var(--text-primary)] leading-snug break-words">
                        {e.title}
                      </p>
                      {e.projectName && (
                        <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{e.projectName}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${EVENT_COLORS[e.type]?.badge}`}>
                          {EVENT_TYPE_LABELS[e.type] || e.type}
                        </span>
                        {overdue && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-widest text-[var(--error)]">
                            <AlertTriangle size={9} /> Overdue
                          </span>
                        )}
                        {e.assignee && (
                          <span className="text-[10px] text-[var(--text-muted)] truncate flex items-center gap-1">
                            <Users size={9} /> {e.assignee}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {loading ? (
        <div className="flex justify-center py-16"><Loader label="Loading calendar…" /></div>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-[var(--border)]">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] py-2.5">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {cells.map((date, idx) => {
              const dayEvents = date ? eventsForDay(date) : [];
              const isToday   = date && isSameDay(date, today);
              const isSel     = date && selected && isSameDay(date, selected);

              // Overdue treatment: this cell sits in the past AND has at least
              // one event that isn't done. Today itself never gets the red wash.
              const overdueCount = date && isPastDay(date, today)
                ? dayEvents.filter((e) => !isEventDone(e)).length
                : 0;
              const isOverdueDay = overdueCount > 0;
              const dayCount = dayEvents.length;

              return (
                <div
                  key={idx}
                  onClick={() => date && setSelected(isSel ? null : date)}
                  onMouseEnter={(ev) => {
                    if (!date || dayEvents.length === 0) return;
                    setHoverInfo({
                      date,
                      events: dayEvents,
                      rect: ev.currentTarget.getBoundingClientRect(),
                    });
                  }}
                  onMouseLeave={() => setHoverInfo(null)}
                  className={`relative min-h-[92px] p-1.5 border-b border-r border-[var(--border)] last:border-r-0
                    ${date ? 'cursor-pointer transition-colors' : 'bg-[var(--bg)]/50'}
                    ${date && !isOverdueDay ? 'hover:bg-[var(--bg)]' : ''}
                    ${isOverdueDay ? 'bg-[var(--error)]/10 hover:bg-[var(--error)]/15' : ''}
                    ${isSel ? 'ring-2 ring-inset ring-[var(--primary)]/60' : ''}
                  `}
                >
                  {date && (
                    <>
                      <div className="flex items-start justify-between gap-1">
                        <span className={`text-xs font-bold inline-flex items-center justify-center w-6 h-6 rounded-full
                          ${isToday
                            ? 'bg-[var(--primary)] text-white'
                            : isOverdueDay
                              ? 'text-[var(--error)]'
                              : 'text-[var(--text-secondary)]'}`}
                        >
                          {date.getDate()}
                        </span>
                        {dayCount > 0 && (
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full
                            ${isOverdueDay
                              ? 'bg-[var(--error)] text-white'
                              : 'bg-[var(--primary)]/15 text-[var(--primary)]'}`}
                            title={`${dayCount} ${dayCount === 1 ? 'task' : 'tasks'}${isOverdueDay ? `, ${overdueCount} overdue` : ''}`}
                          >
                            {dayCount}
                          </span>
                        )}
                      </div>
                      <div className="space-y-0.5 mt-1">
                        {dayEvents.slice(0, 3).map((e, i) => (
                          <div
                            key={i}
                            className={`flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-semibold truncate ${EVENT_COLORS[e.type]?.badge || 'bg-[var(--border)] text-[var(--text-muted)]'}`}
                            title={`${e.title}${e.assignee ? ` — ${e.assignee}` : ''}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${EVENT_COLORS[e.type]?.dot}`} />
                            <span className="truncate">{e.title}</span>
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[9px] text-[var(--text-muted)] pl-1">+{dayEvents.length - 3} more</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Event detail panel */}
      {selected && selectedEvents.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              {selected.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h3>
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              {selectedEvents.length} {selectedEvents.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="space-y-2">
            {selectedEvents.map((e, i) => {
              const done       = isEventDone(e);
              const overdue    = !done && isPastDay(selected, today);
              const linkTarget = e.type === 'task_due'         ? `/tasks/${e.entityId}`
                              : e.projectId                    ? `/projects/${e.projectId}`
                              : null;
              const Inner = (
                <div className={`flex items-start gap-3 p-3 rounded-xl border transition-colors
                  ${overdue
                    ? 'bg-[var(--error)]/8 border-[var(--error)]/30 hover:bg-[var(--error)]/12'
                    : 'bg-[var(--bg)] border-[var(--border)] hover:bg-[var(--surface)]'}`}
                >
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${EVENT_COLORS[e.type]?.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{e.title}</p>
                      {overdue && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-[var(--error)] text-white">
                          <AlertTriangle size={9} /> Overdue
                        </span>
                      )}
                    </div>
                    {e.projectName && <p className="text-xs text-[var(--text-muted)] mt-0.5">{e.projectName}</p>}
                    {e.assignee && (
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5 flex items-center gap-1">
                        <Users size={10} /> {e.assignee}
                      </p>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${EVENT_COLORS[e.type]?.badge}`}>
                    {EVENT_TYPE_LABELS[e.type] || e.type}
                  </span>
                </div>
              );
              return linkTarget
                ? <Link key={i} to={linkTarget} className="block">{Inner}</Link>
                : <div key={i}>{Inner}</div>;
            })}
          </div>
        </div>
      )}

      {selected && selectedEvents.length === 0 && (
        <div className="text-center py-6 text-xs text-[var(--text-muted)]">
          No events on {selected.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
