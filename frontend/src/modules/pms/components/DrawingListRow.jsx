import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Eye, Download } from 'lucide-react';
import { Button } from '../../../shared/components';
import PermissionGate from '../../../shared/components/PermissionGate/PermissionGate';
import DrawingStatusBadge from './DrawingStatusBadge';
import PreviewDrawingModal from './PreviewDrawingModal';
import { DRAWING_TYPE_LABELS } from './DrawingCard';
import { getParentTaskId } from '../utils/workItem';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
  : '—';

/**
 * DrawingListRow — one <tr> of the Drawing Library table view. Columns are
 * defined by DrawingLibraryPage's <thead>; keep the two in sync. Surfaces the
 * at-a-glance fields plus the primary workflow action, Preview and Download.
 * Deep collaboration (comments / revisions / version history / PD review)
 * lives in the grid card view; the table view is optimised for scanning.
 */
const DrawingListRow = ({ drawing, onSendForApproval, onApprove, onRelease, onRevise, hideProject = false }) => {
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Centralized workflow — name + designer work-actions open the parent task's
  // unified workspace; orphan drawings (no taskId) keep the inline fallback.
  const parentTaskId = getParentTaskId(drawing);
  const openWorkspace = () => { if (parentTaskId) navigate(`/tasks/${parentTaskId}`); };
  const designerWork = (fallback) => () => {
    if (parentTaskId) openWorkspace();
    else fallback?.(drawing);
  };

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
    <tr className="border-t border-[var(--border)] hover:bg-[var(--bg)]/50 transition-colors">
      {/* Drawing — icon, title, version, zone */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center shrink-0">
            <FileText size={14} className="text-[var(--accent-blue)]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-start gap-1.5">
              <p
                className={`text-sm font-semibold text-[var(--text-primary)] leading-snug break-words max-w-[420px] ${parentTaskId ? 'cursor-pointer hover:text-[var(--primary)] transition-colors' : ''}`}
                onClick={parentTaskId ? openWorkspace : undefined}
                title={parentTaskId ? 'Open in workspace' : undefined}
              >
                {drawing.title}
              </p>
              <span className="text-[10px] font-black text-[var(--text-muted)] shrink-0 bg-[var(--border)] px-1.5 py-0.5 rounded mt-0.5">
                v{drawing.version}
              </span>
            </div>
            {drawing.zoneName && (
              <p className="text-[11px] text-[var(--text-muted)] break-words max-w-[420px]">{drawing.zoneName}</p>
            )}
          </div>
        </div>
      </td>

      {/* Type */}
      <td className="px-4 py-2.5 hidden md:table-cell text-xs text-[var(--text-secondary)] whitespace-nowrap">
        {DRAWING_TYPE_LABELS[drawing.drawingType] || drawing.drawingType || '—'}
      </td>

      {/* Project — omitted in the project-grouped view where it's the heading */}
      {!hideProject && (
        <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-[var(--text-secondary)]">
          <span className="block truncate max-w-[220px]" title={drawing.projectId?.name || ''}>{drawing.projectId?.name || '—'}</span>
        </td>
      )}

      {/* Uploaded by */}
      <td className="px-4 py-2.5 hidden xl:table-cell text-xs text-[var(--text-muted)]">
        <span className="block truncate max-w-[140px]" title={drawing.uploadedBy?.name || ''}>{drawing.uploadedBy?.name || '—'}</span>
      </td>

      {/* Date */}
      <td className="px-4 py-2.5 hidden md:table-cell text-xs text-[var(--text-muted)] whitespace-nowrap">
        {fmt(drawing.createdAt)}
      </td>

      {/* Status */}
      <td className="px-4 py-2.5">
        <DrawingStatusBadge status={drawing.status} />
      </td>

      {/* Actions */}
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
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
              <Button size="sm" variant="ghost" onClick={designerWork(onRevise)}>Revise</Button>
            </PermissionGate>
          )}
          {drawing.status === 'draft' && (
            <PermissionGate permission="drawings.upload">
              <Button size="sm" onClick={designerWork(onSendForApproval)}>Send</Button>
            </PermissionGate>
          )}
          {drawing.status === 'rejected' && (
            <PermissionGate permission="drawings.upload">
              <Button size="sm" onClick={designerWork(onSendForApproval)}>Re-submit</Button>
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
      </td>
    </tr>
  );
};

export default DrawingListRow;
