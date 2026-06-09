import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Palette, AlertTriangle, Clock, GitBranch, FileText, Briefcase, MapPin,
  Play, Send, CheckCircle2, ArrowRight, Lock, Hourglass, Eye, PartyPopper,
  ListChecks, PencilLine, Zap,
} from 'lucide-react';
import { Loader } from '../../../shared/components';
import { useAuth } from '../../../shared/context/AuthContext';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';
import useDesignerDashboard from '../hooks/useDesignerDashboard';
import PriorityBadge from '../components/PriorityBadge';
import DrawingStatusBadge from '../components/DrawingStatusBadge';

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const endOfToday   = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; };

// Whole-day signed difference: <0 overdue, 0 today, >0 future.
const dayDiff = (dueDate) => {
  if (!dueDate) return null;
  const d = new Date(dueDate); d.setHours(0, 0, 0, 0);
  return Math.round((d - startOfToday()) / 86400000);
};
const dueStatusText = (dueDate) => {
  const diff = dayDiff(dueDate);
  if (diff == null) return 'No due date';
  if (diff < 0)  return `Overdue by ${-diff} day${-diff > 1 ? 's' : ''}`;
  if (diff === 0) return 'Due today';
  return `Due in ${diff} day${diff > 1 ? 's' : ''}`;
};
const dueMeta = (dueDate) => {
  if (!dueDate) return { label: 'No due date', tone: 'none' };
  const d = new Date(dueDate);
  if (d < startOfToday()) return { label: `Overdue · ${fmt(dueDate)}`, tone: 'overdue' };
  if (d <= endOfToday())  return { label: 'Due today', tone: 'today' };
  return { label: fmt(dueDate), tone: 'upcoming' };
};
const TONE_COLOR = {
  overdue: 'var(--error)', today: 'var(--warning)', upcoming: 'var(--text-muted)', none: 'var(--border)',
};

const sameId = (a, b) => a && b && String(a) === String(b);

