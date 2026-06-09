import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FolderOpen, Plus, Search, LayoutGrid, List as ListIcon, X } from 'lucide-react';
import { Button, Select, Loader } from '../../../shared/components';
import PermissionGate from '../../../shared/components/PermissionGate/PermissionGate';
import useDrawings from '../hooks/useDrawings';
import DrawingCard, { DRAWING_TYPE_LABELS } from '../components/DrawingCard';
import DrawingListRow from '../components/DrawingListRow';
import UploadDrawingModal from '../components/UploadDrawingModal';
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

const DrawingLibraryPage = () => {
  const location  = useLocation();
  const navigate  = useNavigate();
  const toast     = useToast();

  const isPendingTab = location.pathname.includes('pending-approvals');

  const { drawings, isLoading, error, filters, updateFilter, refresh } = useDrawings(
    isPendingTab ? { status: 'sent_for_approval' } : {}
  );

  useEffect(() => {
    if (isPendingTab) updateFilter('status', 'sent_for_approval');
  }, [isPendingTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // View-level state (client-side search / project / sort / layout)
  const [viewMode, setViewMode]         = useState(readView);
  const [search, setSearch]             = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [sortBy, setSortBy]             = useState('newest');

  const setView = (m) => {
    setViewMode(m);
    try { localStorage.setItem('drawingsView', m); } catch { /* ignore */ }
  };

  // Modal state
  const [showUpload, setShowUpload] = useState(false);
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

  const hasClientFilters = !!(search.trim() || projectFilter);
  const clearClientFilters = () => { setSearch(''); setProjectFilter(''); };

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
        <PermissionGate permission="drawings.upload">
          <Button onClick={() => setShowUpload(true)}>
            <Plus size={15} className="mr-1" />
            Upload Drawing
          </Button>
        </PermissionGate>
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

      {/* ── Toolbar: search · sort · view toggle ───────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, zone, type, project…"
              className="w-full pl-9 pr-8 py-2 text-sm rounded-lg bg-[var(--surface)] border border-[var(--border)]
                         text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                         focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 focus:outline-none transition-colors"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="w-44">
              <Select value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
            </div>
            <div className="flex items-center bg-[var(--surface)] border border-[var(--border)] rounded-lg p-0.5">
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
                  className={`p-1.5 rounded-md transition-colors
                    ${viewMode === mode
                      ? 'bg-[var(--primary)] text-white'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Status pills + type + project (All tab only) */}
        {!isPendingTab && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {STATUS_FILTERS.map((f) => {
                const isActive = (filters.status || '') === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => updateFilter('status', f.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                      ${isActive
                        ? 'bg-[var(--primary)] text-white border-transparent shadow-sm'
                        : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--primary)]/40 hover:text-[var(--primary)]'}`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div className="ml-auto flex items-center gap-2">
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
      ) : viewMode === 'list' ? (
        <div className="space-y-2">
          {visibleDrawings.map((d) => (
            <DrawingListRow
              key={d._id}
              drawing={d}
              onSendForApproval={handleSendForApproval}
              onApprove={(dr) => setApproving(dr)}
              onRelease={(dr) => setReleasing(dr)}
              onRevise={(dr) => setRevising(dr)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleDrawings.map((d) => (
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

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <UploadDrawingModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        projectId={null}
        onUploaded={refresh}
      />
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
