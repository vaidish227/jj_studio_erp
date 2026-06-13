import React from 'react';
import { Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

const fmtRelative = (dateStr) => {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)      return 'just now';
  if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)  return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const ACTION_TONE = {
  created:            'bg-[var(--primary)]/15 text-[var(--primary)]',
  updated:            'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]',
  status_changed:     'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]',
  assigned:           'bg-[var(--primary)]/15 text-[var(--primary)]',
  approved:           'bg-[var(--success)]/15 text-[var(--success)]',
  released:           'bg-[var(--success)]/15 text-[var(--success)]',
  rejected:           'bg-[var(--error)]/15 text-[var(--error)]',
  revision_requested: 'bg-[var(--warning)]/15 text-[var(--warning)]',
  deleted:            'bg-[var(--error)]/15 text-[var(--error)]',
  commented:          'bg-[var(--text-muted)]/15 text-[var(--text-muted)]',
};

const initial = (name) => (name || '?').trim().charAt(0).toUpperCase();

const RecentActivityFeed = ({ items = [] }) => {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 lg:p-6 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={16} className="text-[var(--primary)]" />
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Recent Activity</h3>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 py-10 text-center text-sm text-[var(--text-muted)]">
          Nothing new yet.
        </div>
      ) : (
        <ul className="space-y-3 flex-1">
          {items.map((a) => {
            const actionTone = ACTION_TONE[a.action] || 'bg-[var(--text-muted)]/15 text-[var(--text-muted)]';
            return (
              <li key={a._id} className="flex items-start gap-3">
                {/* Avatar dot */}
                <div className="w-8 h-8 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] font-black text-xs flex items-center justify-center shrink-0">
                  {initial(a.actorName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-[var(--text-primary)]">{a.actorName}</span>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${actionTone}`}>
                      {a.action?.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] capitalize">{a.entityType}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                    {a.description}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] mt-0.5">
                    {a.projectId && (
                      <Link
                        to={`/projects/${a.projectId}`}
                        className="hover:text-[var(--primary)] transition-colors truncate font-semibold"
                      >
                        {a.trackingId || a.projectName}
                      </Link>
                    )}
                    <span>· {fmtRelative(a.createdAt)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default RecentActivityFeed;
