import React, { useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import { useNotifications } from '../../notifications/NotificationContext';

const MODULE_ICONS = {
  crm:      Users,
  meeting:  Calendar,
  pms:      ClipboardList,
  proposal: FileText,
  auth:     Activity,
  system:   AlertCircle,
};

const MODULE_COLORS = {
  crm:      'bg-[var(--warning)]/10 text-[var(--warning)]',
  meeting:  'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]',
  pms:      'bg-[var(--accent-teal)]/10 text-[var(--accent-teal)]',
  proposal: 'bg-[var(--accent-green)]/10 text-[var(--accent-green)]',
  auth:     'bg-[var(--primary)]/10 text-[var(--primary)]',
  system:   'bg-[var(--bg)] text-[var(--text-muted)]',
};

const PRIORITY_DOT = {
  high:   'bg-[var(--error)]',
  normal: 'bg-[var(--primary)]',
  low:    'bg-[var(--text-muted)]',
};

const formatRelativeTime = (iso) => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const NotificationRow = ({ n, onClick, onDismiss }) => {
  const Icon = MODULE_ICONS[n.module] || Activity;
  const colorCls = MODULE_COLORS[n.module] || 'bg-[var(--bg)] text-[var(--text-muted)]';
  const dotCls = PRIORITY_DOT[n.priority] || PRIORITY_DOT.normal;
  const unread = !n.readAt;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left flex items-start gap-3 px-4 py-3 transition-colors border-b border-[var(--border)] last:border-b-0 ${
        unread ? 'bg-[var(--primary)]/[0.03] hover:bg-[var(--primary)]/[0.06]' : 'hover:bg-[var(--bg)]'
      }`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colorCls}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {unread && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls}`} />}
          <p className={`text-sm truncate ${unread ? 'font-bold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]'}`}>
            {n.title}
          </p>
        </div>
        {n.message && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{n.message}</p>
        )}
        <p className="text-[10px] text-[var(--text-muted)] mt-1 uppercase tracking-widest font-bold">
          {formatRelativeTime(n.createdAt)} • {n.module}
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        title="Dismiss"
        className="shrink-0 p-1 rounded text-[var(--text-muted)] hover:text-[var(--error)] opacity-0 group-hover:opacity-100"
      >
        <X size={13} />
      </button>
    </button>
  );
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const { items, unreadCount, markAsRead, markAllAsRead, dismiss, refresh, isLoading } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    setOpen((o) => {
      const next = !o;
      if (next) refresh();
      return next;
    });
  };

  const handleRowClick = (n) => {
    if (!n.readAt) markAsRead(n._id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="relative p-2 rounded-xl hover:bg-[var(--bg)] transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} className="text-[var(--text-secondary)]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--error)] text-white text-[9px] font-black flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] max-w-[calc(100vw-1.5rem)] bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl shadow-black/10 overflow-hidden z-40">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <div>
              <p className="text-sm font-black text-[var(--text-primary)]">Notifications</p>
              <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-0.5">
                {unreadCount === 0 ? 'All caught up' : `${unreadCount} unread`}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest text-[var(--primary)] hover:bg-[var(--primary)]/10"
              >
                <CheckCheck size={12} />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                {isLoading ? (
                  <Loader2 size={20} className="animate-spin mx-auto text-[var(--text-muted)]" />
                ) : (
                  <>
                    <Bell size={28} className="mx-auto text-[var(--text-muted)] opacity-70" />
                    <p className="text-xs text-[var(--text-muted)] mt-3 font-medium">
                      No notifications yet
                    </p>
                  </>
                )}
              </div>
            ) : (
              items.map((n) => (
                <div key={n._id} className="group">
                  <NotificationRow
                    n={n}
                    onClick={() => handleRowClick(n)}
                    onDismiss={() => dismiss(n._id)}
                  />
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--border)] px-4 py-2.5 bg-[var(--bg)]/50">
            <button
              type="button"
              onClick={() => { setOpen(false); navigate('/notifications'); }}
              className="w-full text-center text-xs font-black uppercase tracking-widest text-[var(--primary)] hover:underline"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
