import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Calendar, MapPin, Briefcase, ArrowRight, AlertTriangle } from 'lucide-react';

/**
 * ProjectHealthGrid — card grid of projects sorted by health (delayed → blocked
 * → at_risk → on_hold → on_track). Mirrors the ProjectCard layout from
 * ProjectsPage so the MD sees the same visual language across surfaces.
 */

const HEALTH_ACCENT = {
  delayed:  'from-[var(--error)] via-[var(--error)]/80 to-transparent',
  blocked:  'from-[var(--error)] via-[var(--error)]/80 to-transparent',
  at_risk:  'from-[var(--warning)] via-[var(--warning)]/80 to-transparent',
  on_hold:  'from-[var(--text-muted)] via-[var(--text-muted)]/80 to-transparent',
  on_track: 'from-[var(--primary)] via-[var(--primary)]/80 to-transparent',
};

const HEALTH_BADGE = {
  delayed:  { label: 'Delayed', cls: 'bg-[var(--error)]/12 text-[var(--error)] border border-[var(--error)]/25' },
  blocked:  { label: 'Blocked', cls: 'bg-[var(--error)]/12 text-[var(--error)] border border-[var(--error)]/25' },
  at_risk:  { label: 'At Risk', cls: 'bg-[var(--warning)]/12 text-[var(--warning)] border border-[var(--warning)]/25' },
  on_hold:  { label: 'On Hold', cls: 'bg-[var(--text-muted)]/15 text-[var(--text-muted)] border border-[var(--border)]' },
  on_track: { label: 'On Track', cls: 'bg-[var(--success)]/12 text-[var(--success)] border border-[var(--success)]/25' },
};

const dueChip = (dateStr) => {
  if (!dateStr) return { label: 'No due date', tone: 'muted' };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(dateStr); due.setHours(0, 0, 0, 0);
  const days  = Math.round((due - today) / 86400000);
  if (days < 0)   return { label: `Overdue ${Math.abs(days)}d`, tone: 'error' };
  if (days === 0) return { label: 'Due today',                  tone: 'warning' };
  if (days <= 7)  return { label: `Due in ${days}d`,            tone: 'warning' };
  if (days <= 30) return { label: `Due in ${days}d`,            tone: 'default' };
  return {
    label: new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    tone:  'default',
  };
};

const DUE_TONE = {
  muted:   'text-[var(--text-muted)]',
  default: 'text-[var(--text-secondary)]',
  warning: 'text-[var(--warning)]',
  error:   'text-[var(--error)]',
};

const fillByHealth = (health) =>
  health === 'delayed' || health === 'blocked' ? 'var(--error)' :
  health === 'at_risk'                         ? 'var(--warning)' :
  health === 'on_hold'                         ? 'var(--text-muted)' :
  'var(--primary)';

const TeamStack = ({ users = [], max = 4 }) => {
  if (!users.length) return null;
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((u, i) => (
        <div
          key={u._id || i}
          title={u.name}
          className="w-7 h-7 rounded-full ring-2 ring-[var(--surface)] flex items-center justify-center
                     bg-gradient-to-br from-[var(--primary)]/30 to-[var(--primary)]/10
                     text-[10px] font-black uppercase text-[var(--text-primary)]"
          style={{ zIndex: shown.length - i }}
        >
          {u.name?.[0] || '?'}
        </div>
      ))}
      {extra > 0 && (
        <div className="w-7 h-7 rounded-full ring-2 ring-[var(--surface)]
                        bg-[var(--bg)] border border-[var(--border)]
                        flex items-center justify-center text-[10px] font-bold text-[var(--text-secondary)]">
          +{extra}
        </div>
      )}
    </div>
  );
};

