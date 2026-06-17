import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ChevronDown, ChevronUp, Clock, AlertCircle, MessageCircle, GitBranch, Eye, CheckCircle2, Download } from 'lucide-react';
import { Button } from '../../../shared/components';
import { getParentTaskId } from '../utils/workItem';
import PermissionGate from '../../../shared/components/PermissionGate/PermissionGate';
import DrawingStatusBadge from './DrawingStatusBadge';
import DrawingVersionHistory from './DrawingVersionHistory';
import DesignCommentThread from './DesignCommentThread';
import RevisionRequestPanel from './RevisionRequestPanel';
import PDReviewModal from './PDReviewModal';
import PreviewDrawingModal from './PreviewDrawingModal';
import DrawingPreviewThumb from './DrawingPreviewThumb';
import { useAuth } from '../../../shared/context/AuthContext';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
  : '—';

export const DRAWING_TYPE_LABELS = {
  plan:              'Plan',
  elevation:         'Elevation',
  civil:             'Civil',
  electrical:        'Electrical',
  plumbing:          'Plumbing',
  technical_detail:  'Technical Detail',
  ac_coordination:   'AC Coordination',
  automation:        'Automation',
  kitchen:           'Kitchen',
  bathroom:          'Bathroom',
  '3d_render':       '3D Render',
  concept:           'Concept',
  material_selection:'Material Selection',
  site_photo:        'Site Photo',
  other:             'Other',
};

