import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarClock, ChevronRight } from 'lucide-react';
import { dueDateInfo } from '../delegationFormat';
import { PRIORITY_COLOR, resolveVar } from './chartTheme';

// AttentionList — the dashboard's call-to-action panel: open delegations that
// are overdue or due within 3 days, soonest first. Each row links straight to
// the detail page so a manager can act without hunting through the list view.
const AttentionList = ({ items = [] }) => {
  const navigate = useNavigate();

  if (!items.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center py-8 text-center">
        <div className="w-11 h-11 rounded-2xl bg-[var(--bg)] flex items-center justify-center text-[var(--success)]">
          <CalendarClock size={20} />
        </div>
        <p className="text-sm font-semibold text-[var(--text-secondary)] mt-2">Nothing needs attention</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">No open work is overdue or due soon.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[var(--border)] -my-1">
      {items.map((d) => {
        const info = dueDateInfo(d.dueDate, d.status);
        const accent = resolveVar(PRIORITY_COLOR[d.priority] || 'var(--text-muted)');
        return (
          <li key={d._id}>
            <button
              type="button"
              onClick={() => navigate(`/delegation/${d._id}`)}
              className="group w-full text-left flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-[var(--bg)] transition-colors"
            >
              <span className="w-1.5 h-9 rounded-full shrink-0" style={{ background: accent }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--primary-active)] transition-colors">
                  {d.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--text-muted)]">
                  <span className="font-mono bg-[var(--bg)] rounded px-1.5 py-0.5">{d.trackingId}</span>
                  <span className="truncate">{d.assignee || 'Unassigned'}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-bold whitespace-nowrap ${
                    d.overdue ? 'text-[var(--error)]' : 'text-[var(--warning)]'
                  }`}
                >
                  {d.overdue && <AlertTriangle size={12} />}
                  {info?.relative}
                </span>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{info?.label}</p>
              </div>
              <ChevronRight size={15} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default AttentionList;
