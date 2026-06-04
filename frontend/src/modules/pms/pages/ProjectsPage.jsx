import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, LayoutGrid, List, Search, Briefcase,
  Calendar, MapPin, User, ChevronRight, MoreHorizontal,
  TrendingUp, Clock, CheckCircle2, PauseCircle,
} from 'lucide-react';
import { DashboardCard, Button, Modal, Loader } from '../../../shared/components';
import PermissionGate from '../../../shared/components/PermissionGate/PermissionGate';
import useProjects from '../hooks/useProjects';
import useProjectForm from '../hooks/useProjectForm';
import ProjectStatusBadge from '../components/ProjectStatusBadge';
import CreateProjectModal from '../components/CreateProjectModal';
import ProgressRing from '../components/ProgressRing';
import { getLeadDesigner } from '../utils/teamHelpers';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const STATUS_FILTERS = [
  { label: 'All',       value: '' },
  { label: 'Design',    value: 'design_phase' },
  { label: 'Execution', value: 'execution_phase' },
  { label: 'Handover',  value: 'handover' },
  { label: 'On Hold',   value: 'on_hold' },
  { label: 'Completed', value: 'completed' },
];

// ─── Project Card (grid view) ────────────────────────────────────────────────
const ProjectCard = ({ project, onClick }) => {
  const tasksDone  = 0; // computed from tasks when loaded in detail
  const daysLeft   = project.estimatedCompletionDate
    ? Math.ceil((new Date(project.estimatedCompletionDate) - new Date()) / 86400000)
    : null;
  const isOverdue  = daysLeft !== null && daysLeft < 0;

  return (
    <div
      onClick={onClick}
      className="group bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 cursor-pointer
                 hover:border-[var(--primary)] hover:shadow-lg hover:-translate-y-0.5
                 transition-all duration-200 flex flex-col gap-4"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">
            {project.trackingId}
          </p>
          <h3 className="font-bold text-[var(--text-primary)] text-sm leading-snug truncate group-hover:text-[var(--primary)] transition-colors">
            {project.name}
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Phase 3a — progress at a glance (only for engine-seeded projects) */}
          {project.workflowTemplateId && (
            <ProgressRing value={project.progressPercent || 0} size={36} stroke={3.5} />
          )}
          <ProjectStatusBadge status={project.status} />
        </div>
      </div>

      {/* Client & Type */}
      <div className="flex flex-col gap-1.5 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-1.5">
          <User size={12} className="text-[var(--text-muted)] shrink-0" />
          <span className="truncate">{project.clientId?.name || '—'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin size={12} className="text-[var(--text-muted)] shrink-0" />
          <span className="truncate">
            {project.siteAddress?.city || project.siteAddress?.fullAddress || '—'}
          </span>
        </div>
        {project.area && (
          <div className="flex items-center gap-1.5">
            <Briefcase size={12} className="text-[var(--text-muted)] shrink-0" />
            <span>{project.projectType} · {project.area} sqft</span>
          </div>
        )}
      </div>

      {/* Lead Designer */}
      {(() => {
        const lead = getLeadDesigner(project);
        if (!lead) return null;
        return (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[var(--primary)]/15 flex items-center justify-center text-[9px] font-black text-[var(--primary)] uppercase">
              {lead.name?.[0] || 'D'}
            </div>
            <span className="text-xs text-[var(--text-secondary)]">{lead.name}</span>
          </div>
        );
      })()}

      {/* Due date */}
      <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]">
        <div className="flex items-center gap-1.5 text-xs">
          <Calendar size={12} className={isOverdue ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'} />
          <span className={isOverdue ? 'text-[var(--error)] font-semibold' : 'text-[var(--text-muted)]'}>
            {project.estimatedCompletionDate ? fmt(project.estimatedCompletionDate) : 'No due date'}
          </span>
        </div>
        <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors" />
      </div>
    </div>
  );
};

