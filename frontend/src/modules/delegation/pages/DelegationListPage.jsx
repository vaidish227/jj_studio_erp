import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2, Search, Inbox } from 'lucide-react';
import { useAuth } from '../../../shared/context/AuthContext';
import { useDelegationList } from '../hooks/useDelegationList';
import { DelegationStatusBadge, PriorityChip } from '../components/DelegationStatusBadge';
import CreateDelegationModal from '../components/CreateDelegationModal';
import { STATUSES, STATUS_META, PRIORITIES, PRIORITY_META } from '../constants/delegationStatus';

const selectCls =
  'border border-[var(--border)] bg-[var(--surface)] rounded-lg px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]';

const QUICK = [
  { key: 'all', label: 'All' },
  { key: 'mine', label: 'Assigned to me' },
  { key: 'created', label: 'Created by me' },
  { key: 'overdue', label: 'Overdue' },
];

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
const isOverdue = (d) =>
  d.dueDate && new Date(d.dueDate) < new Date() && !['completed', 'cancelled'].includes(d.status);

const DelegationListPage = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [quick, setQuick] = useState('all');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [q, setQ] = useState('');
  const [showCreate, setShowCreate] = useState(false);

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--text-primary)]">All Delegations</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Browse, filter and manage delegated work.</p>
        </div>
        {canCreate && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-[var(--primary)] text-black font-semibold rounded-xl px-4 py-2.5 text-sm hover:bg-[var(--primary-hover)]">
            <Plus size={16} /> New Delegation
          </button>
        )}
      </div>

      {/* Quick filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
          {QUICK.map((qf) => (
            <button
              key={qf.key}
              onClick={() => setQuick(qf.key)}
              className={`px-3 py-2 text-xs font-semibold ${quick === qf.key ? 'bg-[var(--primary)] text-black' : 'text-[var(--text-muted)] hover:bg-[var(--bg)]'}`}
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
            className="pl-9 pr-3 py-2 text-sm border border-[var(--border)] bg-[var(--surface)] rounded-lg w-56"
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
      </div>

      {/* List */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
            <Loader2 className="animate-spin mr-2" size={18} /> Loading…
          </div>
        ) : error ? (
          <div className="py-12 text-center text-[var(--error)] text-sm">{error}</div>
        ) : delegations.length === 0 ? (
          <div className="py-16 text-center text-[var(--text-muted)]">
            <Inbox size={34} className="mx-auto opacity-40" />
            <p className="font-semibold mt-2 text-[var(--text-secondary)]">No delegations found</p>
            <p className="text-xs mt-1">Try a different filter{canCreate ? ' or create one.' : '.'}</p>
          </div>
        ) : (
          delegations.map((d) => (
            <div
              key={d._id}
              onClick={() => navigate(`/delegation/${d._id}`)}
              className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)] last:border-0 hover:bg-[var(--primary)]/5 cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-[var(--text-primary)] truncate">{d.title}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 items-center">
                  <span className="font-mono">{d.trackingId}</span>
                  {d.departmentId?.name && <span>· {d.departmentId.name}</span>}
                  {d.assignedTo?.name && <span>· {d.assignedTo.name}</span>}
                </div>
              </div>
              <PriorityChip priority={d.priority} />
              <DelegationStatusBadge status={d.status} />
              <span className={`text-xs whitespace-nowrap ${isOverdue(d) ? 'text-[var(--error)] font-bold' : 'text-[var(--text-muted)]'}`}>
                {isOverdue(d) ? '⚠ ' : ''}{fmtDate(d.dueDate)}
              </span>
            </div>
          ))
        )}
      </div>

      <CreateDelegationModal isOpen={showCreate} onClose={() => setShowCreate(false)} onCreated={refresh} />
    </div>
  );
};

export default DelegationListPage;
