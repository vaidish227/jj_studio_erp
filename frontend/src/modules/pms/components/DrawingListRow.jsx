import { useState } from 'react';
import { FileText, Eye, Download } from 'lucide-react';
import { Button } from '../../../shared/components';
import PermissionGate from '../../../shared/components/PermissionGate/PermissionGate';
import DrawingStatusBadge from './DrawingStatusBadge';
import PreviewDrawingModal from './PreviewDrawingModal';
import { DRAWING_TYPE_LABELS } from './DrawingCard';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
  : '—';

/**
 * DrawingListRow — compact, scannable list-view representation of a drawing.
 * Surfaces the at-a-glance fields plus the primary workflow action, Preview and
 * Download. Deep collaboration (comments / revisions / version history / PD
 * review) lives in the grid card view; the list view is optimised for density.
 */
const DrawingListRow = ({ drawing, onSendForApproval, onApprove, onRelease, onRevise }) => {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

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
    <div className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5
                    hover:border-[var(--primary)]/40 hover:shadow-sm transition-all">
      {/* Icon */}
      <div className="w-9 h-9 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center shrink-0">
        <FileText size={16} className="text-[var(--accent-blue)]" />
      </div>

      {/* Title + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{drawing.title}</p>
          <span className="text-[10px] font-black text-[var(--text-muted)] shrink-0 bg-[var(--border)] px-1.5 py-0.5 rounded">
            v{drawing.version}
          </span>
        </div>
        <p className="text-xs text-[var(--text-muted)] truncate">
          {DRAWING_TYPE_LABELS[drawing.drawingType] || drawing.drawingType}
          {drawing.projectId?.name && ` · ${drawing.projectId.name}`}
          {drawing.zoneName && ` · ${drawing.zoneName}`}
        </p>
      </div>

      {/* Uploader (lg+) */}
      <span className="hidden lg:block text-xs text-[var(--text-muted)] shrink-0 w-28 truncate text-right">
        {drawing.uploadedBy?.name || '—'}
      </span>

      {/* Date (md+) */}
      <span className="hidden md:block text-xs text-[var(--text-muted)] shrink-0 w-20 text-right">
        {fmt(drawing.createdAt)}
      </span>

      {/* Status */}
      <div className="shrink-0"><DrawingStatusBadge status={drawing.status} /></div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {drawing.fileUrl && (
          <>
            <button
              type="button" onClick={() => setPreviewOpen(true)} title="Preview & annotate"
              className="p-1.5 rounded-lg text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
            >
              <Eye size={14} />
            </button>
            <button
              type="button" onClick={handleDownload} disabled={busy} title="Download"
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors disabled:opacity-50"
            >
              <Download size={14} />
            </button>
          </>
        )}

        {(drawing.status === 'draft' || drawing.status === 'rejected') && (
          <PermissionGate permission="drawings.upload">
            <Button size="sm" variant="ghost" onClick={() => onRevise?.(drawing)}>Revise</Button>
          </PermissionGate>
        )}
        {drawing.status === 'draft' && (
          <PermissionGate permission="drawings.upload">
            <Button size="sm" onClick={() => onSendForApproval?.(drawing)}>Send</Button>
          </PermissionGate>
        )}
        {drawing.status === 'rejected' && (
          <PermissionGate permission="drawings.upload">
            <Button size="sm" onClick={() => onSendForApproval?.(drawing)}>Re-submit</Button>
          </PermissionGate>
        )}
        {drawing.status === 'sent_for_approval' && (
          <PermissionGate permission="drawings.approve">
            <Button size="sm" onClick={() => onApprove?.(drawing)}>Review</Button>
          </PermissionGate>
        )}
        {drawing.status === 'approved' && (
          <PermissionGate permission="drawings.release">
            <Button size="sm" onClick={() => onRelease?.(drawing)}>Release</Button>
          </PermissionGate>
        )}
      </div>

      {previewOpen && (
        <PreviewDrawingModal drawing={drawing} isOpen={previewOpen} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
};

export default DrawingListRow;