// ─── Project Table Row ────────────────────────────────────────────────────────
const ProjectRow = ({ project, onClick }) => (
  <tr
    onClick={onClick}
    className="border-b border-[var(--border)] hover:bg-[var(--bg)] cursor-pointer transition-colors group"
  >
    <td className="px-4 py-3 text-xs font-black text-[var(--text-muted)] whitespace-nowrap">
      {project.trackingId}
    </td>
    <td className="px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
          {project.name}
        </p>
        <p className="text-xs text-[var(--text-muted)]">{project.projectType}</p>
      </div>
    </td>
    <td className="px-4 py-3 text-sm text-[var(--text-secondary)] whitespace-nowrap">
      {project.clientId?.name || '—'}
    </td>
    <td className="px-4 py-3">
      <ProjectStatusBadge status={project.status} />
    </td>
    <td className="px-4 py-3 text-sm text-[var(--text-secondary)] whitespace-nowrap">
      {getLeadDesigner(project)?.name || '—'}
    </td>
    <td className="px-4 py-3 text-sm text-[var(--text-secondary)] whitespace-nowrap">
      {fmt(project.estimatedCompletionDate)}
    </td>
    <td className="px-4 py-3 text-sm text-[var(--text-secondary)] whitespace-nowrap">
      {fmt(project.startDate)}
    </td>
    <td className="px-4 py-3">
      <button
        onClick={(e) => e.stopPropagation()}
        className="p-1.5 rounded-lg hover:bg-[var(--border)] text-[var(--text-muted)] transition-colors"
      >
        <MoreHorizontal size={16} />
      </button>
    </td>
  </tr>
);

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = ({ hasFilters, onClear, onCreate }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="w-16 h-16 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center mb-4">
      <Briefcase size={28} className="text-[var(--primary)]" />
    </div>
    <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
      {hasFilters ? 'No projects match your filters' : 'No projects yet'}
    </h3>
    <p className="text-sm text-[var(--text-muted)] mb-5 max-w-xs">
      {hasFilters
        ? 'Try adjusting or clearing your filters to see more results.'
        : 'Create your first project once a proposal has been approved and payment received.'}
    </p>
    {hasFilters
      ? <Button variant="ghost" size="sm" onClick={onClear}>Clear Filters</Button>
      : (
        <PermissionGate permission="projects.create">
          <Button size="sm" onClick={onCreate}><Plus size={14} /> New Project</Button>
        </PermissionGate>
      )
    }
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const ProjectsPage = () => {
  const navigate = useNavigate();
  const [view, setView]           = useState('table');
  const [statusFilter, setStatus] = useState('');
  const [search, setSearch]       = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { projects, isLoading, error, statusCounts, refresh } = useProjects();

  // Client-side search + status filter (list is already loaded)
  const filtered = useMemo(() => {
    let result = projects;
    if (statusFilter) result = result.filter((p) => p.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.trackingId?.toLowerCase().includes(q) ||
          p.clientId?.name?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [projects, statusFilter, search]);

  const statCards = [
    {
      title: 'Total Projects',
      value: statusCounts.total,
      icon: Briefcase,
      iconBg: 'bg-[var(--primary)]/10',
      trend: 'All active & closed',
      trendUp: true,
    },
    {
      title: 'Design Phase',
      value: statusCounts.design_phase,
      icon: TrendingUp,
      iconBg: 'bg-[var(--primary)]/10',
      trend: 'Drawing & concept stage',
      trendUp: true,
      redirectPath: '/projects',
    },
    {
      title: 'Execution Phase',
      value: statusCounts.execution_phase,
      icon: Clock,
      iconBg: 'bg-[var(--accent-blue)]/10',
      trend: 'Site work in progress',
      trendUp: true,
    },
    {
      title: 'On Hold',
      value: statusCounts.on_hold,
      icon: PauseCircle,
      iconBg: 'bg-[var(--warning)]/10',
      trend: 'Awaiting action',
      trendUp: false,
    },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Projects</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Track all design & execution projects</p>
        </div>
        <PermissionGate permission="projects.create">
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New Project
          </Button>
        </PermissionGate>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-[var(--error)]/20 bg-[var(--error)]/10 px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((c) => (
          <DashboardCard key={c.title} {...c} />
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
        {/* Status pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border
                ${statusFilter === f.value
                  ? 'bg-[var(--primary)] text-black border-[var(--primary)] shadow-sm'
                  : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--primary)]/40'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="pl-9 pr-4 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)]
                       text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                       focus:outline-none focus:ring-1 focus:ring-[var(--primary)] w-56"
          />
        </div>

        {/* View toggle */}
        <div className="hidden lg:flex items-center gap-1 p-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
          <button
            onClick={() => setView('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
              ${view === 'table'
                ? 'bg-[var(--primary)] text-black shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            <List size={14} /> Table
          </button>
          <button
            onClick={() => setView('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
              ${view === 'grid'
                ? 'bg-[var(--primary)] text-black shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            <LayoutGrid size={14} /> Grid
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader label="Loading projects..." />
        </div>
      )}

      {/* Empty */}
      {!isLoading && filtered.length === 0 && (
        <EmptyState
          hasFilters={!!statusFilter || !!search}
          onClear={() => { setStatus(''); setSearch(''); }}
          onCreate={() => setShowCreate(true)}
        />
      )}

      {/* Table view (lg+) */}
      {!isLoading && filtered.length > 0 && (
        <>
          {/* Table — desktop */}
          <div className={`hidden ${view === 'table' ? 'lg:block' : 'lg:hidden'} bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg)]/60">
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">ID</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Project</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Client</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Status</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Designer</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Due Date</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Started</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <ProjectRow
                      key={p._id}
                      project={p}
                      onClick={() => navigate(`/projects/${p._id}`)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grid view (desktop) + always on mobile */}
          <div className={`${view === 'grid' ? 'lg:grid' : 'lg:hidden'} grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4`}>
            {filtered.map((p) => (
              <ProjectCard
                key={p._id}
                project={p}
                onClick={() => navigate(`/projects/${p._id}`)}
              />
            ))}
          </div>
        </>
      )}

      {/* Create project modal */}
      <CreateProjectModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(proj) => {
          setShowCreate(false);
          navigate(`/projects/${proj._id}`);
        }}
      />
    </div>
  );
};

export default ProjectsPage;
