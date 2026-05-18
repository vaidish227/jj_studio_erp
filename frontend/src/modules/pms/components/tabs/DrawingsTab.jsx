import React from 'react';
import { FileText, Upload } from 'lucide-react';
import { Button } from '../../../../shared/components';
import PermissionGate from '../../../../shared/components/PermissionGate/PermissionGate';
import DrawingStatusBadge from '../DrawingStatusBadge';

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
  : '—';

const DrawingCard = ({ drawing }) => (
  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--primary)]/40 transition-all">
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center shrink-0">
        <FileText size={16} className="text-[var(--accent-blue)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{drawing.title}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 capitalize">
          {drawing.drawingType?.replace(/_/g, ' ')} · v{drawing.version || 1}
        </p>
      </div>
      <DrawingStatusBadge status={drawing.status} />
    </div>

    <div className="flex items-center gap-4 mt-3 text-xs text-[var(--text-muted)]">
      <span>By {drawing.uploadedBy?.name || '—'}</span>
      <span className="ml-auto">{fmt(drawing.createdAt)}</span>
    </div>

    {drawing.fileUrl && (
      <a
        href={drawing.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
      >
        View file
      </a>
    )}
  </div>
);

const DrawingsTab = ({ project, drawings }) => {
  const hasNone = drawings.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">
          {drawings.length} drawing{drawings.length !== 1 ? 's' : ''}
        </p>
        <PermissionGate permission="drawings.upload">
          <Button variant="outline" disabled title="Upload available in Drawing Library">
            <Upload size={14} className="mr-1.5" />
            Upload Drawing
          </Button>
        </PermissionGate>
      </div>

      {hasNone ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <FileText size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No drawings uploaded yet.</p>
          <p className="text-xs mt-1">Use the Drawing Library to upload drawings for this project.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {drawings.map((d) => (
            <DrawingCard key={d._id} drawing={d} />
          ))}
        </div>
      )}
    </div>
  );
};

export default DrawingsTab;
