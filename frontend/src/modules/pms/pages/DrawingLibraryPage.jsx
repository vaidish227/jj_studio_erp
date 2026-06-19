import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FolderOpen, Search, LayoutGrid, List as ListIcon, Layers, X } from 'lucide-react';
import { Select, Loader, Pagination } from '../../../shared/components';
import PermissionGate from '../../../shared/components/PermissionGate/PermissionGate';
import useDrawings from '../hooks/useDrawings';
import DrawingCard, { DRAWING_TYPE_LABELS } from '../components/DrawingCard';
import DrawingListRow from '../components/DrawingListRow';
import ProjectDrawingGroup from '../components/ProjectDrawingGroup';
import ReviseDrawingModal from '../components/ReviseDrawingModal';
import ApproveDrawingModal from '../components/ApproveDrawingModal';
import ReleaseDrawingModal from '../components/ReleaseDrawingModal';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

const STATUS_FILTERS = [
  { label: 'All',              value: '' },
  { label: 'Draft',            value: 'draft' },
  { label: 'Sent for Approval',value: 'sent_for_approval' },
  { label: 'Approved',         value: 'approved' },
  { label: 'Rejected',         value: 'rejected' },
  { label: 'Released to Site', value: 'released_to_site' },
];

const DRAWING_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  ...Object.entries(DRAWING_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

const SORT_OPTIONS = [
  { value: 'newest',  label: 'Newest first' },
  { value: 'oldest',  label: 'Oldest first' },
  { value: 'name',    label: 'Name (A–Z)' },
  { value: 'version', label: 'Version (high–low)' },
  { value: 'status',  label: 'Status' },
];

const readView = () => {
  try { return localStorage.getItem('drawingsView') || 'grid'; } catch { return 'grid'; }
};

const readGroupBy = () => {
  try { return localStorage.getItem('drawingsGroupBy') || 'project'; } catch { return 'project'; }
};

const PAGE_SIZE = 25;
// Pull a large slice so the project-grouped view shows every project's drawings
// in one pass (the flat view paginates client-side at PAGE_SIZE regardless).
const FETCH_LIMIT = 500;

const DrawingLibraryPage = () => {
  const location  = useLocation();
  const navigate  = useNavigate();
  const toast     = useToast();

  const isPendingTab = location.pathname.includes('pending-approvals');

  const { drawings, isLoading, error, filters, updateFilter, refresh } = useDrawings(
    isPendingTab
      ? { status: 'sent_for_approval', limit: FETCH_LIMIT }
      : { limit: FETCH_LIMIT }
  );

  useEffect(() => {
    if (isPendingTab) updateFilter('status', 'sent_for_approval');
  }, [isPendingTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // View-level state (client-side search / project / sort / layout / grouping)
  const [viewMode, setViewMode]         = useState(readView);
  const [groupBy, setGroupBy]           = useState(readGroupBy);
  const [search, setSearch]             = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [sortBy, setSortBy]             = useState('newest');

  const grouped = groupBy === 'project';

  const setView = (m) => {
    setViewMode(m);
    try { localStorage.setItem('drawingsView', m); } catch { /* ignore */ }
  };

  const toggleGroupBy = () => {
    setGroupBy((g) => {
      const next = g === 'project' ? 'none' : 'project';
      try { localStorage.setItem('drawingsGroupBy', next); } catch { /* ignore */ }
      return next;
    });
  };

  // Modal state
  const [revising, setRevising]     = useState(null);
  const [approving, setApproving]   = useState(null);
  const [releasing, setReleasing]   = useState(null);

  const handleSendForApproval = async (drawing) => {
    try {
      await pmsService.sendForApproval(drawing._id);
      toast.success('Sent for approval');
      refresh();
    } catch (err) {
      toast.error(err || 'Failed to send for approval');
    }
  };

  // Project options derived from the loaded set.
  const projectOptions = useMemo(() => {
    const map = new Map();
    drawings.forEach((d) => { if (d.projectId?._id) map.set(d.projectId._id, d.projectId.name || 'Untitled'); });
    return [{ value: '', label: 'All Projects' }, ...[...map].map(([value, label]) => ({ value, label }))];
  }, [drawings]);

  // Apply client-side search + project filter + sort.
  const visibleDrawings = useMemo(() => {
    let list = drawings;
    if (projectFilter) list = list.filter((d) => d.projectId?._id === projectFilter);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((d) =>
        (d.title || '').toLowerCase().includes(q) ||
        (d.zoneName || '').toLowerCase().includes(q) ||
        (DRAWING_TYPE_LABELS[d.drawingType] || d.drawingType || '').toLowerCase().includes(q) ||
        (d.projectId?.name || '').toLowerCase().includes(q) ||
        (d.uploadedBy?.name || '').toLowerCase().includes(q)
      );
    }

    const sorted = [...list];
    switch (sortBy) {
      case 'oldest':  sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
      case 'name':    sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '')); break;
      case 'version': sorted.sort((a, b) => (b.version || 0) - (a.version || 0)); break;
      case 'status':  sorted.sort((a, b) => (a.status || '').localeCompare(b.status || '')); break;
      default:        sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return sorted;
  }, [drawings, projectFilter, search, sortBy]);

  // Project-grouped view — bucket the filtered/sorted set by project, ordered
  // by project name (drawings with no project sink to the bottom).
  const projectGroups = useMemo(() => {
    const map = new Map();
    visibleDrawings.forEach((d) => {
      const pid = d.projectId?._id || '__unassigned__';
      if (!map.has(pid)) map.set(pid, { project: d.projectId || null, drawings: [] });
      map.get(pid).drawings.push(d);
    });
    return [...map.values()].sort((a, b) => {
      if (!a.project) return 1;
      if (!b.project) return -1;
      return (a.project.name || '').localeCompare(b.project.name || '');
    });
  }, [visibleDrawings]);

  const hasClientFilters = !!(search.trim() || projectFilter);
  const clearClientFilters = () => { setSearch(''); setProjectFilter(''); };

  // ── Pagination — 25 per page over the filtered/sorted set ────────────────
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, projectFilter, sortBy, filters, isPendingTab]);

  const pageCount = Math.max(1, Math.ceil(visibleDrawings.length / PAGE_SIZE));
  const safePage  = Math.min(page, pageCount);
  const pagedDrawings = useMemo(
    () => visibleDrawings.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [visibleDrawings, safePage]
  );
  const rangeStart = visibleDrawings.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd   = Math.min(safePage * PAGE_SIZE, visibleDrawings.length);

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue)]/10 flex items-center justify-center">
            <FolderOpen size={20} className="text-[var(--accent-blue)]" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[var(--text-primary)]">Drawing Library</h1>
            <p className="text-xs text-[var(--text-muted)]">Design &amp; Drawing Management</p>
          </div>
        </div>
        {/* Upload happens within a project context (a project's Drawings tab /
            task workspace / Master Sheet), where the projectId is known. The
            cross-project library has no project selector, so a global upload
            button here cannot produce a valid drawing — intentionally omitted. */}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => navigate('/drawings')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors
            ${!isPendingTab
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
        >
          All Drawings
        </button>
        <PermissionGate permission="drawings.approve">
          <button
            type="button"
            onClick={() => navigate('/drawings/pending-approvals')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors
              ${isPendingTab
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            Pending Approvals
            {isPendingTab && drawings.length > 0 && (
              <span className="ml-1.5 text-[10px] font-black bg-[var(--warning)]/10 text-[var(--warning)] px-1.5 py-0.5 rounded-full">
                {drawings.length}
              </span>
            )}
          </button>
        </PermissionGate>
      </div>

      {/* ── Toolbar — one contained bar: search · view controls · filters ──── */}
      {/* No `overflow-hidden` here: it would clip the Select dropdown menus,
          which render as absolutely-positioned lists overflowing the card. */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        {/* Row 1 — search (fills) + view controls (grouped, right) */}
        <div className="flex items-center gap-2.5 flex-wrap p-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, zone, type, project…"
              className="w-full h-11 pl-10 pr-9 text-sm rounded-xl bg-[var(--surface)] border border-[var(--border)]
                         text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                         focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none transition-colors"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X size={15} />
              </button>
            )}
          </div>

          {/* View controls — sort, then a divider, then grouping + layout */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-44">
              <Select value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
            </div>

            <span className="hidden sm:block h-7 w-px bg-[var(--border)] mx-0.5" aria-hidden="true" />

            <button
              type="button"
              onClick={toggleGroupBy}
              title={grouped ? 'Grouped by project — click for a flat list' : 'Group drawings by project'}
              aria-pressed={grouped}
              className={`inline-flex items-center gap-1.5 h-11 px-3.5 text-xs font-semibold rounded-xl border transition-all
                ${grouped
                  ? 'bg-[var(--primary)] text-white border-transparent shadow-sm'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--primary)]/40 hover:text-[var(--primary)]'}`}
            >
              <Layers size={14} /> By project
            </button>

            <div className="flex items-center h-11 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1">
              {[
                { mode: 'grid', icon: LayoutGrid, label: 'Grid view' },
                { mode: 'list', icon: ListIcon,   label: 'List view' },
              ].map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setView(mode)}
                  title={label}
                  aria-label={label}
                  aria-pressed={viewMode === mode}
                  className={`flex items-center justify-center w-9 h-full rounded-lg transition-colors
                    ${viewMode === mode
                      ? 'bg-[var(--primary)] text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)]'}`}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2 — status filter + scope selects (All Drawings tab only) */}
        {!isPendingTab && (
          <div className="flex items-center gap-3 flex-wrap p-3 border-t border-[var(--border)] bg-[var(--bg)]/30 rounded-b-2xl">
            <div className="flex items-center gap-1.5 flex-wrap">
              {STATUS_FILTERS.map((f) => {
                const isActive = (filters.status || '') === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => updateFilter('status', f.value)}
                    className={`inline-flex items-center h-9 px-3.5 rounded-lg text-xs font-semibold border transition-all
                      ${isActive
                        ? 'bg-[var(--primary)] text-white border-transparent shadow-sm'
                        : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--primary)]/40 hover:text-[var(--primary)]'}`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <div className="w-44">
                <Select
                  value={projectFilter}
                  onChange={setProjectFilter}
                  options={projectOptions}
                />
              </div>
              <div className="w-44">
                <Select
                  value={filters.drawingType || ''}
                  onChange={(val) => updateFilter('drawingType', val)}
                  options={DRAWING_TYPE_OPTIONS}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Result count ───────────────────────────────────────────────────── */}
      {!isLoading && !error && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span className="font-semibold text-[var(--text-secondary)]">{visibleDrawings.length}</span>
          drawing{visibleDrawings.length === 1 ? '' : 's'}
          {grouped && visibleDrawings.length > 0 && (
            <span>across <span className="font-semibold text-[var(--text-secondary)]">{projectGroups.length}</span>{' '}
              project{projectGroups.length === 1 ? '' : 's'}</span>
          )}
          {hasClientFilters && (
            <button type="button" onClick={clearClientFilters}
              className="ml-1 inline-flex items-center gap-1 text-[var(--primary)] hover:underline font-semibold">
              <X size={11} /> Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24"><Loader /></div>
      ) : error ? (
        <div className="text-center py-16 text-[var(--error)] text-sm">{error}</div>
      ) : visibleDrawings.length === 0 ? (
        <div className="text-center py-24 text-[var(--text-muted)]">
          <FolderOpen size={40} className="mx-auto mb-4 opacity-20" />
          <p className="text-sm">
            {drawings.length === 0
              ? (isPendingTab ? 'No drawings pending approval.' : 'No drawings found.')
              : 'No drawings match your filters.'}
          </p>
          {drawings.length === 0 && !isPendingTab && (
            <p className="text-xs mt-1">Upload the first drawing to get started.</p>
          )}
          {hasClientFilters && drawings.length > 0 && (
            <button type="button" onClick={clearClientFilters}
              className="mt-3 text-xs text-[var(--primary)] hover:underline font-semibold">
              Clear filters
            </button>
          )}
        </div>
      ) : grouped ? (
        <div className="space-y-4">
          {projectGroups.map((g) => (
            <ProjectDrawingGroup
              key={g.project?._id || '__unassigned__'}
              project={g.project}
              drawings={g.drawings}
              viewMode={viewMode}
              onSendForApproval={handleSendForApproval}
              onApprove={(dr) => setApproving(dr)}
              onRelease={(dr) => setReleasing(dr)}
              onRevise={(dr) => setRevising(dr)}
            />
          ))}
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            {/* Column set mirrors DrawingListRow — keep the two in sync */}
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg)]/60 text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest">Drawing</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest hidden md:table-cell">Type</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest hidden lg:table-cell">Project</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest hidden xl:table-cell">Uploaded By</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest hidden md:table-cell">Date</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest">Status</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-black uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedDrawings.map((d) => (
                  <DrawingListRow
                    key={d._id}
                    drawing={d}
                    onSendForApproval={handleSendForApproval}
                    onApprove={(dr) => setApproving(dr)}
                    onRelease={(dr) => setReleasing(dr)}
                    onRevise={(dr) => setRevising(dr)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {pagedDrawings.map((d) => (
            <DrawingCard
              key={d._id}
              drawing={d}
              onSendForApproval={handleSendForApproval}
              onApprove={(dr) => setApproving(dr)}
              onRelease={(dr) => setReleasing(dr)}
              onRevise={(dr) => setRevising(dr)}
            />
          ))}
        </div>
      )}

      {/* ── Pagination (flat view only — grouped view shows all per project) ── */}
      {!isLoading && !error && !grouped && visibleDrawings.length > 0 && pageCount > 1 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs text-[var(--text-muted)]">
            Showing <span className="font-semibold text-[var(--text-secondary)]">{rangeStart}–{rangeEnd}</span> of{' '}
            <span className="font-semibold text-[var(--text-secondary)]">{visibleDrawings.length}</span>
          </span>
          <Pagination currentPage={safePage} totalPages={pageCount} onChange={setPage} />
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <ReviseDrawingModal
        isOpen={!!revising}
        onClose={() => setRevising(null)}
        drawing={revising}
        onRevised={() => { setRevising(null); refresh(); }}
      />
      <ApproveDrawingModal
        isOpen={!!approving}
        onClose={() => setApproving(null)}
        drawing={approving}
        onDone={() => { setApproving(null); refresh(); }}
      />
      <ReleaseDrawingModal
        isOpen={!!releasing}
        onClose={() => setReleasing(null)}
        drawing={releasing}
        onReleased={() => { setReleasing(null); refresh(); }}
      />
    </div>
  );
};

export default DrawingLibraryPage;
