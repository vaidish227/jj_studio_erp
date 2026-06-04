import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GitBranch, ArrowRight, Calendar } from 'lucide-react';

/**
 * ActiveProjectsTimeline — simplified Gantt: one row per project, the bar
 * represents the planned span (startDate → estimatedCompletionDate) and the
 * inner fill shows progress against that span. Colour reflects health.
 */

const PHASE_COLOR = {
  kickoff:     'text-[var(--text-muted)] bg-[var(--text-muted)]/12',
  layout:      'text-[var(--accent-teal)] bg-[var(--accent-teal)]/12',
  design:      'text-[var(--primary)] bg-[var(--primary)]/12',
  procurement: 'text-[var(--accent-blue)] bg-[var(--accent-blue)]/12',
  release:     'text-[var(--warning)] bg-[var(--warning)]/12',
  execution:   'text-[var(--success)] bg-[var(--success)]/12',
  handover:    'text-[#9333ea] bg-[#9333ea]/12',
};

const HEALTH_FILL = {
  on_track: 'var(--primary)',
  at_risk:  'var(--warning)',
  blocked:  'var(--error)',
  on_hold:  'var(--text-muted)',
};

const fmtShort = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  : '—';

const daysFromNow = (d) => {
  if (!d) return null;
  return Math.round((new Date(d) - Date.now()) / 86400000);
};

const PhaseChip = ({ phase }) => (
  <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${PHASE_COLOR[phase] || PHASE_COLOR.kickoff}`}>
    {phase || 'kickoff'}
  </span>
);

const ETALabel = ({ estimatedCompletionDate }) => {
  const d = daysFromNow(estimatedCompletionDate);
  if (d === null) return <span className="text-[10px] text-[var(--text-muted)]">No ETA</span>;
  if (d < 0)      return <span className="text-[10px] font-bold text-[var(--error)]">Overdue {Math.abs(d)}d</span>;
  if (d === 0)   return <span className="text-[10px] font-bold text-[var(--warning)]">Due today</span>;
  if (d <= 7)    return <span className="text-[10px] font-bold text-[var(--warning)]">{d}d left</span>;
  return <span className="text-[10px] font-bold text-[var(--text-muted)]">{d}d left</span>;
};

const ProgressBar = ({ project }) => {
  const progress = Math.max(0, Math.min(100, project.progressPercent || 0));
  const fill = HEALTH_FILL[project.health] || HEALTH_FILL.on_track;

  return (
    <div className="relative h-2.5 w-full rounded-full bg-[var(--bg)] overflow-hidden border border-[var(--border)]">
      <div
        className="h-full transition-all duration-500"
        style={{ width: `${progress}%`, background: fill }}
      />
    </div>
  );
};

const ProjectRow = ({ project }) => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(`/projects/${project._id}`)}
      className="w-full text-left grid grid-cols-12 gap-3 px-4 py-3 items-center hover:bg-[var(--bg)]/50 transition-colors"
    >
      {/* Name + tracking ID */}
      <div className="col-span-12 md:col-span-3 min-w-0">
        <p className="text-sm font-bold text-[var(--text-primary)] truncate">{project.name}</p>
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mt-0.5">
          {project.trackingId}
        </p>
      </div>

      {/* Phase chip */}
      <div className="col-span-6 md:col-span-2">
        <PhaseChip phase={project.phase} />
      </div>

      {/* Timeline bar (date range + progress) */}
      <div className="col-span-12 md:col-span-5">
        <ProgressBar project={project} />
        <div className="flex items-center justify-between mt-1 text-[10px] text-[var(--text-muted)] tabular-nums">
          <span className="inline-flex items-center gap-1">
            <Calendar size={10} /> {fmtShort(project.startDate)}
          </span>
          <span className="font-semibold text-[var(--text-secondary)]">
            {project.progressPercent || 0}%
          </span>
          <span>{fmtShort(project.estimatedCompletionDate)}</span>
        </div>
      </div>

      {/* ETA + arrow */}
      <div className="col-span-6 md:col-span-2 flex items-center justify-end gap-2">
        <ETALabel estimatedCompletionDate={project.estimatedCompletionDate} />
        <ArrowRight size={14} className="text-[var(--text-muted)] shrink-0" />
      </div>
    </button>
  );
};

const ActiveProjectsTimeline = ({ projects = [] }) => {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <GitBranch size={16} className="text-[var(--primary)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Active Projects Timeline</h3>
        </div>
        <Link
          to="/projects"
          className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors inline-flex items-center gap-1"
        >
          View all <ArrowRight size={11} />
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--text-muted)]">
          No active projects.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {projects.map((p) => (
            <li key={p._id}>
              <ProjectRow project={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ActiveProjectsTimeline;
