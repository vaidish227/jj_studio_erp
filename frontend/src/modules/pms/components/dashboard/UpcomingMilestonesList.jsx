import React from 'react';
import { Calendar, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DAY = 86400000;

const dueChip = (dueDate) => {
  if (!dueDate) return { label: '—', tone: 'muted' };
  const diff = Math.round((new Date(dueDate) - Date.now()) / DAY);
  if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`, tone: 'error' };
  if (diff === 0) return { label: 'Today',    tone: 'warning' };
  if (diff === 1) return { label: 'Tomorrow', tone: 'warning' };
  if (diff <= 3)  return { label: `${diff}d`,  tone: 'warning' };
  return { label: `${diff}d`, tone: 'muted' };
};

const TONE_CLS = {
  error:   'text-[var(--error)] bg-[var(--error)]/12',
  warning: 'text-[var(--warning)] bg-[var(--warning)]/12',
  muted:   'text-[var(--text-muted)] bg-[var(--bg)]',
};

const fmtTaskType = (t) => (t || '—').replace(/_/g, ' ');

const UpcomingMilestonesList = ({ items = [] }) => {
  const navigate = useNavigate();
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 lg:p-6 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Calendar size={16} className="text-[var(--accent-blue)]" />
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Upcoming Milestones</h3>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-auto">
          next 7 days
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 py-10 text-center text-sm text-[var(--text-muted)]">
          Nothing due in the next week.
        </div>
      ) : (
        <ul className="space-y-2 flex-1">
          {items.map((m) => {
            const chip = dueChip(m.dueDate);
            return (
              <li key={m._id}>
                <button
                  type="button"
                  onClick={() => navigate(`/tasks/${m._id}`)}
                  className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl border border-[var(--border)] hover:border-[var(--primary)]/40 hover:bg-[var(--bg)]/40 transition-colors"
                >
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg shrink-0 ${TONE_CLS[chip.tone]}`}
                  >
                    {chip.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">{m.title}</p>
                    <p className="text-[10px] text-[var(--text-muted)] truncate">
                      <span className="capitalize">{fmtTaskType(m.taskType)}</span>
                      {m.trackingId && (
                        <> · <span className="font-semibold">{m.trackingId}</span></>
                      )}
                    </p>
                  </div>
                  <ArrowRight size={14} className="text-[var(--text-muted)] shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default UpcomingMilestonesList;
