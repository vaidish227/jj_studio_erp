import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, LayoutGrid, List, Search, Briefcase,
  Calendar, MapPin, ChevronRight, MoreHorizontal,
  SlidersHorizontal, X, ArrowDownUp,
} from 'lucide-react';
import { Button, Loader } from '../../../shared/components';
import DatePicker from '../../../shared/components/DatePicker/DatePicker';
import PermissionGate from '../../../shared/components/PermissionGate/PermissionGate';
import useProjects from '../hooks/useProjects';
import ProjectStatusBadge from '../components/ProjectStatusBadge';
import CreateProjectModal from '../components/CreateProjectModal';
import { getLeadDesigner, getAllAssignedUsers } from '../utils/teamHelpers';

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

// Phase-driven accent strip across the top edge of every card.
const PHASE_ACCENT = {
  design_phase:    'from-[var(--primary)] via-[var(--primary)]/80 to-transparent',
  execution_phase: 'from-[var(--accent-blue)] via-[var(--accent-blue)]/80 to-transparent',
  handover:        'from-[var(--accent-teal)] via-[var(--accent-teal)]/80 to-transparent',
  completed:       'from-[var(--success)] via-[var(--success)]/80 to-transparent',
  on_hold:         'from-[var(--warning)] via-[var(--warning)]/80 to-transparent',
  cancelled:       'from-[var(--error)] via-[var(--error)]/80 to-transparent',
};

// Smart due-date: relative inside 30 days, absolute beyond — tone drives chip color.
const dueDateMeta = (dateStr) => {
  if (!dateStr) return { label: 'No due date', tone: 'muted' };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(dateStr); due.setHours(0, 0, 0, 0);
  const days  = Math.round((due - today) / 86400000);

  if (days < 0)    return { label: `Overdue ${Math.abs(days)}d`, tone: 'error' };
  if (days === 0)  return { label: 'Due today',                  tone: 'warning' };
  if (days <= 7)   return { label: `Due in ${days}d`,            tone: 'warning' };
  if (days <= 30)  return { label: `Due in ${days}d`,            tone: 'default' };
  return { label: fmt(dateStr), tone: 'default' };
};

const DUE_TONE = {
  muted:   'text-[var(--text-muted)] bg-[var(--bg)] border border-[var(--border)]',
  default: 'text-[var(--text-secondary)] bg-[var(--bg)] border border-[var(--border)]',
  warning: 'text-[var(--warning)] bg-[var(--warning)]/10 border border-[var(--warning)]/25',
  error:   'text-[var(--error)] bg-[var(--error)]/10 border border-[var(--error)]/25',
};

