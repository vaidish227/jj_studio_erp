import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Palette, CheckSquare, Clock, AlertTriangle, GitBranch,
  FolderOpen, FileText, ArrowRight, Briefcase, Activity,
  TrendingUp,
} from 'lucide-react';
import { Loader } from '../../../shared/components';
import { useAuth } from '../../../shared/context/AuthContext';
import useDesignerDashboard from '../hooks/useDesignerDashboard';
import DesignerStatCard from '../components/DesignerStatCard';
import DrawingStatusTimeline from '../components/DrawingStatusTimeline';
import TaskStatusBadge from '../components/TaskStatusBadge';
import DrawingStatusBadge from '../components/DrawingStatusBadge';
import PriorityBadge from '../components/PriorityBadge';

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';

const isOverdue = (d) => d && new Date(d) < new Date();

// ── Upcoming deadline row ────────────────────────────────────────────────────
const DeadlineRow = ({ task }) => {
  const overdue = isOverdue(task.dueDate);
  return (
    <div className={`flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0
      ${overdue ? 'opacity-90' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{task.title}</p>
        <p className="text-xs text-[var(--text-muted)] truncate">
          {task.projectId?.name || '—'}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <PriorityBadge priority={task.priority} />
        <span className={`text-xs font-semibold ${overdue ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'}`}>
          {fmt(task.dueDate)}
        </span>
      </div>
    </div>
  );
};

// ── Mini drawing row ─────────────────────────────────────────────────────────
const DrawingRow = ({ drawing }) => (
  <div className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
    <div className="w-7 h-7 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center shrink-0">
      <FileText size={13} className="text-[var(--accent-blue)]" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{drawing.title}</p>
      <p className="text-xs text-[var(--text-muted)] truncate">
        {drawing.projectId?.name || '—'} · v{drawing.version}
      </p>
    </div>
    <DrawingStatusBadge status={drawing.status} />
  </div>
);

// ── Revision request card ────────────────────────────────────────────────────
const RevisionCard = ({ req }) => (
  <div className="bg-[var(--error)]/5 border border-[var(--error)]/25 rounded-xl p-4 space-y-2">
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[var(--text-primary)] truncate">
          {req.drawingId?.title || 'Drawing'}{' '}
          <span className="text-[var(--text-muted)] font-normal text-xs">v{req.drawingId?.version}</span>
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          Requested by <span className="font-semibold">{req.requestedBy?.name}</span>
          {req.projectId?.name && ` · ${req.projectId.name}`}
        </p>
      </div>
      {req.deadline && (
        <span className="text-[10px] font-bold text-[var(--error)] shrink-0 bg-[var(--error)]/10 px-2 py-0.5 rounded-full">
          Due {fmt(req.deadline)}
        </span>
      )}
    </div>
    <p className="text-xs text-[var(--text-secondary)] leading-snug">{req.revisionNotes}</p>
    {req.specificItems?.length > 0 && (
      <ul className="space-y-0.5 pl-3">
        {req.specificItems.map((item, i) => (
          <li key={i} className="text-xs text-[var(--text-muted)] list-disc">{item}</li>
        ))}
      </ul>
    )}
  </div>
);

// ── Project mini-card ────────────────────────────────────────────────────────
const ProjectCard = ({ project }) => (
  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 flex items-center gap-3
                  hover:border-[var(--primary)]/40 transition-all">
    <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
      <Briefcase size={14} className="text-[var(--primary)]" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{project.name}</p>
      <p className="text-xs text-[var(--text-muted)] truncate">
        {project.clientId?.name || '—'} · <span className="capitalize">{project.status?.replace('_', ' ')}</span>
      </p>
    </div>
    {project.estimatedCompletionDate && (
      <span className="text-xs text-[var(--text-muted)] shrink-0">{fmt(project.estimatedCompletionDate)}</span>
    )}
  </div>
);

// ── Main page ────────────────────────────────────────────────────────────────
const DesignerDashboardPage = () => {
  const navigate = useNavigate();
  const { user }   = useAuth();
  const { data, isLoading, error, refresh } = useDesignerDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertTriangle size={32} className="text-[var(--error)] opacity-60" />
        <p className="text-sm text-[var(--text-muted)]">{error}</p>
        <button
          type="button"
          onClick={refresh}
          className="text-xs text-[var(--primary)] hover:underline font-semibold"
        >
          Try again
        </button>
      </div>
    );
  }

  const { stats, upcomingDeadlines, overdueTasks, recentDrawings, pendingRevisionRequests, activeProjects } = data || {};

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center">
            <Palette size={20} className="text-[var(--primary)]" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[var(--text-primary)]">My Design Dashboard</h1>
            <p className="text-xs text-[var(--text-muted)]">
              {user?.name && <span className="font-semibold">{user.name} · </span>}
              Personal view — tasks, drawings, deadlines
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] font-semibold transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <DesignerStatCard
          icon={Briefcase}
          label="Active Projects"
          value={stats?.activeProjectsCount ?? 0}
          color="var(--primary)"
          sub="you're assigned to"
        />
        <DesignerStatCard
          icon={Activity}
          label="Active Tasks"
          value={stats?.activeTasksCount ?? 0}
          color="var(--accent-blue)"
          sub="in progress / on hold"
        />
        <DesignerStatCard
          icon={TrendingUp}
          label="Completed"
          value={stats?.completedTasksCount ?? 0}
          color="var(--accent-green)"
          sub="tasks done"
        />
        <DesignerStatCard
          icon={Clock}
          label="Pending Review"
          value={stats?.pendingApprovalDrawings ?? 0}
          color="var(--warning)"
          sub="drawings in review"
        />
        <DesignerStatCard
          icon={GitBranch}
          label="Revisions"
          value={stats?.pendingRevisionsCount ?? 0}
          color="var(--error)"
          sub="pending your action"
        />
        <DesignerStatCard
          icon={AlertTriangle}
          label="Overdue"
          value={stats?.overdueTasksCount ?? 0}
          color="var(--error)"
          sub="past due date"
        />
      </div>

      {/* ── Revision requests alert ───────────────────────────────────────── */}
      {pendingRevisionRequests?.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <GitBranch size={14} className="text-[var(--error)]" />
            <h2 className="text-sm font-black uppercase tracking-wider text-[var(--error)]">
              Pending Revision Requests
            </h2>
            <span className="text-[10px] font-black bg-[var(--error)]/10 text-[var(--error)] px-1.5 py-0.5 rounded-full ml-1">
              {pendingRevisionRequests.length}
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {pendingRevisionRequests.map((req) => (
              <RevisionCard key={req._id} req={req} />
            ))}
          </div>
        </div>
      )}

      {/* ── Two-column: deadlines + recent drawings ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Upcoming deadlines */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-[var(--warning)]" />
              <h2 className="text-sm font-black uppercase tracking-wider text-[var(--text-secondary)]">
                Upcoming Deadlines
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/tasks')}
              className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline font-semibold"
            >
              View all <ArrowRight size={11} />
            </button>
          </div>

          {/* Overdue tasks first */}
          {overdueTasks?.length > 0 && (
            <div className="mb-2 px-2 py-1.5 rounded-lg bg-[var(--error)]/5 border border-[var(--error)]/15">
              <p className="text-[10px] font-black text-[var(--error)] uppercase tracking-wider mb-1.5">
                Overdue ({overdueTasks.length})
              </p>
              {overdueTasks.slice(0, 3).map((t) => <DeadlineRow key={t._id} task={t} />)}
            </div>
          )}

          {upcomingDeadlines?.length > 0 ? (
            <div>
              {upcomingDeadlines.map((t) => <DeadlineRow key={t._id} task={t} />)}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <Clock size={24} className="mx-auto mb-2 opacity-20" />
              <p className="text-xs">No upcoming deadlines in the next 14 days.</p>
            </div>
          )}
        </div>

        {/* Recent drawings */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FolderOpen size={14} className="text-[var(--accent-blue)]" />
              <h2 className="text-sm font-black uppercase tracking-wider text-[var(--text-secondary)]">
                Recent Drawings
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/drawings')}
              className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline font-semibold"
            >
              View all <ArrowRight size={11} />
            </button>
          </div>

          {recentDrawings?.length > 0 ? (
            <div>
              {recentDrawings.map((d) => <DrawingRow key={d._id} drawing={d} />)}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <FolderOpen size={24} className="mx-auto mb-2 opacity-20" />
              <p className="text-xs">No drawings uploaded yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Drawing status breakdown ──────────────────────────────────────── */}
      {stats?.totalDrawings > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen size={14} className="text-[var(--accent-blue)]" />
            <h2 className="text-sm font-black uppercase tracking-wider text-[var(--text-secondary)]">
              My Drawing Status Overview
            </h2>
            <span className="text-xs text-[var(--text-muted)] ml-auto">{stats.totalDrawings} total</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { key: 'draft',             label: 'Draft',         color: 'var(--text-muted)'   },
              { key: 'sent_for_approval', label: 'In Review',     color: 'var(--warning)'      },
              { key: 'approved',          label: 'Approved',      color: 'var(--accent-green)' },
              { key: 'rejected',          label: 'Rejected',      color: 'var(--error)'        },
              { key: 'released_to_site',  label: 'Released',      color: 'var(--primary)'      },
            ].map(({ key, label, color }) => {
              const count = stats.drawingsByStatus?.[key] ?? 0;
              return (
                <div
                  key={key}
                  className="rounded-xl p-3 border"
                  style={{
                    background: `color-mix(in srgb, ${color} 8%, transparent)`,
                    borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
                  }}
                >
                  <p className="text-xl font-black" style={{ color }}>{count}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{label}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Active projects ───────────────────────────────────────────────── */}
      {activeProjects?.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Briefcase size={14} className="text-[var(--primary)]" />
            <h2 className="text-sm font-black uppercase tracking-wider text-[var(--text-secondary)]">
              My Active Projects
            </h2>
            <span className="text-[10px] font-bold text-[var(--text-muted)] ml-auto">
              {activeProjects.length} project{activeProjects.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeProjects.map((p) => (
              <button
                key={p._id}
                type="button"
                onClick={() => navigate(`/projects/${p._id}`)}
                className="text-left w-full"
              >
                <ProjectCard project={p} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!stats?.totalTasks && !stats?.totalDrawings && !activeProjects?.length && (
        <div className="text-center py-24 text-[var(--text-muted)]">
          <Palette size={40} className="mx-auto mb-4 opacity-20" />
          <p className="text-sm font-semibold">No work assigned yet.</p>
          <p className="text-xs mt-1">Tasks and drawings assigned to you will appear here.</p>
        </div>
      )}
    </div>
  );
};

export default DesignerDashboardPage;