const ProjectCard = ({ project }) => {
  const navigate = useNavigate();
  const accent   = HEALTH_ACCENT[project.health] || HEALTH_ACCENT.on_track;
  const badge    = HEALTH_BADGE[project.health]  || HEALTH_BADGE.on_track;
  const due      = dueChip(project.estimatedCompletionDate);
  const fill     = fillByHealth(project.health);
  const pct      = Math.max(0, Math.min(100, project.progressPercent || 0));

  return (
    <button
      type="button"
      onClick={() => navigate(`/projects/${project._id}`)}
      className="group relative text-left bg-[var(--surface)] border border-[var(--border)]
                 rounded-2xl overflow-hidden transition-all
                 hover:border-[var(--primary)]/40 hover:shadow-sm"
    >
      {/* Phase / health accent strip */}
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />

      <div className="p-4 lg:p-5 space-y-3">
        {/* Tracking ID + health badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              {project.trackingId}
            </p>
            <h3 className="text-sm lg:text-base font-extrabold text-[var(--text-primary)] truncate mt-0.5">
              {project.name}
            </h3>
          </div>
          <span className={`shrink-0 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${badge.cls}`}>
            {badge.label}
          </span>
        </div>

        {/* Client + Meta */}
        {project.clientName && (
          <p className="text-xs text-[var(--text-secondary)] truncate">
            <span className="text-[var(--text-muted)]">Client:</span>{' '}
            <span className="font-semibold text-[var(--text-primary)]">{project.clientName}</span>
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {project.city && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-secondary)] bg-[var(--bg)] border border-[var(--border)] rounded-md px-1.5 py-0.5">
              <MapPin size={9} /> {project.city}
            </span>
          )}
          {project.projectType && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-secondary)] bg-[var(--bg)] border border-[var(--border)] rounded-md px-1.5 py-0.5">
              <Briefcase size={9} /> {project.projectType}{project.area ? ` · ${project.area} sqft` : ''}
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-[var(--border)]" />

        {/* Team + Due */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <TeamStack users={project.team || []} />
            {project.leadDesignerName && (
              <span className="text-[10px] text-[var(--text-muted)] truncate">
                Lead: <span className="text-[var(--text-secondary)] font-semibold">{project.leadDesignerName}</span>
              </span>
            )}
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${DUE_TONE[due.tone]}`}>
            <Calendar size={10} /> {due.label}
          </span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-[var(--bg)] border border-[var(--border)] overflow-hidden">
            <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: fill }} />
          </div>
          <span className="shrink-0 text-[11px] font-extrabold tabular-nums text-[var(--text-primary)]">
            {pct}%
          </span>
        </div>
      </div>
    </button>
  );
};

const ProjectHealthGrid = React.forwardRef(({ projects = [], healthSummary }, ref) => {
  const navigate = useNavigate();

  const chips = healthSummary ? [
    { label: `${healthSummary.delayed || 0} Delayed`, cls: 'bg-[var(--error)]/12 text-[var(--error)]', show: (healthSummary.delayed || 0) > 0 },
    { label: `${healthSummary.atRisk  || 0} At Risk`, cls: 'bg-[var(--warning)]/12 text-[var(--warning)]', show: (healthSummary.atRisk || 0) > 0 },
    { label: `${healthSummary.blocked || 0} Blocked`, cls: 'bg-[var(--error)]/12 text-[var(--error)]', show: (healthSummary.blocked || 0) > 0 },
    { label: `${healthSummary.onHold  || 0} On Hold`, cls: 'bg-[var(--text-muted)]/15 text-[var(--text-muted)]', show: (healthSummary.onHold || 0) > 0 },
    { label: `${healthSummary.onTrack || 0} On Track`, cls: 'bg-[var(--success)]/12 text-[var(--success)]', show: (healthSummary.onTrack || 0) > 0 },
  ] : [];

  return (
    <div ref={ref} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden scroll-mt-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-5 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 min-w-0">
          <Heart size={16} className="text-[var(--primary)]" />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Project Health — Needs Your Attention</h3>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Delayed and at-risk projects first</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.filter((c) => c.show).map((c) => (
            <span key={c.label} className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${c.cls}`}>
              {c.label}
            </span>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="p-4 lg:p-5">
        {projects.length === 0 ? (
          <div className="py-10 text-center">
            <AlertTriangle size={28} className="mx-auto text-[var(--text-muted)] opacity-70 mb-2" />
            <p className="text-sm text-[var(--text-muted)]">No active projects to display.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            {projects.map((p) => <ProjectCard key={p._id} project={p} />)}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end px-5 py-3 border-t border-[var(--border)] bg-[var(--bg)]/40">
        <button
          type="button"
          onClick={() => navigate('/projects')}
          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
        >
          View all projects <ArrowRight size={11} />
        </button>
      </div>
    </div>
  );
});

ProjectHealthGrid.displayName = 'ProjectHealthGrid';

export default ProjectHealthGrid;
