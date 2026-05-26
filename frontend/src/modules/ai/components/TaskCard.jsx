import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Flag, ChevronRight } from 'lucide-react';

const STATUS_BADGE = {
  not_started:             { label: 'Not started',  className: 'bg-gray-100 text-gray-700' },
  in_progress:             { label: 'In progress',  className: 'bg-blue-50 text-blue-700' },
  pending_review:          { label: 'In review',    className: 'bg-amber-50 text-amber-700' },
  revision_requested:      { label: 'Revision',     className: 'bg-orange-50 text-orange-700' },
  pending_client_approval: { label: 'Client review', className: 'bg-purple-50 text-purple-700' },
  approved:                { label: 'Approved',     className: 'bg-emerald-50 text-emerald-700' },
  released_to_site:        { label: 'Released',     className: 'bg-teal-50 text-teal-700' },
  completed:               { label: 'Completed',    className: 'bg-green-50 text-green-700' },
  on_hold:                 { label: 'On hold',      className: 'bg-rose-50 text-rose-700' },
};

const PRIORITY_COLOR = {
  low:    'text-gray-500',
  medium: 'text-blue-500',
  high:   'text-amber-600',
  urgent: 'text-red-600',
};

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

const TaskCard = ({ items, mode = 'list' }) => {
  const navigate = useNavigate();
  if (!items || items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((t, i) => {
        const badge = STATUS_BADGE[t.status] || { label: t.status, className: 'bg-gray-100 text-gray-700' };
        const onOpen = () => {
          if (t.url) navigate(t.url);
          else if (t.id && t.project?.id) navigate(`/projects/${t.project.id}?taskId=${t.id}`);
        };
        return (
          <button
            type="button"
            key={t.id || i}
            onClick={onOpen}
            className="text-left bg-white border border-[var(--border,#e5e5e5)] rounded-lg px-3 py-2 hover:border-[var(--primary,#D4B76C)] transition-colors group"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium text-[var(--text,#2E2E2E)] line-clamp-2">{t.title}</div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted,#A0A0A0)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px]">
                  <span className={`px-1.5 py-0.5 rounded ${badge.className}`}>{badge.label}</span>
                  {t.priority && (
                    <span className={`inline-flex items-center gap-0.5 ${PRIORITY_COLOR[t.priority] || 'text-gray-500'}`}>
                      <Flag className="w-3 h-3" /> {t.priority}
                    </span>
                  )}
                  {t.dueDate && (
                    <span className={`inline-flex items-center gap-0.5 ${t.isOverdue ? 'text-red-600 font-medium' : 'text-[var(--text-muted,#A0A0A0)]'}`}>
                      <Calendar className="w-3 h-3" /> {formatDate(t.dueDate)}
                      {t.isOverdue && ' · overdue'}
                      {typeof t.overdueByDays === 'number' && t.overdueByDays > 0 && ` · ${t.overdueByDays}d`}
                    </span>
                  )}
                  {t.project?.trackingId && (
                    <span className="text-[var(--text-muted,#A0A0A0)]">{t.project.trackingId}</span>
                  )}
                </div>
                {mode === 'details' && t.checklistProgress && (
                  <div className="mt-2 text-[11px] text-[var(--text-muted,#A0A0A0)]">
                    Checklist: {t.checklistProgress.done}/{t.checklistProgress.total} ({t.checklistProgress.percent}%)
                  </div>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default TaskCard;
