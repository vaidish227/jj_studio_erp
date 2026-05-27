import React from 'react';
import { ExternalLink } from 'lucide-react';

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
  : '—';

const DrawingVersionHistory = ({ revisionHistory = [] }) => {
  if (!revisionHistory.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-2">
        Revision History
      </p>
      {[...revisionHistory].reverse().map((entry, idx) => (
        <div
          key={idx}
          className="flex items-start gap-3 py-2 px-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]"
        >
          <span className="text-[10px] font-black text-[var(--text-muted)] bg-[var(--border)] px-1.5 py-0.5 rounded shrink-0">
            v{entry.version}
          </span>
          <div className="flex-1 min-w-0">
            {entry.notes && (
              <p className="text-xs text-[var(--text-primary)] mb-0.5">{entry.notes}</p>
            )}
            <p className="text-[10px] text-[var(--text-muted)]">
              {entry.uploadedBy?.name || '—'} · {fmt(entry.uploadedAt)}
            </p>
          </div>
          {entry.fileUrl && (
            <a
              href={entry.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      ))}
    </div>
  );
};

export default DrawingVersionHistory;
