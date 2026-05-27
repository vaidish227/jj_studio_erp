import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FolderOpen, Plus, Filter } from 'lucide-react';
import { Button, Select, Loader } from '../../../shared/components';
import PermissionGate from '../../../shared/components/PermissionGate/PermissionGate';
import useDrawings from '../hooks/useDrawings';
import DrawingCard, { DRAWING_TYPE_LABELS } from '../components/DrawingCard';
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

const DrawingLibraryPage = () => {
  const location  = useLocation();
  const navigate  = useNavigate();
  const toast     = useToast();

  const isPendingTab = location.pathname.includes('pending-approvals');

  const { drawings, isLoading, error, filters, updateFilter, refresh } = useDrawings(
    isPendingTab ? { status: 'sent_for_approval' } : {}
  );

  // Sync to pending-approvals route if filter changed externally
  useEffect(() => {
    if (isPendingTab) updateFilter('status', 'sent_for_approval');
  }, [isPendingTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Modal state
  const [showUpload, setShowUpload]   = useState(false);
  const [revising, setRevising]       = useState(null);
  const [approving, setApproving]     = useState(null);
  const [releasing, setReleasing]     = useState(null);
  const [sendingId, setSendingId]     = useState(null);

  const handleSendForApproval = async (drawing) => {
    setSendingId(drawing._id);
    try {
      await pmsService.sendForApproval(drawing._id);
      toast.success('Sent for approval');
      refresh();
    } catch (err) {
      toast.error(err || 'Failed to send for approval');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">

      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue)]/10 flex items-center justify-center">
            <FolderOpen size={20} className="text-[var(--accent-blue)]" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[var(--text-primary)]">
              Drawing Library
            </h1>
            <p className="text-xs text-[var(--text-muted)]">Design & Drawing Management</p>
          </div>
        </div>
        <PermissionGate permission="drawings.upload">
          <Button onClick={() => setShowUpload(true)}>
            <Plus size={15} className="mr-1" />
            Upload Drawing
          </Button>
        </PermissionGate>
      </div>

      {/* Tab bar */}
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

      {/* Filter bar — only shown on "All" tab */}
      {!isPendingTab && (
        <div className="flex items-center gap-3 flex-wrap">
          <Filter size={14} className="text-[var(--text-muted)] shrink-0" />

          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_FILTERS.map((f) => {
              const isActive = (filters.status || '') === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => updateFilter('status', f.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                    ${isActive
                      ? 'bg-[var(--primary)] text-black'
                      : 'bg-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]'}`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="ml-auto w-48">
            <Select
              value={filters.drawingType || ''}
              onChange={(val) => updateFilter('drawingType', val)}
              options={DRAWING_TYPE_OPTIONS}
            />
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader />
        </div>
      ) : error ? (
        <div className="text-center py-16 text-[var(--error)] text-sm">{error}</div>
      ) : drawings.length === 0 ? (
        <div className="text-center py-24 text-[var(--text-muted)]">
          <FolderOpen size={40} className="mx-auto mb-4 opacity-20" />
          <p className="text-sm">
            {isPendingTab ? 'No drawings pending approval.' : 'No drawings found.'}
          </p>
          {!isPendingTab && (
            <p className="text-xs mt-1">
              Upload the first drawing to get started.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {drawings.map((d) => (
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

      {/* Modals */}
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
