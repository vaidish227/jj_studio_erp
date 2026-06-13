import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, Plus, Search, RefreshCw, ChevronRight,
  Calendar, User, AlertTriangle, CheckCircle2,
  Clock, GitBranch, Layers, Filter,
} from 'lucide-react';
import { Button, Loader, Pagination } from '../../../shared/components';
import PermissionGate from '../../../shared/components/PermissionGate/PermissionGate';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';
import useAllTasks from '../hooks/useAllTasks';
import CreateTaskModal from '../components/CreateTaskModal';
import TaskStatusBadge from '../components/TaskStatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import TaskTypeIcon, { TASK_TYPE_CONFIG } from '../components/TaskTypeIcon';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
  : '—';

const isOverdue = (task) => {
  if (!task.dueDate) return false;
  if (['approved', 'completed', 'released_to_site'].includes(task.status)) return false;
  return new Date(task.dueDate) < new Date();
};

// ─── Status filter options ─────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: '',                       label: 'All Status' },
  { value: 'not_started',            label: 'Not Started' },
  { value: 'in_progress',            label: 'In Progress' },
  { value: 'pending_review',         label: 'Pending Review' },
  { value: 'revision_requested',     label: 'Revision Requested' },
  { value: 'on_hold',                label: 'On Hold' },
  { value: 'approved',               label: 'Approved' },
  { value: 'pending_client_approval',label: 'Client Approval' },
  { value: 'released_to_site',       label: 'Released' },
  { value: 'completed',              label: 'Completed' },
];