const TeamStack = ({ users, max = 4 }) => {
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

const ProjectCard = ({ project, onClick }) => {
  const team   = getAllAssignedUsers(project);
  const lead   = getLeadDesigner(project);
  const due    = dueDateMeta(project.estimatedCompletionDate);
  const accent = PHASE_ACCENT[project.status] || PHASE_ACCENT.design_phase;
  const pct    = project.workflowTemplateId ? (project.progressPercent || 0) : null;
  const city   = project.siteAddress?.city || project.siteAddress?.fullAddress;

  return (
    <div
      onClick={onClick}
      className="group relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl
                 overflow-hidden cursor-pointer
                 transition-all duration-300 ease-out
                 hover:-translate-y-1 hover:border-[var(--primary)]/40
                 hover:shadow-[0_18px_40px_-18px_rgba(212,183,108,0.45)]"
    >
      {/* Phase accent strip */}
      <span className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${accent}`} />

      {/* Warm gold glow that blooms in the top-right corner on hover */}
      <span className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full
                       bg-[var(--primary)]/0 group-hover:bg-[var(--primary)]/15
                       blur-3xl transition-all duration-500" />

      <div className="relative p-5 flex flex-col gap-4">

        {/* Header — tracking ID, project name, status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {project.trackingId}
            </p>
            <h3 className="mt-1.5 font-extrabold text-[var(--text-primary)] text-[15px] leading-snug
                           line-clamp-2 group-hover:text-[var(--primary)] transition-colors duration-200">
              {project.name}
            </h3>
          </div>
          <ProjectStatusBadge status={project.status} className="shrink-0" />
        </div>

        {/* Client block */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                          bg-gradient-to-br from-[var(--primary)]/25 to-[var(--primary)]/5
                          text-sm font-black text-[var(--primary)] uppercase
                          border border-[var(--primary)]/15">
            {(project.clientId?.name || '—')[0]}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)]">Client</p>
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {project.clientId?.name || '—'}
            </p>
          </div>
        </div>

        {/* Meta chips — location & type */}
        {(city || project.projectType) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {city && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg
                               text-[11px] font-semibold text-[var(--text-secondary)]
                               bg-[var(--bg)] border border-[var(--border)]">
                <MapPin size={11} className="text-[var(--text-muted)]" />
                {city}
              </span>
            )}
            {project.projectType && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg
                               text-[11px] font-semibold text-[var(--text-secondary)]
                               bg-[var(--bg)] border border-[var(--border)]">
                <Briefcase size={11} className="text-[var(--text-muted)]" />
                {project.projectType}{project.area ? ` · ${project.area} sqft` : ''}
              </span>
            )}
          </div>
        )}

        {/* Soft fade divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-[var(--border)] to-transparent" />

        {/* Team stack + due-date chip */}
        <div className="flex items-center justify-between gap-3">
          {team.length > 0 ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <TeamStack users={team} />
              {lead && (
                <span className="text-[11px] font-semibold text-[var(--text-secondary)] truncate">
                  {lead.name}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[11px] font-semibold text-[var(--text-muted)] italic">
              No team assigned
            </span>
          )}

          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold shrink-0
                            ${DUE_TONE[due.tone]}`}>
            <Calendar size={11} />
            {due.label}
          </span>
        </div>

        {/* Progress footer */}
        <div className="flex items-center gap-3">
          {pct !== null ? (
            <>
              <div className="flex-1 h-1.5 rounded-full bg-[var(--bg)] border border-[var(--border)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)]
                             transition-[width] duration-700 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[11px] font-black text-[var(--text-primary)] tabular-nums w-9 text-right">
                {pct}%
              </span>
            </>
          ) : (
            <span className="flex-1 text-[11px] font-semibold text-[var(--text-muted)]">
              Awaiting kickoff
            </span>
          )}
          <ChevronRight
            size={16}
            className="text-[var(--text-muted)] -mr-1
                       group-hover:translate-x-0.5 group-hover:text-[var(--primary)]
                       transition-all duration-200"
          />
        </div>
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

// ─── Sort options ─────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { label: 'Newest first',     value: 'newest' },
  { label: 'Oldest first',     value: 'oldest' },
  { label: 'Due date (soonest)', value: 'due_asc' },
  { label: 'Due date (latest)',  value: 'due_desc' },
  { label: 'Name (A→Z)',       value: 'name_asc' },
  { label: 'Name (Z→A)',       value: 'name_desc' },
];

// ─── Advanced Filters Panel ──────────────────────────────────────────────────
const AdvancedFilters = ({
  open, onClose, anchorRef,
  projectType, setProjectType,
  designerId, setDesignerId,
  clientId, setClientId,
  dueFrom, setDueFrom, dueTo, setDueTo,
  sortBy, setSortBy,
  designerOptions, clientOptions,
  onClear,
}) => {
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      if (anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const inputCls =
    'w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg)] ' +
    'text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]';

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 z-30 w-[min(92vw,420px)]
                 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Filters</h3>
        <button
          onClick={onClear}
          className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--primary)]"
        >
          Clear all
        </button>
      </div>

      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">Project Type</label>
        <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className={inputCls}>
          <option value="">All types</option>
          <option value="Residential">Residential</option>
          <option value="Commercial">Commercial</option>
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">Lead Designer</label>
        <select value={designerId} onChange={(e) => setDesignerId(e.target.value)} className={inputCls}>
          <option value="">All designers</option>
          {designerOptions.map((d) => (
            <option key={d._id} value={d._id}>{d.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">Client</label>
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
          <option value="">All clients</option>
          {clientOptions.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">Due Date Range</label>
        <div className="grid grid-cols-2 gap-2">
          <DatePicker
            name="dueFrom"
            value={dueFrom}
            onChange={(e) => setDueFrom(e.target.value)}
            placeholder="From"
            yearRange={{ from: new Date().getFullYear() - 1, to: new Date().getFullYear() + 3 }}
          />
          <DatePicker
            name="dueTo"
            value={dueTo}
            onChange={(e) => setDueTo(e.target.value)}
            placeholder="To"
            min={dueFrom || undefined}
            yearRange={{ from: new Date().getFullYear() - 1, to: new Date().getFullYear() + 3 }}
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">Sort By</label>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={inputCls}>
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="flex justify-end pt-2 border-t border-[var(--border)]">
        <Button size="sm" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
};

// ─── Active Filter Chip ───────────────────────────────────────────────────────
const FilterChip = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg
                   bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/25">
    {label}
    <button onClick={onRemove} className="hover:bg-[var(--primary)]/20 rounded p-0.5">
      <X size={10} />
    </button>
  </span>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const ProjectsPage = () => {
  const navigate = useNavigate();
  const [view, setView]           = useState('table');
  const [statusFilter, setStatus] = useState('');
  const [search, setSearch]       = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Advanced filters
  const [projectType, setProjectType] = useState('');
  const [designerId,  setDesignerId]  = useState('');
  const [clientId,    setClientId]    = useState('');
  const [dueFrom,     setDueFrom]     = useState('');
  const [dueTo,       setDueTo]       = useState('');
  const [sortBy,      setSortBy]      = useState('newest');
  const [filterOpen,  setFilterOpen]  = useState(false);
  const filterBtnRef = useRef(null);

  const { projects, isLoading, error } = useProjects();

  // Build dropdown options from loaded projects (unique)
  const { designerOptions, clientOptions } = useMemo(() => {
    const dMap = new Map();
    const cMap = new Map();
    for (const p of projects) {
      const lead = getLeadDesigner(p);
      if (lead?._id && !dMap.has(String(lead._id))) {
        dMap.set(String(lead._id), { _id: String(lead._id), name: lead.name || 'Unknown' });
      }
      const c = p.clientId;
      if (c?._id && !cMap.has(String(c._id))) {
        cMap.set(String(c._id), { _id: String(c._id), name: c.name || 'Unknown' });
      }
    }
    return {
      designerOptions: Array.from(dMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      clientOptions:   Array.from(cMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [projects]);

  const designerName = designerOptions.find((d) => d._id === designerId)?.name;
  const clientName   = clientOptions.find((c) => c._id === clientId)?.name;

  // Client-side search + all filters + sort
  const filtered = useMemo(() => {
    let result = projects;

    if (statusFilter) result = result.filter((p) => p.status === statusFilter);
    if (projectType)  result = result.filter((p) => p.projectType === projectType);
    if (designerId)   result = result.filter((p) => String(getLeadDesigner(p)?._id || '') === designerId);
    if (clientId)     result = result.filter((p) => String(p.clientId?._id || '') === clientId);
    if (dueFrom)      result = result.filter((p) => p.estimatedCompletionDate && new Date(p.estimatedCompletionDate) >= new Date(dueFrom));
    if (dueTo)        result = result.filter((p) => p.estimatedCompletionDate && new Date(p.estimatedCompletionDate) <= new Date(dueTo));

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.trackingId?.toLowerCase().includes(q) ||
          p.clientId?.name?.toLowerCase().includes(q)
      );
    }

    // Sort
    const sorted = [...result];
    const dateVal = (d) => (d ? new Date(d).getTime() : 0);
    switch (sortBy) {
      case 'oldest':    sorted.sort((a, b) => dateVal(a.createdAt) - dateVal(b.createdAt)); break;
      case 'due_asc':   sorted.sort((a, b) => dateVal(a.estimatedCompletionDate) - dateVal(b.estimatedCompletionDate)); break;
      case 'due_desc':  sorted.sort((a, b) => dateVal(b.estimatedCompletionDate) - dateVal(a.estimatedCompletionDate)); break;
      case 'name_asc':  sorted.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
      case 'name_desc': sorted.sort((a, b) => (b.name || '').localeCompare(a.name || '')); break;
      case 'newest':
      default:          sorted.sort((a, b) => dateVal(b.createdAt) - dateVal(a.createdAt));
    }
    return sorted;
  }, [projects, statusFilter, projectType, designerId, clientId, dueFrom, dueTo, search, sortBy]);

  const clearAdvanced = () => {
    setProjectType(''); setDesignerId(''); setClientId('');
    setDueFrom(''); setDueTo(''); setSortBy('newest');
  };
  const clearAll = () => {
    setStatus(''); setSearch(''); clearAdvanced();
  };

  const advancedCount = [projectType, designerId, clientId, dueFrom, dueTo].filter(Boolean).length;
  const hasAnyFilter  = !!(statusFilter || search || advancedCount);

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

        {/* Advanced Filters */}
        <div className="relative">
          <button
            ref={filterBtnRef}
            onClick={() => setFilterOpen((o) => !o)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all
              ${filterOpen || advancedCount > 0
                ? 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/40'
                : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--primary)]/40'}`}
          >
            <SlidersHorizontal size={14} />
            Filters
            {advancedCount > 0 && (
              <span className="bg-[var(--primary)] text-black text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {advancedCount}
              </span>
            )}
          </button>
          <AdvancedFilters
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            anchorRef={filterBtnRef}
            projectType={projectType} setProjectType={setProjectType}
            designerId={designerId}   setDesignerId={setDesignerId}
            clientId={clientId}       setClientId={setClientId}
            dueFrom={dueFrom}         setDueFrom={setDueFrom}
            dueTo={dueTo}             setDueTo={setDueTo}
            sortBy={sortBy}           setSortBy={setSortBy}
            designerOptions={designerOptions}
            clientOptions={clientOptions}
            onClear={clearAdvanced}
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

      {/* Active filter chips */}
      {(advancedCount > 0 || sortBy !== 'newest') && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Active:</span>
          {projectType && <FilterChip label={`Type: ${projectType}`}        onRemove={() => setProjectType('')} />}
          {designerId  && <FilterChip label={`Designer: ${designerName}`}   onRemove={() => setDesignerId('')} />}
          {clientId    && <FilterChip label={`Client: ${clientName}`}       onRemove={() => setClientId('')} />}
          {dueFrom     && <FilterChip label={`Due from ${dueFrom}`}         onRemove={() => setDueFrom('')} />}
          {dueTo       && <FilterChip label={`Due to ${dueTo}`}             onRemove={() => setDueTo('')} />}
          {sortBy !== 'newest' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg
                             bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/25">
              <ArrowDownUp size={10} />
              {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
            </span>
          )}
          {hasAnyFilter && (
            <button
              onClick={clearAll}
              className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--primary)] underline ml-1"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader label="Loading projects..." />
        </div>
      )}

      {/* Empty */}
      {!isLoading && filtered.length === 0 && (
        <EmptyState
          hasFilters={hasAnyFilter}
          onClear={clearAll}
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