const DrawingCard = ({ drawing, onSendForApproval, onApprove, onRelease, onRevise, onUpdated }) => {
  const [showHistory,   setShowHistory]   = useState(false);
  const [showComments,  setShowComments]  = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const hasHistory = drawing.revisionHistory?.length > 0;

  // Phase 2 — Principal Designer review status (only fetched for 3D drawings)
  const { hasPermission } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Centralized workflow: a drawing's parent Task is the single work item.
  // Card click + designer work-actions open that task's unified workspace
  // (/tasks/:taskId) so the Tasks tab and Drawings tab never diverge.
  const parentTaskId = getParentTaskId(drawing);
  const openWorkspace = () => { if (parentTaskId) navigate(`/tasks/${parentTaskId}`); };
  // Route designer work-actions (Revise / Send-for-Approval / Re-submit) to the
  // task page when linked; fall back to the legacy inline modal only for orphan
  // drawings that have no taskId.
  const designerWork = (fallback) => () => {
    if (parentTaskId) openWorkspace();
    else fallback?.(drawing);
  };

  const [pdReview, setPDReview] = useState(null);
  const [pdMode, setPDMode] = useState(null); // 'request' | 'respond' | null
  const isThreeD = drawing.drawingType === '3d_render';

  // Phase 5 — Preview opens an in-app modal (zoom + annotation tools).
  // Download still fetches a signed URL and triggers a browser download.
  const [busy, setBusy] = useState(null); // 'download' | null
  const [previewOpen, setPreviewOpen] = useState(false);

  const handlePreview = () => setPreviewOpen(true);

  const handleDownload = async () => {
    if (busy) return;
    setBusy('download');
    try {
      const res = await pmsService.getDrawingDownloadUrl(drawing._id);
      if (res?.url) {
        // Use a hidden anchor so we don't navigate the page away.
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
    } finally { setBusy(null); }
  };

  useEffect(() => {
    if (!isThreeD || !drawing?._id) {
      setPDReview(null);
      return;
    }
    pmsService.getDrawingPDReview(drawing._id)
      .then((res) => setPDReview(res?.approval || null))
      .catch(() => setPDReview(null));
  }, [drawing?._id, isThreeD, drawing?.updatedAt]);

  const canRequestPD = isThreeD && hasPermission('approvals.create') && (!pdReview || pdReview.status !== 'pending');
  const canRespondPD = isThreeD && hasPermission('pd.review.respond') && pdReview?.status === 'pending';
  const pdApproved = pdReview?.status === 'approved';

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-3
                    hover:border-[var(--primary)]/40 transition-all duration-150">

      {/* Thumbnail preview */}
      {drawing.fileUrl && (
        <DrawingPreviewThumb
          drawing={drawing}
          compact
          className="w-full h-36 rounded-xl"
        />
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center shrink-0">
          <FileText size={16} className="text-[var(--accent-blue)]" />
        </div>
        <div
          className={`flex-1 min-w-0 ${parentTaskId ? 'cursor-pointer group/title' : ''}`}
          onClick={parentTaskId ? openWorkspace : undefined}
          title={parentTaskId ? 'Open in workspace' : undefined}
        >
          <div className="flex items-center gap-2 mb-0.5">
            <p className={`text-sm font-semibold truncate leading-snug text-[var(--text-primary)] ${parentTaskId ? 'group-hover/title:text-[var(--primary)] transition-colors' : ''}`}>
              {drawing.title}
            </p>
            <span className="text-[10px] font-black text-[var(--text-muted)] shrink-0 bg-[var(--border)] px-1.5 py-0.5 rounded">
              v{drawing.version}
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {DRAWING_TYPE_LABELS[drawing.drawingType] || drawing.drawingType}
            {drawing.projectId?.name && ` · ${drawing.projectId.name}`}
          </p>
        </div>
        <DrawingStatusBadge status={drawing.status} />
      </div>

      {/* Rejection banner */}
      {drawing.status === 'rejected' && drawing.rejectionReason && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[var(--error)]/5 border border-[var(--error)]/20">
          <AlertCircle size={13} className="text-[var(--error)] shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--error)] leading-snug">{drawing.rejectionReason}</p>
        </div>
      )}

      {/* Approved remarks */}
      {drawing.status === 'approved' && drawing.remarks && (
        <p className="text-xs text-[var(--text-muted)] italic px-1">{drawing.remarks}</p>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <span>{drawing.uploadedBy?.name || '—'}</span>
        <span className="ml-auto">{fmt(drawing.createdAt)}</span>
      </div>

      {/* Zone + description */}
      {(drawing.zoneName || drawing.description) && (
        <div className="space-y-0.5 text-xs">
          {drawing.zoneName && (
            <p className="text-[var(--text-secondary)]">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mr-1.5">Zone</span>
              {drawing.zoneName}
            </p>
          )}
          {drawing.description && (
            <p className="text-[var(--text-muted)] leading-snug line-clamp-2">{drawing.description}</p>
          )}
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-[var(--border)]">
        {drawing.fileUrl && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handlePreview}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg
                         text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
              title="Preview & annotate"
            >
              <Eye size={11} /> Preview
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={busy === 'download'}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg
                         text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors disabled:opacity-50"
              title="Download original file"
            >
              <Download size={11} /> Download
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {(drawing.status === 'draft' || drawing.status === 'rejected') && (
            <PermissionGate permission="drawings.upload">
              <Button size="sm" variant="ghost" onClick={designerWork(onRevise)}>
                Revise
              </Button>
            </PermissionGate>
          )}

          {drawing.status === 'draft' && (
            <PermissionGate permission="drawings.upload">
              <Button size="sm" onClick={designerWork(onSendForApproval)}>
                Send for Approval
              </Button>
            </PermissionGate>
          )}

          {drawing.status === 'rejected' && (
            <PermissionGate permission="drawings.upload">
              <Button size="sm" onClick={designerWork(onSendForApproval)}>
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

          {/* Phase 2 — PD review on 3D drawings */}
          {canRequestPD && (
            <Button size="sm" variant="outline" onClick={() => setPDMode('request')}>
              <Eye size={11} className="mr-1" /> Send to PD
            </Button>
          )}
          {canRespondPD && (
            <Button size="sm" onClick={() => setPDMode('respond')}>
              <Eye size={11} className="mr-1" /> PD Review
            </Button>
          )}
          {pdApproved && (
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider
                             text-[var(--success)] bg-[var(--success)]/10 px-2 py-1 rounded-md">
              <CheckCircle2 size={10} /> PD Approved
            </span>
          )}
          {pdReview?.status === 'pending' && !canRespondPD && (
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider
                             text-[var(--warning)] bg-[var(--warning)]/10 px-2 py-1 rounded-md">
              <Clock size={10} /> Awaiting PD
            </span>
          )}
        </div>

        {/* Collaboration toggles */}
        <div className="flex items-center gap-2 ml-auto">
          <PermissionGate permission="design.comment">
            <button
              type="button"
              onClick={() => { setShowComments((v) => !v); setShowRevisions(false); setShowHistory(false); }}
              className={`flex items-center gap-1 text-[10px] font-semibold transition-colors
                ${showComments ? 'text-[var(--accent-blue)]' : 'text-[var(--text-muted)] hover:text-[var(--accent-blue)]'}`}
            >
              <MessageCircle size={11} />
              Comments
            </button>
          </PermissionGate>

          <button
            type="button"
            onClick={() => { setShowRevisions((v) => !v); setShowComments(false); setShowHistory(false); }}
            className={`flex items-center gap-1 text-[10px] font-semibold transition-colors
              ${showRevisions ? 'text-[var(--error)]' : 'text-[var(--text-muted)] hover:text-[var(--error)]'}`}
          >
            <GitBranch size={11} />
            Revisions
          </button>

          {hasHistory && (
            <button
              type="button"
              onClick={() => { setShowHistory((v) => !v); setShowComments(false); setShowRevisions(false); }}
              className={`flex items-center gap-1 text-[10px] font-semibold transition-colors
                ${showHistory ? 'text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-[var(--primary)]'}`}
            >
              <Clock size={11} />
              History
              {showHistory ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          )}
        </div>
      </div>

      {/* Submission notes (shown when in review) */}
      {drawing.status === 'sent_for_approval' && drawing.submissionNotes && (
        <div className="px-3 py-2 rounded-lg bg-[var(--warning)]/5 border border-[var(--warning)]/20">
          <p className="text-[10px] font-black text-[var(--warning)] uppercase tracking-wider mb-0.5">
            Submission Notes
          </p>
          <p className="text-xs text-[var(--text-secondary)]">{drawing.submissionNotes}</p>
        </div>
      )}

      {/* Version history */}
      {showHistory && (
        <div className="border-t border-[var(--border)] pt-3">
          <DrawingVersionHistory drawing={drawing} revisionHistory={drawing.revisionHistory} />
        </div>
      )}

      {/* Comment thread */}
      {showComments && (
        <div className="border-t border-[var(--border)] pt-3">
          <DesignCommentThread drawingId={drawing._id} />
        </div>
      )}

      {/* Revision requests */}
      {showRevisions && (
        <div className="border-t border-[var(--border)] pt-3">
          <RevisionRequestPanel drawingId={drawing._id} />
        </div>
      )}

      {/* Phase 2 — PD Review modal */}
      {pdMode && (
        <PDReviewModal
          drawing={drawing}
          mode={pdMode}
          isOpen={!!pdMode}
          onClose={() => setPDMode(null)}
          onDone={() => { onUpdated?.(); setPDMode(null); }}
        />
      )}

      {/* Phase 6 — In-app preview with zoom + annotation tools */}
      {previewOpen && (
        <PreviewDrawingModal
          drawing={drawing}
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
};

export default DrawingCard;
