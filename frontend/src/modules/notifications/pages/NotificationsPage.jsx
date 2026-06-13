import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  X,
  Calendar,
  Users,
  ClipboardList,
  FileText,
  AlertCircle,
  Activity,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useNotifications } from '../../../shared/notifications/NotificationContext';
import { notificationService } from '../../../shared/services/notificationService';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';

const MODULE_OPTIONS = [
  { value: '',         label: 'All Modules' },
  { value: 'crm',      label: 'CRM' },
  { value: 'meeting',  label: 'Meetings' },
  { value: 'pms',      label: 'PMS / Tasks' },
  { value: 'proposal', label: 'Proposals' },
  { value: 'auth',     label: 'Auth / Users' },
  { value: 'system',   label: 'System' },
];

const MODULE_ICONS = {
  crm:      Users,
  meeting:  Calendar,
  pms:      ClipboardList,
  proposal: FileText,
  auth:     Activity,
  system:   AlertCircle,
};

const MODULE_COLORS = {
  crm:      'bg-amber-100 text-amber-700',
  meeting:  'bg-blue-100 text-blue-700',
  pms:      'bg-indigo-100 text-indigo-700',
  proposal: 'bg-emerald-100 text-emerald-700',
  auth:     'bg-purple-100 text-purple-700',
  system:   'bg-slate-100 text-slate-700',
};

const PRIORITY_BADGE = {
  high:   'bg-[var(--error)]/10 text-[var(--error)]',
  normal: 'bg-[var(--primary)]/10 text-[var(--primary)]',
  low:    'bg-[var(--text-muted)]/10 text-[var(--text-muted)]',
};

const PAGE_SIZE = 25;

const formatAbsoluteTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { markAsRead, markAllAsRead, dismiss, refresh: refreshBell } = useNotifications();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [skip, setSkip] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [moduleFilter, setModuleFilter] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = useCallback(async (resetSkip = false) => {
    setIsLoading(true);
    try {
      const nextSkip = resetSkip ? 0 : skip;
      const res = await notificationService.list({
        limit: PAGE_SIZE,
        skip: nextSkip,
        module: moduleFilter || undefined,
        unreadOnly: unreadOnly ? 'true' : undefined,
      });
      if (resetSkip) {
        setItems(res.items || []);
        setSkip(0);
      } else {
        setItems((prev) => (nextSkip === 0 ? (res.items || []) : [...prev, ...(res.items || [])]));
      }
      setTotal(res.total || 0);
      setUnread(res.unread || 0);
    } catch {
      // silent — list page tolerates errors; user can hit Refresh
    } finally {
      setIsLoading(false);
    }
  }, [skip, moduleFilter, unreadOnly]);

  // Refetch on filter changes (resets pagination)
  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleFilter, unreadOnly]);

  const loadMore = async () => {
    const nextSkip = skip + PAGE_SIZE;
    setIsLoading(true);
    try {
      const res = await notificationService.list({
        limit: PAGE_SIZE,
        skip: nextSkip,
        module: moduleFilter || undefined,
        unreadOnly: unreadOnly ? 'true' : undefined,
      });
      setItems((prev) => [...prev, ...(res.items || [])]);
      setTotal(res.total || 0);
      setUnread(res.unread || 0);
      setSkip(nextSkip);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (n) => {
    if (!n.readAt) {
      markAsRead(n._id);
      setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, readAt: new Date().toISOString() } : x)));
      setUnread((c) => Math.max(0, c - 1));
    }
    if (n.link) navigate(n.link);
  };

  const handleDismiss = async (id, e) => {
    e?.stopPropagation();
    const wasUnread = !items.find((x) => x._id === id)?.readAt;
    setItems((prev) => prev.filter((x) => x._id !== id));
    setTotal((t) => Math.max(0, t - 1));
    if (wasUnread) setUnread((c) => Math.max(0, c - 1));
    dismiss(id);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    setItems((prev) => prev.map((x) => (x.readAt ? x : { ...x, readAt: new Date().toISOString() })));
    setUnread(0);
  };

  const handleRefresh = () => {
    refreshBell();
    load(true);
  };

  const hasMore = items.length < total;

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-0 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div>
          <div className="flex items-center gap-2 text-[var(--primary)] mb-1">
            <Bell size={18} />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Inbox</span>
          </div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Notifications</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {unread > 0 ? <><span className="font-bold text-[var(--text-primary)]">{unread} unread</span> · {total} total</> : `All caught up — ${total} total`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <RefreshCw size={14} className="mr-1.5" />}
            Refresh
          </Button>
          {unread > 0 && (
            <Button variant="primary" onClick={handleMarkAllRead}>
              <CheckCheck size={14} className="mr-1.5" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
        >
          {MODULE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] cursor-pointer">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="accent-[var(--primary)]"
          />
          <span className="text-sm text-[var(--text-primary)]">Unread only</span>
        </label>
      </div>

      {/* List */}
      <Card className="p-0 overflow-hidden">
        {items.length === 0 && !isLoading ? (
          <div className="px-6 py-16 text-center">
            <Bell size={36} className="mx-auto text-[var(--text-muted)] opacity-60" />
            <p className="text-sm text-[var(--text-muted)] mt-4 font-medium">
              No notifications match these filters.
            </p>
          </div>
        ) : (
          <ul>
            {items.map((n) => {
              const Icon = MODULE_ICONS[n.module] || Activity;
              const colorCls = MODULE_COLORS[n.module] || 'bg-slate-100 text-slate-700';
              const priorityCls = PRIORITY_BADGE[n.priority] || PRIORITY_BADGE.normal;
              const unreadRow = !n.readAt;

              return (
                <li key={n._id}>
                  {/* Row is a focusable div (not a <button>) so the dismiss
                      <button> below can live inside it — a button nested in a
                      button is invalid HTML and triggered a hydration error. */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleRowClick(n)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowClick(n);
                      }
                    }}
                    className={`group w-full text-left flex items-start gap-4 px-5 py-4 border-b border-[var(--border)] last:border-b-0 transition-colors cursor-pointer ${
                      unreadRow ? 'bg-[var(--primary)]/[0.03] hover:bg-[var(--primary)]/[0.06]' : 'hover:bg-[var(--bg)]'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorCls}`}>
                      <Icon size={18} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {unreadRow && <span className="w-2 h-2 rounded-full bg-[var(--primary)] shrink-0" />}
                        <p className={`text-sm ${unreadRow ? 'font-bold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]'}`}>
                          {n.title}
                        </p>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${priorityCls}`}>
                          {n.priority}
                        </span>
                      </div>
                      {n.message && (
                        <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">{n.message}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">
                        <span>{n.module}</span>
                        <span>·</span>
                        <span>{formatAbsoluteTime(n.createdAt)}</span>
                        {n.actorName && (
                          <>
                            <span>·</span>
                            <span className="normal-case tracking-normal">by {n.actorName}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDismiss(n._id, e)}
                      title="Dismiss"
                      className="shrink-0 p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--bg)] opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {hasMore && (
          <div className="px-5 py-4 border-t border-[var(--border)] text-center">
            <Button variant="ghost" onClick={loadMore} isLoading={isLoading}>
              Load more
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default NotificationsPage;