const PRIORITY_OPTIONS = [
  { value: '',       label: 'All Priority' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high',   label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low',    label: 'Low' },
];

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, accent, onClick }) => (
  <button
    onClick={onClick}
    className={`bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4
                flex items-center gap-4 text-left w-full
                hover:border-[var(--primary)]/40 transition-all group
                ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
      <Icon size={18} className="text-[var(--text-primary)] opacity-70" />
    </div>
    <div className="min-w-0">
      <p className="text-2xl font-extrabold text-[var(--text-primary)] leading-none">{value}</p>
      <p className="text-xs text-[var(--text-muted)] mt-0.5">{label}</p>
    </div>
  </button>
);

// ─── Task Table Row (desktop) ─────────────────────────────────────────────────
const TaskRow = ({ task, onClick }) => {
  const cfg = TASK_TYPE_CONFIG[task.taskType] || {};
  const overdue = isOverdue(task);
  return (
    <tr
      onClick={onClick}
      className="border-b border-[var(--border)] hover:bg-[var(--bg)] cursor-pointer transition-colors group"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <TaskTypeIcon taskType={task.taskType} size={16} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors truncate max-w-[200px]">
              {task.title}
            </p>
            <p className="text-[10px] text-[var(--text-muted)]">{cfg.label || task.taskType}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {task.projectId ? (
          <div>
            <p className="text-sm text-[var(--text-secondary)] truncate max-w-[160px]">{task.projectId.name}</p>
            <p className="text-[10px] font-black text-[var(--text-muted)]">{task.projectId.trackingId}</p>
          </div>
        ) : <span className="text-sm text-[var(--text-muted)]">—</span>}
      </td>
      <td className="px-4 py-3">
        {task.assignedTo ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[9px] font-black text-[var(--primary)] uppercase shrink-0">
              {task.assignedTo.name?.[0] || <User size={9} />}
            </div>
            <span className="text-sm text-[var(--text-secondary)] truncate max-w-[120px]">{task.assignedTo.name}</span>
          </div>
        ) : <span className="text-sm text-[var(--text-muted)] italic">Unassigned</span>}
      </td>
      <td className="px-4 py-3"><PriorityBadge priority={task.priority} /></td>
      <td className="px-4 py-3"><TaskStatusBadge status={task.status} /></td>
      <td className="px-4 py-3">
        <span className={`text-sm ${overdue ? 'text-[var(--error)] font-semibold' : 'text-[var(--text-muted)]'}`}>
          {overdue && <span className="mr-1">⚠</span>}
          {fmt(task.dueDate)}
        </span>
      </td>
      <td className="px-4 py-3">
        <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors" />
      </td>
    </tr>
  );
};

// ─── Task Card (mobile) ───────────────────────────────────────────────────────
const TaskCard = ({ task, onClick }) => {
  const cfg = TASK_TYPE_CONFIG[task.taskType] || {};
  const overdue = isOverdue(task);
  return (
    <div
      onClick={onClick}
      className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 cursor-pointer
                 hover:border-[var(--primary)]/40 transition-all group space-y-3"
    >
      <div className="flex items-start gap-2.5">
        <TaskTypeIcon taskType={task.taskType} size={16} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors leading-snug">
            {task.title}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{cfg.label || task.taskType}</p>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>
      {task.projectId && (
        <p className="text-xs text-[var(--text-secondary)]">
          {task.projectId.name}
          <span className="ml-1 font-black text-[var(--text-muted)]">{task.projectId.trackingId}</span>
        </p>
      )}
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-1.5">
          {task.assignedTo ? (
            <>
              <div className="w-5 h-5 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[9px] font-black text-[var(--primary)] uppercase">
                {task.assignedTo.name?.[0]}
              </div>
              <span>{task.assignedTo.name}</span>
            </>
          ) : <span className="italic">Unassigned</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <PriorityBadge priority={task.priority} />
          <span className={overdue ? 'text-[var(--error)] font-semibold' : ''}>
            {fmt(task.dueDate)}
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = ({ hasFilters, onClear, onNew }) => (
  <div className="flex flex-col items-center justify-center py-24 text-center">
    <div className="w-14 h-14 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center mb-4">
      <ClipboardList size={26} className="text-[var(--primary)]" />
    </div>
    <p className="text-sm font-bold text-[var(--text-primary)] mb-1">
      {hasFilters ? 'No tasks match your filters' : 'No tasks assigned yet'}
    </p>
    <p className="text-xs text-[var(--text-muted)] mb-5 max-w-xs">
      {hasFilters
        ? 'Try clearing your filters to see all tasks.'
        : 'Create the first task assignment for a project.'}
    </p>
    {hasFilters
      ? <Button variant="ghost" size="sm" onClick={onClear}>Clear Filters</Button>
      : (
        <PermissionGate permission="tasks.create">
          <Button size="sm" onClick={onNew}><Plus size={14} className="mr-1" /> Assign New Task</Button>
        </PermissionGate>
      )
    }
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const AssignTaskPage = () => {
  const navigate  = useNavigate();
  const toast     = useToast();
  const [showCreate, setShowCreate]   = useState(false);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatus]     = useState('');
  const [priorityFilter, setPriority] = useState('');
  const [projectFilter, setProject]   = useState('');
  const [projectOptions, setProjectOptions] = useState([]);
  const [designerOptions, setDesignerOptions] = useState([]);

  const { tasks, isLoading, error, total, refresh } = useAllTasks();

  // Load filter dropdowns once
  useEffect(() => {
    pmsService.getAllProjects().then((r) => setProjectOptions(r.projects || [])).catch(() => {});
    pmsService.getAssignableUsers().then((r) => setDesignerOptions(r.users || [])).catch(() => {});
  }, []);

  // Client-side filtering on the loaded task list
  const filtered = useMemo(() => {
    let result = tasks;
    if (statusFilter)  result = result.filter((t) => t.status === statusFilter);
    if (priorityFilter) result = result.filter((t) => t.priority === priorityFilter);
    if (projectFilter)  result = result.filter((t) => t.projectId?._id === projectFilter || String(t.projectId) === projectFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.projectId?.name?.toLowerCase().includes(q) ||
          t.assignedTo?.name?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [tasks, statusFilter, priorityFilter, projectFilter, search]);

  // Stat counts from full task list
  const stats = useMemo(() => ({
    total:         tasks.length,
    inProgress:    tasks.filter((t) => t.status === 'in_progress').length,
    pendingReview: tasks.filter((t) => t.status === 'pending_review').length,
    overdue:       tasks.filter(isOverdue).length,
  }), [tasks]);

  const hasFilters = !!(statusFilter || priorityFilter || projectFilter || search);
  const clearFilters = () => { setStatus(''); setPriority(''); setProject(''); setSearch(''); };

  // ── Pagination — 25 per page over the filtered set ──────────────────────
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [statusFilter, priorityFilter, projectFilter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage  = Math.min(page, pageCount);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  );
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd   = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
            <ClipboardList size={20} className="text-[var(--primary)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Assign Task</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Create and manage task assignments across all projects
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--bg)] text-[var(--text-muted)] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
          <PermissionGate permission="tasks.create">
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-1.5" /> Assign New Task
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Tasks"    value={stats.total}         icon={Layers}       accent="bg-[var(--primary)]/10" />
        <StatCard label="In Progress"    value={stats.inProgress}    icon={Clock}        accent="bg-[var(--accent-blue)]/10" onClick={() => setStatus('in_progress')} />
        <StatCard label="Pending Review" value={stats.pendingReview} icon={GitBranch}    accent="bg-[var(--warning)]/10"     onClick={() => setStatus('pending_review')} />
        <StatCard label="Overdue"        value={stats.overdue}       icon={AlertTriangle} accent="bg-[var(--error)]/10"      onClick={() => { setStatus('in_progress'); }} />
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
          {/* Search */}
          <div className="relative flex-1 lg:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks, projects, designers…"
              className="h-9 pl-9 pr-3 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg)]
                         text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                         focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)]
                         w-full transition-colors"
            />
          </div>

          {/* Dropdowns */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <select
              value={projectFilter}
              onChange={(e) => setProject(e.target.value)}
              className="h-9 px-3 pr-8 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg)]
                         text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]
                         focus:border-[var(--primary)] min-w-[140px] max-w-[200px] transition-colors cursor-pointer"
            >
              <option value="">All Projects</option>
              {projectOptions.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 px-3 pr-8 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg)]
                         text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]
                         focus:border-[var(--primary)] min-w-[130px] transition-colors cursor-pointer"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriority(e.target.value)}
              className="h-9 px-3 pr-8 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg)]
                         text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]
                         focus:border-[var(--primary)] min-w-[120px] transition-colors cursor-pointer"
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="h-9 px-3 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/10
                           rounded-lg transition-colors"
              >
                Clear
              </button>
            )}

            <span className="ml-auto text-xs text-[var(--text-muted)] font-semibold whitespace-nowrap pr-1">
              {filtered.length} {filtered.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[var(--error)]/20 bg-[var(--error)]/10 text-sm text-[var(--error)]">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <Loader label="Loading tasks…" />
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && !error && filtered.length === 0 && (
        <EmptyState
          hasFilters={hasFilters}
          onClear={clearFilters}
          onNew={() => setShowCreate(true)}
        />
      )}

      {/* ── Task Table — desktop ── */}
      {!isLoading && filtered.length > 0 && (
        <>
          <div className="hidden lg:block bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg)]/60">
                    {['Task', 'Project', 'Designer', 'Priority', 'Status', 'Due Date', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((task) => (
                    <TaskRow
                      key={task._id}
                      task={task}
                      onClick={() => navigate(`/tasks/${task._id}`)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Task Cards — mobile ── */}
          <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
            {paged.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                onClick={() => navigate(`/tasks/${task._id}`)}
              />
            ))}
          </div>

          {/* ── Pagination ── */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs text-[var(--text-muted)]">
                Showing <span className="font-semibold text-[var(--text-secondary)]">{rangeStart}–{rangeEnd}</span> of{' '}
                <span className="font-semibold text-[var(--text-secondary)]">{filtered.length}</span>
              </span>
              <Pagination currentPage={safePage} totalPages={pageCount} onChange={setPage} />
            </div>
          )}
        </>
      )}

      {/* ── Assign Task Modal (no fixed projectId — user selects it inside) ── */}
      <CreateTaskModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        projectId={null}
        onCreated={() => {
          setShowCreate(false);
          refresh();
        }}
      />
    </div>
  );
};

export default AssignTaskPage;
