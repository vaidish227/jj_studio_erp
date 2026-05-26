import React, { useState } from 'react';
import { FileText, Plus, Filter } from 'lucide-react';
import { Button, Select } from '../../../../shared/components';
import PermissionGate from '../../../../shared/components/PermissionGate/PermissionGate';
import DrawingCard, { DRAWING_TYPE_LABELS } from '../DrawingCard';
import UploadDrawingModal from '../UploadDrawingModal';
import ReviseDrawingModal from '../ReviseDrawingModal';
import ApproveDrawingModal from '../ApproveDrawingModal';
import ReleaseDrawingModal from '../ReleaseDrawingModal';
import { pmsService } from '../../../../shared/services/pmsService';
import { useToast } from '../../../../shared/notifications/ToastProvider';

const STATUS_FILTERS = [
  { label: 'All',               value: '' },
  { label: 'Draft',             value: 'draft' },
  { label: 'Sent for Approval', value: 'sent_for_approval' },
  { label: 'Approved',          value: 'approved' },
  { label: 'Rejected',          value: 'rejected' },
  { label: 'Released to Site',  value: 'released_to_site' },
];

const DRAWING_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  ...Object.entries(DRAWING_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

const DrawingsTab = ({ project, drawings: allDrawings, onDrawingUpdated }) => {
  const toast = useToast();

  const [statusFilter, setStatusFilter]   = useState('');
  const [typeFilter,   setTypeFilter]     = useState('');
  const [showUpload,   setShowUpload]     = useState(false);
  const [revising,     setRevising]       = useState(null);
  const [approving,    setApproving]      = useState(null);
  const [releasing,    setReleasing]      = useState(null);
  const [sendingId,    setSendingId]      = useState(null);

  const drawings = allDrawings.filter((d) => {
    if (statusFilter && d.status !== statusFilter) return false;
    if (typeFilter   && d.drawingType !== typeFilter) return false;
    return true;
  });

  const handleSendForApproval = async (drawing) => {
    setSendingId(drawing._id);
    try {
      await pmsService.sendForApproval(drawing._id);
      toast.success('Sent for approval');
      onDrawingUpdated?.();
    } catch (err) {
      toast.error(err?.message || 'Failed to send for approval');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="space-y-4">

      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-[var(--text-muted)]">
          {drawings.length} drawing{drawings.length !== 1 ? 's' : ''}
          {(statusFilter || typeFilter) && ` (filtered)`}
        </p>
        <PermissionGate permission="drawings.upload">
          <Button onClick={() => setShowUpload(true)}>
            <Plus size={14} className="mr-1.5" />
            Upload Drawing
          </Button>
        </PermissionGate>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter size={13} className="text-[var(--text-muted)] shrink-0" />
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors
                ${statusFilter === f.value
                  ? 'bg-[var(--primary)] text-black'
                  : 'bg-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto w-44">
          <Select
            value={typeFilter}
            onChange={(val) => setTypeFilter(val)}
            options={DRAWING_TYPE_OPTIONS}
          />
        </div>
      </div>

      {/* Drawing grid */}
      {drawings.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <FileText size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">
            {statusFilter || typeFilter ? 'No drawings match the current filters.' : 'No drawings uploaded yet.'}
          </p>
          {!statusFilter && !typeFilter && (
            <p className="text-xs mt-1">Upload the first drawing to get started.</p>
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
        projectId={project._id}
        onUploaded={() => { setShowUpload(false); onDrawingUpdated?.(); }}
      />

      <ReviseDrawingModal
        isOpen={!!revising}
        onClose={() => setRevising(null)}
        drawing={revising}
        onRevised={() => { setRevising(null); onDrawingUpdated?.(); }}
      />

      <ApproveDrawingModal
        isOpen={!!approving}
        onClose={() => setApproving(null)}
        drawing={approving}
        onDone={() => { setApproving(null); onDrawingUpdated?.(); }}
      />

      <ReleaseDrawingModal
        isOpen={!!releasing}
        onClose={() => setReleasing(null)}
        drawing={releasing}
        onReleased={() => { setReleasing(null); onDrawingUpdated?.(); }}
      />
    </div>
  );
};

export default DrawingsTab;
