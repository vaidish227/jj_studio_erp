import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Phone, MapPin, Calendar, Clock, User as UserIcon } from 'lucide-react';

const STATUS_BADGE = {
  scheduled:           { label: 'Scheduled',  className: 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]' },
  rescheduled:         { label: 'Rescheduled',className: 'bg-[var(--warning)]/10 text-[var(--warning)]' },
  completed:           { label: 'Completed',  className: 'bg-[var(--success)]/10 text-[var(--success)]' },
  cancelled:           { label: 'Cancelled',  className: 'bg-[var(--error)]/10 text-[var(--error)]' },
  follow_up_required:  { label: 'Follow-up',  className: 'bg-[var(--primary)]/10 text-[var(--primary)]' },
};

const TYPE_LABEL = {
  call:   'Call',
  office: 'In office',
  site:   'Site visit',
};

function fmtDateTime(value) {
  if (!value) return { day: '', time: '' };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { day: '', time: '' };
  const day = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return { day, time };
}

const MeetingCard = ({ items, total, viewAllUrl }) => {
  const navigate = useNavigate();
  if (!items?.length) return null;
  const hasMore = typeof total === 'number' && total > items.length && !!viewAllUrl;

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((m) => {
        const badge = STATUS_BADGE[m.status] || { label: m.status, className: 'bg-[var(--bg)] text-[var(--text-muted)]' };
        const { day, time } = fmtDateTime(m.date);
        const typeLabel = TYPE_LABEL[m.type] || m.type;
        const target = m.url || viewAllUrl || '/crm/meetings';

        return (
          <button
            type="button"
            key={m.id}
            onClick={() => navigate(target)}
            className="text-left bg-white border border-[var(--border,#e5e5e5)] rounded-lg px-3 py-2 hover:border-[var(--primary,#D4B76C)] transition-colors group"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium text-[var(--text,#2E2E2E)] truncate">
                    {m.lead?.name || 'Unknown lead'}
                    <span className="text-[var(--text-muted,#A0A0A0)] font-normal"> · {typeLabel}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted,#A0A0A0)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px]">
                  <span className={`px-1.5 py-0.5 rounded ${badge.className}`}>{badge.label}</span>
                  {day && (
                    <span className="inline-flex items-center gap-0.5 text-[var(--text-muted,#A0A0A0)]">
                      <Calendar className="w-3 h-3" /> {day}
                    </span>
                  )}
                  {time && (
                    <span className="inline-flex items-center gap-0.5 text-[var(--text-muted,#A0A0A0)]">
                      <Clock className="w-3 h-3" /> {time}
                    </span>
                  )}
                  {m.durationMinutes && (
                    <span className="text-[var(--text-muted,#A0A0A0)]">{m.durationMinutes}m</span>
                  )}
                  {m.lead?.city && (
                    <span className="inline-flex items-center gap-0.5 text-[var(--text-muted,#A0A0A0)]">
                      <MapPin className="w-3 h-3" /> {m.lead.city}
                    </span>
                  )}
                  {m.lead?.phone && (
                    <span className="inline-flex items-center gap-0.5 text-[var(--text-muted,#A0A0A0)]">
                      <Phone className="w-3 h-3" /> {m.lead.phone}
                    </span>
                  )}
                  {m.assignee?.name && (
                    <span className="inline-flex items-center gap-0.5 text-[var(--text-muted,#A0A0A0)]">
                      <UserIcon className="w-3 h-3" /> {m.assignee.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        );
      })}
      {hasMore && (
        <button
          type="button"
          onClick={() => navigate(viewAllUrl)}
          className="text-left bg-[var(--bg,#F8F7F3)] border border-dashed border-[var(--border,#e5e5e5)] rounded-lg px-3 py-2 hover:border-[var(--primary,#D4B76C)] hover:bg-white transition-colors group inline-flex items-center justify-between gap-2"
        >
          <span className="text-xs font-medium text-[var(--primary,#D4B76C)]">
            View all {total} meetings
          </span>
          <ChevronRight className="w-4 h-4 text-[var(--text-muted,#A0A0A0)] group-hover:text-[var(--primary,#D4B76C)] transition-colors" />
        </button>
      )}
    </div>
  );
};

export default MeetingCard;
