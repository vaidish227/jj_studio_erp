import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, ExternalLink, Clock, AlertCircle } from 'lucide-react';
import { Button } from '../../../shared/components';
import PermissionGate from '../../../shared/components/PermissionGate/PermissionGate';
import DrawingStatusBadge from './DrawingStatusBadge';
import DrawingVersionHistory from './DrawingVersionHistory';

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

const DrawingCard = ({ drawing, onSendForApproval, onApprove, onRelease, onRevise }) => {
  const [showHistory, setShowHistory] = useState(false);
  const hasHistory = drawing.revisionHistory?.length > 0;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-3
                    hover:border-[var(--primary)]/40 transition-all duration-150">

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center shrink-0">
          <FileText size={16} className="text-[var(--accent-blue)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate leading-snug">
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

      {/* Action row */}
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-[var(--border)]">
        {drawing.fileUrl && (
          <a
            href={drawing.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline shrink-0"
          >
            <ExternalLink size={11} />
            View file
          </a>
        )}

        <div className="flex items-center gap-2 ml-auto flex-wrap">
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

        {hasHistory && (
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]
                       hover:text-[var(--primary)] transition-colors ml-auto"
          >
            <Clock size={11} />
            History
            {showHistory ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        )}
      </div>

      {/* Version history */}
      {showHistory && (
        <div className="border-t border-[var(--border)] pt-3">
          <DrawingVersionHistory revisionHistory={drawing.revisionHistory} />
        </div>
      )}
    </div>
  );
};

export default DrawingCard;
