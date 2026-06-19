import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Inbox, ListChecks, LayoutGrid, List } from 'lucide-react';
import { useAuth } from '../../../shared/context/AuthContext';
import { useDelegationList } from '../hooks/useDelegationList';
import { DelegationStatusBadge, PriorityChip } from '../components/DelegationStatusBadge';
import CreateDelegationModal from '../components/CreateDelegationModal';
import { UserChip, DeptChip, DueDatePill, ProgressBar, SkeletonCard } from '../components/delegationVisuals';
import { PRIORITY_ACCENT } from '../components/delegationFormat';
import { STATUSES, STATUS_META, PRIORITIES, PRIORITY_META } from '../constants/delegationStatus';

const selectCls =
  'border border-[var(--border)] bg-[var(--surface)] rounded-xl px-3 py-2.5 text-xs font-semibold text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 cursor-pointer';

const QUICK = [
  { key: 'all', label: 'All' },
  { key: 'mine', label: 'Assigned to me' },
  { key: 'created', label: 'Created by me' },
  { key: 'overdue', label: 'Overdue' },
];

const inProgressLike = (s) => ['in_progress', 'review', 'reopened'].includes(s);

// A single delegation card. Renders as a wide row in `list` view, or a compact
// vertical card (badges wrap beneath the meta) in `grid` view — same content
// and visuals either way.
const DelegationCard = ({ d, grid, onClick }) => {
  const accent = PRIORITY_ACCENT[d.priority] || 'var(--text-muted)';
  const showProgress = inProgressLike(d.status) && (d.progressPercent || 0) > 0;
  return (
    <div
      onClick={onClick}
      className="group relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl pl-5 pr-4 py-4 cursor-pointer overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-[var(--primary)]/30"
    >
      {/* Priority accent stripe */}
      <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: accent }} />

      <div className={grid ? 'flex flex-col gap-3' : 'flex items-start gap-3'}>
        <div className={grid ? 'min-w-0' : 'flex-1 min-w-0'}>
          <div className="font-bold text-sm text-[var(--text-primary)] truncate group-hover:text-[var(--primary-active)] transition-colors">
            {d.title}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-mono text-[var(--text-muted)] bg-[var(--bg)] rounded px-1.5 py-0.5">
              {d.trackingId}
            </span>
            {d.departmentId?.name && <DeptChip name={d.departmentId.name} color={d.departmentId.color} />}
            {d.assignedTo?.name ? (
              <UserChip name={d.assignedTo.name} size={20} />
            ) : (
              <span className="text-[var(--text-muted)]">Unassigned</span>
            )}
          </div>
        </div>

        <div className={`flex items-center gap-2 ${grid ? 'flex-wrap' : 'shrink-0'}`}>
          <PriorityChip priority={d.priority} />
          <DelegationStatusBadge status={d.status} />
          <DueDatePill delegation={d} />
        </div>
      </div>

      {showProgress && (
        <div className="mt-3 flex items-center gap-2">
          <ProgressBar value={d.progressPercent} className="flex-1" />
          <span className="text-[10px] font-bold text-[var(--text-muted)] tabular-nums w-9 text-right">
            {Math.round(d.progressPercent)}%
          </span>
        </div>
      )}
    </div>
  );
};

const DelegationListPage = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [quick, setQuick] = useState('all');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [q, setQ] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState(() => localStorage.getItem('delegation.listView') || 'list');

  useEffect(() => { localStorage.setItem('delegation.listView', view); }, [view]);
  const isGrid = view === 'grid';

  const filters = useMemo(() => {
    const f = { limit: 100 };
    if (status) f.status = status;
    if (priority) f.priority = priority;
    if (q.trim()) f.q = q.trim();
    if (quick === 'mine') f.assignedTo = user?._id;
    if (quick === 'created') f.createdBy = user?._id;
    if (quick === 'overdue') f.overdue = 'true';
    return f;
  }, [status, priority, q, quick, user]);

  const { delegations, isLoading, error, refresh } = useDelegationList(filters);
  const canCreate = hasPermission('delegation.create');

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-black shadow-sm shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-active))' }}
          >
            <ListChecks size={22} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2">
              All Delegations
              {!isLoading && !error && (
                <span className="text-xs font-bold text-[var(--text-muted)] bg-[var(--bg)] border border-[var(--border)] rounded-full px-2.5 py-0.5">
                  {delegations.length}
                </span>
              )}
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Browse, filter and manage delegated work.</p>
          </div>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-[var(--primary)] text-black font-semibold rounded-xl px-4 py-2.5 text-sm shadow-sm transition-all duration-200 hover:bg-[var(--primary-hover)] hover:shadow-md hover:shadow-[var(--primary)]/25 active:scale-[0.98]"
          >
            <Plus size={16} /> New Delegation
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface)] p-1 gap-1">
          {QUICK.map((qf) => (
            <button
              key={qf.key}
              onClick={() => setQuick(qf.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                quick === qf.key
                  ? 'bg-[var(--primary)] text-black shadow-sm'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg)]'
              }`}
            >
              {qf.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title…"
            className="pl-9 pr-3 py-2.5 text-sm border border-[var(--border)] bg-[var(--surface)] rounded-xl w-56 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
          />
        </div>
        <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Status: All</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
        <select className={selectCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">Priority: All</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
        </select>

        {/* View toggle */}
        <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 gap-1">
          <button
            type="button"
            aria-label="List view"
            aria-pressed={!isGrid}
            title="List view"
            onClick={() => setView('list')}
            className={`p-2 rounded-lg transition-colors ${
              !isGrid ? 'bg-[var(--primary)] text-black shadow-sm' : 'text-[var(--text-muted)] hover:bg-[var(--bg)]'
            }`}
          >
            <List size={16} />
          </button>
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={isGrid}
            title="Grid view"
            onClick={() => setView('grid')}
            className={`p-2 rounded-lg transition-colors ${
              isGrid ? 'bg-[var(--primary)] text-black shadow-sm' : 'text-[var(--text-muted)] hover:bg-[var(--bg)]'
            }`}
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className={isGrid ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-3'}>
          {Array.from({ length: isGrid ? 6 : 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl py-12 text-center text-[var(--error)] text-sm">
          {error}
        </div>
      ) : delegations.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl py-16 text-center text-[var(--text-muted)]">
          <div className="w-14 h-14 rounded-2xl bg-[var(--bg)] flex items-center justify-center mx-auto">
            <Inbox size={28} className="opacity-50" />
          </div>
          <p className="font-semibold mt-3 text-[var(--text-secondary)]">No delegations found</p>
          <p className="text-xs mt-1">Try a different filter{canCreate ? ' or create one.' : '.'}</p>
          {canCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-2 bg-[var(--primary)] text-black font-semibold rounded-xl px-4 py-2 text-sm hover:bg-[var(--primary-hover)]"
            >
              <Plus size={15} /> New Delegation
            </button>
          )}
        </div>
      ) : (
        <div className={isGrid ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-3'}>
          {delegations.map((d) => (
            <DelegationCard
              key={d._id}
              d={d}
              grid={isGrid}
              onClick={() => navigate(`/delegation/${d._id}`)}
            />
          ))}
        </div>
      )}

      <CreateDelegationModal isOpen={showCreate} onClose={() => setShowCreate(false)} onCreated={refresh} />
    </div>
  );
};

export default DelegationListPage;
