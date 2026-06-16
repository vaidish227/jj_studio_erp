import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Clock, CheckCircle2, ClipboardCheck, ChevronRight,
} from 'lucide-react';
import { SnapshotBadge } from '../../../../shared/dashboard-filter';

const TABS = [
  { id: 'delayedProjects',  label: 'Delayed Projects',  icon: AlertTriangle, accent: 'error'   },
  { id: 'overdueTasks',     label: 'Overdue Tasks',     icon: Clock,         accent: 'warning' },
  { id: 'pendingApprovals', label: 'Pending Approvals', icon: ClipboardCheck, accent: 'accent-blue' },
];

// Static class maps so Tailwind JIT can pick them up at build time.
const ACCENT_ICON_CLS = {
  'error':       'bg-[var(--error)]/15 text-[var(--error)]',
  'warning':     'bg-[var(--warning)]/15 text-[var(--warning)]',
  'accent-blue': 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]',
};
const ACCENT_AGE_CLS = {
  'error':       'text-[var(--error)]',
  'warning':     'text-[var(--warning)]',
  'accent-blue': 'text-[var(--accent-blue)]',
};

const ageMsToLabel = (ms) => {
  if (!ms || ms <= 0) return 'now';
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days}d`;
  const hrs = Math.floor(ms / 3600000);
  if (hrs >= 1) return `${hrs}h`;
  return 'now';
};

/**
 * AlertsSection — consolidated alerts widget on the MD dashboard.
 *
 * Three tabs: delayed projects, overdue tasks, pending approvals.
 * Each tab is a compact scrollable list of clickable rows. Empty tab renders
 * the green "All clear" panel.
 */
const AlertsSection = ({ alerts }) => {
  const navigate = useNavigate();
  // User selection overrides; null = follow first-non-empty default.
  const [userPickedTab, setUserPickedTab] = useState(null);

  const categories = useMemo(() => alerts?.categories || {}, [alerts]);
  const totalCount = alerts?.totalCount || 0;

  // First non-empty tab is the preferred default — keeps the section
  // useful even when delayedProjects is empty.
  const firstNonEmpty = useMemo(() => {
    const f = TABS.find((t) => (categories[t.id]?.count || 0) > 0);
    return f?.id || 'delayedProjects';
  }, [categories]);

  const activeTab = userPickedTab || firstNonEmpty;
  const setActiveTab = setUserPickedTab;

  const renderRow = (key, icon, title, subtitle, age, accent, onClick) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--bg)]/60 transition-colors group"
    >
      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${ACCENT_ICON_CLS[accent] || ACCENT_ICON_CLS.warning}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[var(--text-primary)] truncate">{title}</p>
        {subtitle && (
          <p className="text-xs text-[var(--text-secondary)] truncate">{subtitle}</p>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        {age && (
          <span className={`text-[10px] font-black uppercase tracking-wider ${ACCENT_AGE_CLS[accent] || ACCENT_AGE_CLS.warning}`}>
            {age}
          </span>
        )}
        <ChevronRight size={14} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );

  const renderTab = () => {
    const items = (categories[activeTab]?.items || []).slice(0, 8);

    if (items.length === 0) {
      return (
        <div className="flex items-center gap-3 p-4 bg-[var(--success)]/8 border border-[var(--success)]/30 rounded-xl">
          <CheckCircle2 size={20} className="text-[var(--success)] shrink-0" />
          <div>
            <p className="text-sm font-bold text-[var(--success)]">All clear</p>
            <p className="text-xs text-[var(--text-muted)]">
              Nothing pending in this category right now.
            </p>
          </div>
        </div>
      );
    }

    if (activeTab === 'delayedProjects') {
      return (
        <div className="space-y-1">
          {items.map((p) =>
            renderRow(
              p._id,
              <AlertTriangle size={14} />,
              `${p.trackingId || ''} · ${p.name}`,
              p.clientName ? `Client: ${p.clientName}` : null,
              `${p.daysLate}d late`,
              'error',
              () => navigate(`/projects/${p._id}`)
            )
          )}
        </div>
      );
    }

    if (activeTab === 'overdueTasks') {
      return (
        <div className="space-y-1">
          {items.map((t) =>
            renderRow(
              t._id,
              <Clock size={14} />,
              t.title,
              [t.assigneeName, t.projectName].filter(Boolean).join(' · '),
              `${t.daysOverdue}d`,
              'warning',
              () => navigate(`/projects/${t.projectId}?tab=tasks`)
            )
          )}
        </div>
      );
    }

    // pendingApprovals
    return (
      <div className="space-y-1">
        {items.map((p) =>
          renderRow(
            p._id,
            <ClipboardCheck size={14} />,
            p.title,
            p.subtitle,
            ageMsToLabel(p.ageMs),
            'accent-blue',
            () => navigate(p.link || `/projects/${p.projectId}`)
          )
        )}
      </div>
    );
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 lg:p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-[var(--text-primary)] uppercase tracking-widest">
              Alerts
            </h3>
            <SnapshotBadge variant="live" />
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {totalCount === 0
              ? 'Everything is on track.'
              : `${totalCount} item${totalCount === 1 ? '' : 's'} needing attention`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--border)] -mx-1 px-1 mb-3 scrollbar-hide">
        {TABS.map((t) => {
          const count = categories[t.id]?.count || 0;
          const isActive = activeTab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-colors
                ${isActive
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            >
              <Icon size={13} />
              <span>{t.label}</span>
              {count > 0 && (
                <span className={`ml-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-full
                  ${isActive
                    ? 'bg-[var(--primary)]/15 text-[var(--primary)]'
                    : 'bg-[var(--border)] text-[var(--text-muted)]'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
        {renderTab()}
      </div>
    </div>
  );
};

export default AlertsSection;
