import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sun, AlertTriangle, Clock, Lock, Eye, CheckSquare,
  ArrowRight, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../../shared/context/AuthContext';
import useMyDay from '../hooks/useMyDay';

/**
 * MyDayWidget — Phase 3a.
 *
 * One compact block on the Dashboard that answers "what do I need to do today?".
 * Five buckets in a single grid; clicking any row deep-links to the relevant page.
 *
 *   - Overdue tasks
 *   - Upcoming tasks (next 7 days)
 *   - Blocked tasks (waiting on someone else)
 *   - PD reviews pending my decision
 *   - Open gates on my projects (PM lens)
 *
 * Renders nothing if all buckets are empty (clean slate UX).
 */

const fmtDue = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  const diff = Math.floor((dt - Date.now()) / 86400000);
  if (diff === 0) return 'today';
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 1) return 'tomorrow';
  return `in ${diff}d`;
};

const Section = ({ icon, title, count, tone, children }) => {
  if (count === 0) return null;
  const toneCls =
    tone === 'error'    ? 'text-[var(--error)]'         :
    tone === 'warning'  ? 'text-[var(--warning)]'       :
    tone === 'accent'   ? 'text-[var(--accent-blue)]'   :
    tone === 'primary'  ? 'text-[var(--primary)]'       :
    'text-[var(--text-muted)]';
  return (
    <div>
      <div className={`flex items-center gap-2 mb-2 ${toneCls}`}>
        {icon}
        <h4 className="text-[10px] font-black uppercase tracking-widest">{title}</h4>
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-current/10">
          {count}
        </span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
};

const Row = ({ title, subtitle, right, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]
               hover:border-[var(--primary)]/40 transition-colors text-left group"
  >
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{title}</p>
      {subtitle && <p className="text-[10px] text-[var(--text-muted)] truncate">{subtitle}</p>}
    </div>
    {right && <span className="shrink-0">{right}</span>}
    <ArrowRight size={12} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
  </button>
);

const MyDayWidget = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, error } = useMyDay();

  if (isLoading) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 lg:p-5">
        <p className="text-sm text-[var(--text-muted)]">Loading your day…</p>
      </div>
    );
  }
  if (error) return null;

  const c = data?.counts || {};
  const total = (c.overdue || 0) + (c.upcoming || 0) + (c.blocked || 0) + (c.pendingMyApprovals || 0) + (c.gatesIBlock || 0);

  if (total === 0) {
    return (
      <div className="bg-[var(--success)]/8 border border-[var(--success)]/30 rounded-2xl p-4 lg:p-5 flex items-center gap-3">
        <CheckCircle2 size={22} className="text-[var(--success)] shrink-0" />
        <div>
          <p className="text-sm font-bold text-[var(--success)]">All clear, {user?.name?.split(' ')[0] || ''}.</p>
          <p className="text-xs text-[var(--text-muted)]">Nothing in your queue right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 lg:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sun size={18} className="text-[var(--warning)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">My Day</h3>
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
            {total} item{total === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section icon={<AlertTriangle size={13} />} title="Overdue" count={c.overdue || 0} tone="error">
          {(data?.overdueTasks || []).slice(0, 4).map((t) => (
            <Row
              key={t._id}
              title={t.title}
              subtitle={`${t.projectId?.trackingId || ''} · ${t.taskType}`}
              right={<span className="text-[10px] font-bold text-[var(--error)]">{fmtDue(t.dueDate)}</span>}
              onClick={() => navigate(`/tasks/${t._id}`)}
            />
          ))}
        </Section>

        <Section icon={<Clock size={13} />} title="Upcoming" count={c.upcoming || 0} tone="warning">
          {(data?.upcomingTasks || []).slice(0, 4).map((t) => (
            <Row
              key={t._id}
              title={t.title}
              subtitle={`${t.projectId?.trackingId || ''} · ${t.taskType}`}
              right={<span className="text-[10px] font-bold text-[var(--warning)]">{fmtDue(t.dueDate)}</span>}
              onClick={() => navigate(`/tasks/${t._id}`)}
            />
          ))}
        </Section>

        <Section icon={<Lock size={13} />} title="Blocked" count={c.blocked || 0} tone="warning">
          {(data?.blockedTasks || []).slice(0, 4).map((t) => (
            <Row
              key={t._id}
              title={t.title}
              subtitle={`${t.projectId?.trackingId || ''} · waiting on prereq`}
              right={<span className="text-[10px] font-black text-[var(--warning)] uppercase">Blocked</span>}
              onClick={() => navigate(`/tasks/${t._id}`)}
            />
          ))}
        </Section>

        <Section icon={<Eye size={13} />} title="PD reviews" count={c.pendingMyApprovals || 0} tone="primary">
          {(data?.pendingMyApprovals || []).slice(0, 4).map((a) => (
            <Row
              key={a._id}
              title={`Review on ${a.targetType}`}
              subtitle={a.projectId?.trackingId || ''}
              right={<span className="text-[10px] font-black text-[var(--primary)] uppercase">Pending</span>}
              onClick={() => navigate(`/drawings/pending-approvals`)}
            />
          ))}
        </Section>

        <Section icon={<Lock size={13} />} title="Open gates on my projects" count={c.gatesIBlock || 0} tone="accent">
          {(data?.gatesIBlock || []).slice(0, 6).map((g) => (
            <Row
              key={g._id}
              title={g.label}
              subtitle={`${g.projectId?.trackingId || ''} · open ${g.ageingDays}d`}
              right={
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--accent-blue)] bg-[var(--accent-blue)]/10 px-1.5 py-0.5 rounded">
                  {g.approverType.replace('_', ' ')}
                </span>
              }
              onClick={() => navigate(`/projects/${g.projectId?._id || g.projectId}`)}
            />
          ))}
        </Section>
      </div>
    </div>
  );
};

export default MyDayWidget;
