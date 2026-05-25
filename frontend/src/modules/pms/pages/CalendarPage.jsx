import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Button, Loader } from '../../../shared/components';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

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

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const isSameDay = (a, b) => a.toDateString() === b.toDateString();

const CalendarPage = () => {
  const { error: toastError } = useToast();
  const [today]    = useState(new Date());
  const [current,  setCurrent]  = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [events,   setEvents]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(false);

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

  // Build grid — weeks that cover the month
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsForDay = (date) => {
    if (!date) return [];
    return events.filter((e) => {
      const ed = new Date(e.date);
      return isSameDay(ed, date);
    });
  };

  const selectedEvents = selected ? eventsForDay(selected) : [];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--text-primary)]">Project Calendar</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Deadlines, milestones, deliveries and site visits</p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(EVENT_TYPE_LABELS).map(([type, label]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${EVENT_COLORS[type]?.dot}`} />
            <span className="text-xs text-[var(--text-muted)]">{label}</span>
          </div>
        ))}
      </div>

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
              return (
                <div
                  key={idx}
                  onClick={() => date && setSelected(isSel ? null : date)}
                  className={`min-h-[80px] p-1.5 border-b border-r border-[var(--border)] last:border-r-0
                    ${date ? 'cursor-pointer hover:bg-[var(--bg)] transition-colors' : 'bg-[var(--bg)]/50'}
                    ${isSel ? 'bg-[var(--primary)]/5 ring-1 ring-inset ring-[var(--primary)]/30' : ''}
                  `}
                >
                  {date && (
                    <>
                      <span className={`text-xs font-bold inline-flex items-center justify-center w-6 h-6 rounded-full mb-1
                        ${isToday ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)]'}`}>
                        {date.getDate()}
                      </span>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((e, i) => (
                          <div key={i} className={`flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-semibold truncate ${EVENT_COLORS[e.type]?.badge || 'bg-[var(--border)] text-[var(--text-muted)]'}`}>
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
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">
            {selected.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          <div className="space-y-2">
            {selectedEvents.map((e, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${EVENT_COLORS[e.type]?.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{e.title}</p>
                  {e.projectName && <p className="text-xs text-[var(--text-muted)]">{e.projectName}</p>}
                  {e.description && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{e.description}</p>}
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${EVENT_COLORS[e.type]?.badge}`}>
                  {EVENT_TYPE_LABELS[e.type] || e.type}
                </span>
              </div>
            ))}
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
