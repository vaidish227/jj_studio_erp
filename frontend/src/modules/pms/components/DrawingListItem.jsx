import React, { useState } from 'react';
import { Download, Clock } from 'lucide-react';
import { Button } from '../../../shared/components';
import PermissionGate from '../../../shared/components/PermissionGate/PermissionGate';
import DrawingStatusBadge from './DrawingStatusBadge';
import DrawingPreviewThumb from './DrawingPreviewThumb';
import { DRAWING_TYPE_LABELS } from './DrawingCard';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
  : '—';

/**
 * Compact horizontal row used in list view of DrawingsTab.
 * Carries the same action props as DrawingCard but omits the
 * expandable Comments / Revisions / History panels — those stay
 * available in grid view.
 */
const DrawingListItem = ({
  drawing,
  onSendForApproval,
  onApprove,
  onRelease,
  onRevise,
}) => {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await pmsService.getDrawingDownloadUrl(drawing._id);
      if (res?.url) {
        const a = document.createElement('a');
        a.href = res.url;
        a.rel = 'noopener noreferrer';
        a.download = drawing.fileName || drawing.title || 'drawing';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        toast.error('Download URL unavailable');
      }
    } catch (err) {
      toast.error(err?.message || 'Could not start download');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3
                    flex items-center gap-4 hover:border-[var(--primary)]/40 transition-all">

      {/* Thumbnail */}
      {drawing.fileUrl ? (
        <DrawingPreviewThumb
          drawing={drawing}
          compact
          className="w-20 h-20 rounded-lg shrink-0"
        />
      ) : (
        <div className="w-20 h-20 rounded-lg bg-[var(--bg)] border border-[var(--border)] shrink-0" />
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
            {drawing.title}
          </p>
          <span className="text-[10px] font-black text-[var(--text-muted)] bg-[var(--border)] px-1.5 py-0.5 rounded shrink-0">
            v{drawing.version}
          </span>
          <DrawingStatusBadge status={drawing.status} />
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          {DRAWING_TYPE_LABELS[drawing.drawingType] || drawing.drawingType}
          {drawing.zoneName && (
            <>
              <span className="mx-1.5 opacity-50">·</span>
              <span className="text-[var(--text-secondary)]">Zone: {drawing.zoneName}</span>
            </>
          )}
          <span className="mx-1.5 opacity-50">·</span>
          <span className="inline-flex items-center gap-1">
            <Clock size={10} /> {fmt(drawing.createdAt)}
          </span>
          {drawing.uploadedBy?.name && (
            <>
              <span className="mx-1.5 opacity-50">·</span>
              <span>{drawing.uploadedBy.name}</span>
            </>
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {drawing.fileUrl && (
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy}
            title="Download original"
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)]
                       hover:bg-[var(--primary)]/10 transition-colors disabled:opacity-50"
          >
            <Download size={14} />
          </button>
        )}

        {(drawing.status === 'draft' || drawing.status === 'rejected') && (
          <PermissionGate permission="drawings.upload">
            <Button size="sm" variant="ghost" onClick={() => onRevise?.(drawing)}>
              Revise
            </Button>
          </PermissionGate>
        )}

        {drawing.status === 'draft' && (
          <PermissionGate permission="drawings.upload">
            <Button size="sm" onClick={() => onSendForApproval?.(drawing)}>
              Send for Approval
            </Button>
          </PermissionGate>
        )}

        {drawing.status === 'rejected' && (
          <PermissionGate permission="drawings.upload">
            <Button size="sm" onClick={() => onSendForApproval?.(drawing)}>
              Re-submit
            </Button>
          </PermissionGate>
        )}

        {drawing.status === 'sent_for_approval' && (
          <PermissionGate permission="drawings.approve">
            <Button size="sm" onClick={() => onApprove?.(drawing)}>
              Review
            </Button>
          </PermissionGate>
        )}

        {drawing.status === 'approved' && (
          <PermissionGate permission="drawings.release">
            <Button size="sm" onClick={() => onRelease?.(drawing)}>
              Release to Site
            </Button>
          </PermissionGate>
        )}
      </div>
    </div>
  );
};

export default DrawingListItem;
