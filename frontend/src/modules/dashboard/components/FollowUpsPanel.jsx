import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import Card from '../../../shared/components/Card/Card';
import Badge from '../../../shared/components/Badge/Badge';

// ─── Follow-up Item ───────────────────────────────────────────────────────────
const FollowUpItem = ({ name, project, time, status }) => {
  const statusVariant = {
    OVERDUE: 'overdue',
    TODAY: 'today',
    TOMORROW: 'tomorrow',
  }[status] ?? 'default';

  const bgMap = {
    overdue: 'bg-[var(--error)]/5 border-[var(--error)]/10',
    today: 'bg-[var(--warning)]/5 border-[var(--warning)]/10',
    tomorrow: 'bg-[var(--accent-blue)]/5 border-[var(--accent-blue)]/10',
  };

  return (
    <div className={`flex items-start justify-between p-3.5 rounded-xl border ${bgMap[statusVariant] ?? 'border-[var(--border)]'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-[var(--text-primary)]">{name}</p>
          <Badge label={status} variant={statusVariant} />
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">{project}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{time}</p>
      </div>
      <CalendarDays size={18} className="text-[var(--text-muted)] shrink-0 mt-1 ml-3" />
    </div>
  );
};

// ─── Follow-ups Panel ─────────────────────────────────────────────────────────
const FollowUpsPanel = ({ followUps = [] }) => {
  const navigate = useNavigate();

  return (
    <Card padding="p-6" className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-[var(--text-primary)]">Follow-ups</h2>
        <button className="text-sm font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors" onClick={() => navigate('/crm/follow-ups')}>
          View All
        </button>
      </div>

      {/* Items */}
      <div className="flex flex-col gap-3">
        {followUps.length ? followUps.map((item, i) => (
          <FollowUpItem key={i} {...item} />
        )) : (
          <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
            No pending follow-ups.
          </div>
        )}
      </div>
    </Card>
  );
};

export default FollowUpsPanel;
