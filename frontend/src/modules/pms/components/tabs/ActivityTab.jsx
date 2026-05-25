import React from 'react';
import {
  FilePlus, Edit, Trash2, CheckCircle2, XCircle, Upload,
  Send, Users, RotateCcw, RefreshCw, MessageSquare,
} from 'lucide-react';
import { Button, Loader } from '../../../../shared/components';
import useActivityLog from '../../hooks/useActivityLog';

const ACTION_CONFIG = {
  created:              { icon: FilePlus,      color: 'text-[var(--primary)]',      bg: 'bg-[var(--primary)]/10' },
  updated:              { icon: Edit,          color: 'text-[var(--accent-blue)]',  bg: 'bg-[var(--accent-blue)]/10' },
  deleted:              { icon: Trash2,        color: 'text-[var(--error)]',        bg: 'bg-[var(--error)]/10' },
  status_changed:       { icon: RefreshCw,     color: 'text-[var(--warning)]',      bg: 'bg-[var(--warning)]/10' },
  assigned:             { icon: Users,         color: 'text-[var(--accent-teal)]',  bg: 'bg-[var(--accent-teal)]/10' },
  approved:             { icon: CheckCircle2,  color: 'text-[var(--success)]',      bg: 'bg-[var(--success)]/10' },
  rejected:             { icon: XCircle,       color: 'text-[var(--error)]',        bg: 'bg-[var(--error)]/10' },
  released:             { icon: Send,          color: 'text-[var(--accent-blue)]',  bg: 'bg-[var(--accent-blue)]/10' },
  sent_for_approval:    { icon: Send,          color: 'text-[var(--primary)]',      bg: 'bg-[var(--primary)]/10' },
  revision_requested:   { icon: RotateCcw,     color: 'text-[var(--warning)]',      bg: 'bg-[var(--warning)]/10' },
  commented:            { icon: MessageSquare, color: 'text-[var(--text-muted)]',   bg: 'bg-[var(--border)]' },
  team_updated:         { icon: Users,         color: 'text-[var(--accent-teal)]',  bg: 'bg-[var(--accent-teal)]/10' },
  kickstart_updated:    { icon: CheckCircle2,  color: 'text-[var(--success)]',      bg: 'bg-[var(--success)]/10' },
  checklist_updated:    { icon: CheckCircle2,  color: 'text-[var(--primary)]',      bg: 'bg-[var(--primary)]/10' },
  uploaded:             { icon: Upload,        color: 'text-[var(--accent-blue)]',  bg: 'bg-[var(--accent-blue)]/10' },
};

const fmtTime = (d) => {
  const date = new Date(d);
  const now  = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const ENTITY_LABELS = {
  project: 'Project', task: 'Task', drawing: 'Drawing',
  milestone: 'Milestone', approval: 'Approval', material: 'Material',
  purchase_order: 'PO', site_visit: 'Site Visit', site_log: 'Site Log',
  whatsapp_group: 'WhatsApp',
};

const ActivityTab = ({ project }) => {
  const { logs, isLoading, error, hasMore, loadMore, refresh } = useActivityLog(project._id);

  if (isLoading && logs.length === 0) {
    return <div className="flex justify-center py-16"><Loader label="Loading activity…" /></div>;
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-[var(--error)] mb-3">{error}</p>
        <Button variant="ghost" size="sm" onClick={refresh}>Retry</Button>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[var(--border)] flex items-center justify-center mb-3">
          <RefreshCw size={20} className="text-[var(--text-muted)]" />
        </div>
        <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">No activity yet</p>
        <p className="text-xs text-[var(--text-muted)]">Actions taken on this project will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Activity Log</h3>
        <button onClick={refresh} className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors flex items-center gap-1">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="relative pl-5 space-y-0">
        <div className="absolute left-2 top-2 bottom-2 w-px bg-[var(--border)]" />

        {logs.map((log) => {
          const cfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.updated;
          const Icon = cfg.icon;
          return (
            <div key={log._id} className="relative flex gap-3 pb-5 last:pb-0">
              <div className={`absolute -left-3.5 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 border-2 border-[var(--surface)] ${cfg.bg}`}>
                <Icon size={10} className={cfg.color} />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm text-[var(--text-primary)] leading-snug">{log.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-semibold text-[var(--text-muted)]">
                    {log.actorId?.name || 'System'}
                  </span>
                  <span className="text-[var(--border)]">·</span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {ENTITY_LABELS[log.entityType] || log.entityType}
                  </span>
                  <span className="text-[var(--border)]">·</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{fmtTime(log.createdAt)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div className="pt-4 text-center">
          <Button variant="ghost" size="sm" onClick={loadMore} disabled={isLoading}>
            {isLoading ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ActivityTab;