// ── Small inline action button ───────────────────────────────────────────────
const ActionBtn = ({ icon: Icon, label, onClick, busy, variant = 'primary', size = 'sm' }) => {
  const styles = variant === 'primary'
    ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] border-transparent'
    : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--border)]/40 border-[var(--border)]';
  const pad = size === 'lg' ? 'text-sm px-4 py-2' : 'text-xs px-2.5 py-1.5';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 font-bold rounded-lg border transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ${pad} ${styles}`}
    >
      {Icon && <Icon size={size === 'lg' ? 15 : 13} />}
      {label}
    </button>
  );
};

// ── Section wrapper ──────────────────────────────────────────────────────────
const Section = ({ icon: Icon, title, count, color = 'var(--text-secondary)', action, children, className = '' }) => (
  <div className={`bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 ${className}`}>
    <div className="flex items-center gap-2 mb-3">
      {Icon && <Icon size={14} style={{ color }} />}
      <h2 className="text-sm font-black uppercase tracking-wider" style={{ color }}>{title}</h2>
      {count != null && (
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
          style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
          {count}
        </span>
      )}
      {action && <div className="ml-auto">{action}</div>}
    </div>
    {children}
  </div>
);

const emptyHint = (Icon, text) => (
  <div className="text-center py-6 text-[var(--text-muted)]">
    <Icon size={22} className="mx-auto mb-2 opacity-20" />
    <p className="text-xs">{text}</p>
  </div>
);

// ── Recommended Next Action hero (focal point) ───────────────────────────────
const RecommendedHero = ({ recommended, busy, runAction, navigate }) => {
  const { type, item } = recommended;
  const isTask = type === 'task';
  const title = isTask ? item.title : (item.drawingId?.title || 'Drawing revision');
  const projectName = item.projectId?.name || '—';
  const dueDate = isTask ? item.dueDate : item.deadline;
  const diff = dayDiff(dueDate);
  const urgent = diff != null && diff <= 0;
  const statusColor = diff == null ? 'var(--text-muted)' : diff < 0 ? 'var(--error)' : diff === 0 ? 'var(--warning)' : 'var(--text-muted)';

  let primary;
  if (isTask) {
    const isStart = item.status === 'not_started';
    const key = `task:${item._id}`;
    primary = (
      <ActionBtn
        size="lg" icon={isStart ? Play : Send} label={isStart ? 'Start' : 'Submit for Review'} busy={busy === key}
        onClick={() => runAction(
          key,
          isStart ? () => pmsService.updateTask(item._id, { status: 'in_progress' }) : () => pmsService.submitTask(item._id, {}),
          isStart ? 'Task started' : 'Submitted for review',
        )}
      />
    );
  } else {
    primary = <ActionBtn size="lg" icon={PencilLine} label="Open & Revise" onClick={() => navigate('/drawings')} />;
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 border lg:col-span-2"
      style={{
        borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 12%, var(--surface)), var(--surface) 75%)',
      }}
    >
      <div className="absolute -right-6 -top-6 opacity-10">
        <Zap size={120} className="text-[var(--primary)]" />
      </div>
      <div className="relative">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap size={13} className="text-[var(--primary)]" />
          <span className="text-[11px] font-black uppercase tracking-widest text-[var(--primary)]">
            Recommended next action
          </span>
        </div>
        <h2 className="text-xl font-extrabold text-[var(--text-primary)] leading-tight truncate">{title}</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5 truncate">{projectName}</p>

        <div className="flex items-center gap-2 flex-wrap mt-3">
          <span
            className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: `color-mix(in srgb, ${statusColor} 12%, transparent)`, color: statusColor }}
          >
            {urgent && <AlertTriangle size={12} />}
            {type === 'revision' ? `Revision · ${dueStatusText(dueDate)}` : dueStatusText(dueDate)}
          </span>
          {isTask && <PriorityBadge priority={item.priority} />}
          {!isTask && item.requestedBy?.name && (
            <span className="text-xs text-[var(--text-muted)]">by {item.requestedBy.name}</span>
          )}
        </div>

        <div className="mt-4">{primary}</div>
      </div>
    </div>
  );
};

// ── Refined Action Queue row ─────────────────────────────────────────────────
const QueueRow = ({ task, busy, runAction, navigate }) => {
  const meta = dueMeta(task.dueDate);
  const isStart = task.status === 'not_started';
  const key = `task:${task._id}`;
  return (
    <div className="flex items-stretch gap-3 group">
      <div className="w-[3px] rounded-full my-2 shrink-0" style={{ background: TONE_COLOR[meta.tone] }} />
      <div className="flex items-center gap-3 flex-1 min-w-0 py-2.5 border-b border-[var(--border)] group-last:border-0">
        <button
          type="button"
          onClick={() => task.projectId?._id && navigate(`/projects/${task.projectId._id}`)}
          className="flex-1 min-w-0 text-left"
        >
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{task.title}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--border)]/50 text-[var(--text-secondary)] truncate max-w-[150px]">
              {task.projectId?.name || '—'}
            </span>
            {task.status === 'revision_requested' && (
              <span className="text-[10px] font-bold text-[var(--error)]">changes requested</span>
            )}
          </div>
        </button>
        <span className="text-xs font-semibold shrink-0 hidden sm:block" style={{ color: TONE_COLOR[meta.tone] }}>
          {meta.label}
        </span>
        <PriorityBadge priority={task.priority} />
        <div className="w-[88px] flex justify-end shrink-0">
          <ActionBtn
            icon={isStart ? Play : Send} label={isStart ? 'Start' : 'Submit'} busy={busy === key}
            onClick={() => runAction(
              key,
              isStart ? () => pmsService.updateTask(task._id, { status: 'in_progress' }) : () => pmsService.submitTask(task._id, {}),
              isStart ? 'Task started' : 'Submitted for review',
            )}
          />
        </div>
      </div>
    </div>
  );
};

// ── Project Health card ──────────────────────────────────────────────────────
const ProjectHealthCard = ({ project, actionQueue, drawingsInReview, navigate }) => {
  const pct = Math.max(0, Math.min(100, project.progressPercent ?? 0));
  const overdueCount = actionQueue.filter(
    (t) => t.dueDate && new Date(t.dueDate) < startOfToday() && sameId(t.projectId?._id, project._id)
  ).length;
  const inReviewCount = drawingsInReview.filter((d) => sameId(d.projectId?._id, project._id)).length;
  const approvalsPending = (project.clientApprovals || []).filter((a) => a.status === 'pending').length;
  const phaseLabel = (project.phase || project.status || '').replace(/_/g, ' ');

  return (
    <button
      type="button"
      onClick={() => navigate(`/projects/${project._id}`)}
      className="w-full text-left bg-[var(--bg)] border border-[var(--border)] rounded-xl p-3
                 hover:border-[var(--primary)]/40 transition-all"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{project.name}</p>
        <span className="text-[10px] font-bold capitalize shrink-0 px-1.5 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)]">
          {phaseLabel || '—'}
        </span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
          <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-bold text-[var(--text-secondary)] shrink-0">{pct}%</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {overdueCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--error)]/10 text-[var(--error)]">
            <AlertTriangle size={10} /> {overdueCount} overdue
          </span>
        )}
        {inReviewCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--warning)]/10 text-[var(--warning)]">
            <Hourglass size={10} /> {inReviewCount} in review
          </span>
        )}
        {approvalsPending > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]">
            <Clock size={10} /> {approvalsPending} approval{approvalsPending > 1 ? 's' : ''}
          </span>
        )}
        {overdueCount === 0 && inReviewCount === 0 && approvalsPending === 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--accent-green)]/10 text-[var(--accent-green)]">
            <CheckCircle2 size={10} /> on track
          </span>
        )}
      </div>
    </button>
  );
};

// Urgency grouping for the action queue.
const QUEUE_GROUPS = [
  { key: 'overdue',  label: 'Overdue',   test: (d) => d && new Date(d) < startOfToday() },
  { key: 'today',    label: 'Due today', test: (d) => { const x = d && new Date(d); return x && x >= startOfToday() && x <= endOfToday(); } },
  { key: 'upcoming', label: 'Upcoming',  test: (d) => !d || new Date(d) > endOfToday() },
];

// ── Main page ────────────────────────────────────────────────────────────────
const DesignerDashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { data, isLoading, error, refresh } = useDesignerDashboard();

  const [busy, setBusy] = useState(null);
  const [queueFilter, setQueueFilter] = useState('all'); // all | overdue | today

  const runAction = useCallback(async (key, fn, successMsg) => {
    setBusy(key);
    try {
      await fn();
      if (successMsg) toast.success(successMsg);
      await refresh();
    } catch (e) {
      toast.error(typeof e === 'string' ? e : (e?.message || 'Action failed'));
    } finally {
      setBusy(null);
    }
  }, [refresh, toast]);

  const {
    ribbon, actionQueue = [], blockedTasks = [], actionableDrawings = [],
    drawingsInReview = [], todaysSiteVisits = [], reviewsWaitingOnMe = [],
    pendingRevisionRequests = [], activeProjects = [], capabilities = {},
  } = data || {};

  const filteredQueue = useMemo(() => {
    if (queueFilter === 'overdue') return actionQueue.filter((t) => t.dueDate && new Date(t.dueDate) < startOfToday());
    if (queueFilter === 'today')   return actionQueue.filter((t) => {
      const d = t.dueDate && new Date(t.dueDate);
      return d && d >= startOfToday() && d <= endOfToday();
    });
    return actionQueue;
  }, [actionQueue, queueFilter]);

  // Recommended next action: overdue → today → revision → high upcoming.
  const recommended = useMemo(() => {
    const sot = startOfToday(), eot = endOfToday();
    const overdue = actionQueue.find((t) => t.dueDate && new Date(t.dueDate) < sot);
    if (overdue) return { type: 'task', item: overdue };
    const today = actionQueue.find((t) => {
      const d = t.dueDate && new Date(t.dueDate); return d && d >= sot && d <= eot;
    });
    if (today) return { type: 'task', item: today };
    if (pendingRevisionRequests.length) {
      const byDeadline = [...pendingRevisionRequests].sort(
        (a, b) => (a.deadline ? new Date(a.deadline) : Infinity) - (b.deadline ? new Date(b.deadline) : Infinity)
      );
      return { type: 'revision', item: byDeadline[0] };
    }
    const highUpcoming = actionQueue.find((t) => t.priority === 'high' || t.priority === 'urgent');
    if (highUpcoming) return { type: 'task', item: highUpcoming };
    if (actionQueue.length) return { type: 'task', item: actionQueue[0] };
    return null;
  }, [actionQueue, pendingRevisionRequests]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader /></div>;
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertTriangle size={32} className="text-[var(--error)] opacity-60" />
        <p className="text-sm text-[var(--text-muted)]">{error}</p>
        <button type="button" onClick={refresh} className="text-xs text-[var(--primary)] hover:underline font-semibold">Try again</button>
      </div>
    );
  }

  const nothingToDo =
    !actionQueue.length && !pendingRevisionRequests.length && !actionableDrawings.length &&
    !todaysSiteVisits.length && !blockedTasks.length && !drawingsInReview.length;

  // KPI cluster (compact; Overdue/Today double as filters).
  const kpis = [
    { key: 'overdue',   label: 'Overdue',   value: ribbon?.overdue ?? 0,   color: 'var(--error)',      icon: AlertTriangle, filter: 'overdue' },
    { key: 'today',     label: 'Due Today', value: ribbon?.dueToday ?? 0,  color: 'var(--warning)',    icon: Clock,         filter: 'today' },
    { key: 'blocked',   label: 'Blocked',   value: ribbon?.blocked ?? 0,   color: 'var(--text-muted)', icon: Lock },
    { key: 'revisions', label: 'Revisions', value: ribbon?.revisions ?? 0, color: 'var(--primary)',    icon: GitBranch },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center">
            <Palette size={20} className="text-[var(--primary)]" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[var(--text-primary)]">My Design Dashboard</h1>
            <p className="text-xs text-[var(--text-muted)]">
              {user?.name && <span className="font-semibold">{user.name} · </span>}
              What needs your action today
            </p>
          </div>
        </div>
        <button type="button" onClick={refresh}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] font-semibold transition-colors">
          Refresh
        </button>
      </div>

      {/* ── ZONE 1 · Pulse band: Recommended action + compact KPI cluster ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {recommended ? (
          <RecommendedHero recommended={recommended} busy={busy} runAction={runAction} navigate={navigate} />
        ) : (
          <div className="lg:col-span-2 rounded-2xl p-5 border border-[var(--border)] bg-[var(--surface)] flex items-center gap-3">
            <PartyPopper size={28} className="text-[var(--accent-green)]" />
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">You're all caught up.</p>
              <p className="text-xs text-[var(--text-muted)]">No action needs your attention right now.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:col-span-1">
          {kpis.map((c) => {
            const filterable = !!c.filter;
            const active = filterable && queueFilter === c.filter;
            const Icon = c.icon;
            return (
              <button
                key={c.key}
                type="button"
                disabled={!filterable}
                onClick={() => filterable && setQueueFilter(active ? 'all' : c.filter)}
                className={`flex flex-col justify-between rounded-xl p-3 border text-left transition-all min-h-[72px]
                  ${filterable ? 'cursor-pointer hover:border-[var(--primary)]/40' : 'cursor-default'}
                  ${active ? 'ring-2 ring-[var(--primary)]/50' : ''}`}
                style={{
                  background: `color-mix(in srgb, ${c.color} ${c.value > 0 ? 7 : 4}%, transparent)`,
                  borderColor: `color-mix(in srgb, ${c.color} 22%, transparent)`,
                }}
              >
                <div className="flex items-center justify-between">
                  <Icon size={14} style={{ color: c.color }} />
                  {filterable && active && <span className="text-[9px] font-bold text-[var(--primary)]">filtering</span>}
                </div>
                <div>
                  <span className="text-2xl font-black leading-none" style={{ color: c.color }}>{c.value}</span>
                  <p className="text-[11px] font-bold text-[var(--text-secondary)] mt-0.5">{c.label}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Caught-up state ────────────────────────────────────────────────── */}
      {nothingToDo ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <PartyPopper size={36} className="mx-auto mb-3 text-[var(--accent-green)] opacity-70" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">Nothing needs your action.</p>
          <p className="text-xs mt-1">New tasks, revisions and visits will appear here.</p>
        </div>
      ) : (
        <>
          {/* ── ZONE 2 · Action Queue (primary) + Project Health rail ──────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

            <div className="lg:col-span-2">
              <Section
                icon={ListChecks} title="My Action Queue" count={filteredQueue.length} color="var(--primary)"
                action={
                  <button type="button" onClick={() => navigate('/tasks')}
                    className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline font-semibold">
                    All tasks <ArrowRight size={11} />
                  </button>
                }
              >
                {filteredQueue.length ? (
                  QUEUE_GROUPS.map((g) => {
                    const rows = filteredQueue.filter((t) => g.test(t.dueDate));
                    if (!rows.length) return null;
                    return (
                      <div key={g.key} className="mb-1 last:mb-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mt-2 mb-0.5">
                          {g.label} ({rows.length})
                        </p>
                        {rows.map((t) => (
                          <QueueRow key={t._id} task={t} busy={busy} runAction={runAction} navigate={navigate} />
                        ))}
                      </div>
                    );
                  })
                ) : emptyHint(CheckCircle2, queueFilter === 'all'
                  ? 'No actionable tasks right now.'
                  : `Nothing ${queueFilter === 'overdue' ? 'overdue' : 'due today'}.`)}
              </Section>
            </div>

            {/* Project Health rail */}
            <div className="lg:col-span-1">
              <Section icon={Briefcase} title="Project Health" count={activeProjects.length} color="var(--text-secondary)">
                {activeProjects.length ? (
                  <div className="space-y-2.5">
                    {activeProjects.map((p) => (
                      <ProjectHealthCard
                        key={p._id} project={p}
                        actionQueue={actionQueue} drawingsInReview={drawingsInReview} navigate={navigate}
                      />
                    ))}
                  </div>
                ) : emptyHint(Briefcase, 'No active projects assigned.')}
              </Section>
            </div>
          </div>

          {/* ── ZONE 3 · Secondary worklists (unchanged behavior) ──────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Revisions to redo */}
            <Section icon={GitBranch} title="Revisions to Redo" count={pendingRevisionRequests.length} color="var(--error)">
              {pendingRevisionRequests.length ? (
                <div className="space-y-2.5">
                  {pendingRevisionRequests.map((req) => {
                    const key = `rev:${req._id}`;
                    return (
                      <div key={req._id} className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                              <span className="text-[10px] font-black uppercase tracking-wide text-[var(--error)] bg-[var(--error)]/10 px-1.5 py-0.5 rounded mr-1.5">Rev</span>
                              {req.drawingId?.title || 'Drawing'}{' '}
                              <span className="text-[var(--text-muted)] font-normal text-xs">v{req.drawingId?.version}</span>
                            </p>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">
                              by <span className="font-semibold">{req.requestedBy?.name}</span>
                              {req.projectId?.name && ` · ${req.projectId.name}`}
                            </p>
                          </div>
                          {req.deadline && (
                            <span className="text-[10px] font-bold text-[var(--error)] shrink-0 bg-[var(--error)]/10 px-2 py-0.5 rounded-full">
                              Due {fmt(req.deadline)}
                            </span>
                          )}
                        </div>
                        {req.revisionNotes && (
                          <p className="text-xs text-[var(--text-secondary)] leading-snug">{req.revisionNotes}</p>
                        )}
                        <div className="flex items-center gap-2 pt-0.5">
                          <ActionBtn icon={PencilLine} label="Open & Revise" variant="ghost" onClick={() => navigate('/drawings')} />
                          <ActionBtn icon={CheckCircle2} label="Mark Resolved" busy={busy === key}
                            onClick={() => runAction(key, () => pmsService.resolveRevisionRequest(req._id), 'Revision resolved')} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : emptyHint(CheckCircle2, 'No revision requests. Nice.')}
            </Section>

            {/* Waiting on others */}
            <Section icon={Hourglass} title="Waiting on Others" count={blockedTasks.length + drawingsInReview.length} color="var(--text-muted)">
              {(blockedTasks.length || drawingsInReview.length) ? (
                <div>
                  {blockedTasks.map((t) => (
                    <div key={t._id} className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
                      <Lock size={14} className="text-[var(--error)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{t.title}</p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{t.projectId?.name || '—'} · blocked by approval gate</p>
                      </div>
                      <button type="button" onClick={() => t.projectId?._id && navigate(`/projects/${t.projectId._id}`)}
                        className="text-xs text-[var(--primary)] hover:underline font-semibold shrink-0">View</button>
                    </div>
                  ))}
                  {drawingsInReview.map((d) => (
                    <div key={d._id} className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
                      <Hourglass size={14} className="text-[var(--warning)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{d.title}</p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{d.projectId?.name || '—'} · v{d.version} · awaiting approval</p>
                      </div>
                      <DrawingStatusBadge status={d.status} />
                    </div>
                  ))}
                </div>
              ) : emptyHint(Hourglass, 'Nothing waiting on anyone else.')}
            </Section>
          </div>

          {/* ── Drawings to action | Site visits ───────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section icon={FileText} title="Drawings to Action" count={actionableDrawings.length} color="var(--accent-blue)"
              action={
                <button type="button" onClick={() => navigate('/drawings')}
                  className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline font-semibold">
                  Library <ArrowRight size={11} />
                </button>
              }>
              {actionableDrawings.length ? (
                <div>
                  {actionableDrawings.map((d) => {
                    const key = `draw:${d._id}`;
                    const isDraft = d.status === 'draft';
                    return (
                      <div key={d._id} className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{d.title}</p>
                          <p className="text-xs text-[var(--text-muted)] truncate">
                            {d.projectId?.name || '—'} · v{d.version}
                            {!isDraft && d.rejectionReason && <span className="text-[var(--error)]"> · {d.rejectionReason}</span>}
                          </p>
                        </div>
                        <DrawingStatusBadge status={d.status} />
                        {isDraft ? (
                          <ActionBtn icon={Send} label="Send" busy={busy === key}
                            onClick={() => runAction(key, () => pmsService.sendForApproval(d._id), 'Sent for approval')} />
                        ) : (
                          <ActionBtn icon={PencilLine} label="Revise" variant="ghost" onClick={() => navigate('/drawings')} />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : emptyHint(FileText, 'No drafts or rejected drawings.')}
            </Section>

            <Section icon={MapPin} title="Site Visits" count={todaysSiteVisits.length} color="var(--accent-teal)"
              action={
                <button type="button" onClick={() => navigate('/calendar')}
                  className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline font-semibold">
                  Calendar <ArrowRight size={11} />
                </button>
              }>
              {todaysSiteVisits.length ? (
                <div>
                  {todaysSiteVisits.map((v) => {
                    const key = `visit:${v._id}`;
                    const today = new Date(v.visitDate) <= endOfToday();
                    return (
                      <div key={v._id} className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{v.purpose}</p>
                          <p className="text-xs text-[var(--text-muted)] truncate">{v.projectId?.name || '—'}</p>
                        </div>
                        <span className={`text-xs font-semibold shrink-0 ${today ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]'}`}>
                          {today ? 'Today' : fmt(v.visitDate)}
                        </span>
                        <ActionBtn icon={CheckCircle2} label="Done" busy={busy === key}
                          onClick={() => runAction(key, () => pmsService.updateSiteVisit(v._id, { status: 'completed' }), 'Visit marked complete')} />
                      </div>
                    );
                  })}
                </div>
              ) : emptyHint(MapPin, 'No site visits in the next 7 days.')}
            </Section>
          </div>

          {/* ── Reviews waiting on me (leads / PD only) ────────────────────── */}
          {capabilities.canReview && reviewsWaitingOnMe.length > 0 && (
            <Section icon={Eye} title="Reviews Waiting on Me" count={reviewsWaitingOnMe.length} color="var(--accent-blue)">
              <div>
                {reviewsWaitingOnMe.map((a) => (
                  <div key={a._id} className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
                    <Eye size={14} className="text-[var(--accent-blue)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)] capitalize truncate">{a.targetType} review</p>
                      <p className="text-xs text-[var(--text-muted)] truncate">{a.projectId?.name || '—'}</p>
                    </div>
                    <ActionBtn icon={Eye} label="Review" variant="ghost" onClick={() => navigate('/drawings')} />
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
};

export default DesignerDashboardPage;
