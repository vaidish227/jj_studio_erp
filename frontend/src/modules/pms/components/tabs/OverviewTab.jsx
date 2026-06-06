import React from 'react';
import {
  PenTool, HardHat, Truck, UserCog, ClipboardList,
  FileText, CheckCircle2, Clock, Activity, TrendingUp,
  Package, ShoppingCart, Users, Hammer, ListChecks, AlertTriangle,
  History,
} from 'lucide-react';
import KickstartChecklist from '../KickstartChecklist';
import ClientApprovalTracker from '../ClientApprovalTracker';
import WhatsBlockingWidget from '../WhatsBlockingWidget';

const MiniStat = ({ icon: Icon, value, label, tone = 'default' }) => {
  const toneClasses = {
    default: 'text-[var(--text-primary)]',
    success: 'text-[var(--success)]',
    warning: 'text-[var(--warning)]',
    info:    'text-[var(--accent-blue)]',
  };
  return (
    <div className="flex-1 min-w-0 flex items-center gap-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2.5 py-2">
      <Icon size={14} className={`shrink-0 ${toneClasses[tone]}`} />
      <div className="min-w-0">
        <p className={`text-sm font-bold leading-none ${toneClasses[tone]}`}>{value}</p>
        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5 truncate">{label}</p>
      </div>
    </div>
  );
};

const ModuleCard = ({ number, icon: Icon, iconBg, iconColor, title, description, stats, onClick }) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className="group relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 cursor-pointer transition hover:border-[var(--primary)]/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
    >
      <span className="absolute top-4 right-5 text-xs font-black text-[var(--text-muted)]/60 tracking-wider">
        {number}
      </span>
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${iconBg}`}
      >
        <Icon size={22} className={iconColor} />
      </div>
      <h3 className="text-base font-extrabold text-[var(--text-primary)] mb-1 group-hover:text-[var(--primary)] transition-colors">
        {title}
      </h3>
      <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-4 min-h-[2.5rem]">
        {description}
      </p>
      <div className="flex items-stretch gap-2">
        {stats.map((s, i) => (
          <MiniStat key={i} {...s} />
        ))}
      </div>
    </div>
  );
};

const OverviewTab = ({ project, tasks, drawings, onProjectUpdated, onSwitchToTab }) => {
  if (!project) return null;

  const taskCounts = {
    total:       tasks.length,
    completed:   tasks.filter((t) => t.status === 'completed').length,
    inProgress:  tasks.filter((t) => t.status === 'in_progress').length,
    overdue:     tasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed').length,
  };

  const drawingCounts = {
    total:    drawings.length,
    approved: drawings.filter((d) => d.status === 'approved' || d.status === 'released_to_site').length,
    pending:  drawings.filter((d) => d.status === 'sent_for_approval').length,
  };

  const teamSize       = Array.isArray(project.team) ? project.team.length : 0;
  const materialsCount = Array.isArray(project.materials) ? project.materials.length : null;
  const poCount        = Array.isArray(project.purchaseOrders) ? project.purchaseOrders.length : null;
  const vendorsCount   = Array.isArray(project.vendors) ? project.vendors.length : null;
  const siteLogsCount  = Array.isArray(project.siteLogs) ? project.siteLogs.length : null;
  const siteVisitsCount = Array.isArray(project.siteVisits) ? project.siteVisits.length : null;
  const contractorsCount = Array.isArray(project.contractors)
    ? project.contractors.length
    : (Array.isArray(project.team) ? project.team.filter((m) => m.role === 'contractor' || m.type === 'contractor').length : null);
  const progressPercent = project.progressPercent ?? null;
  const fallback = (v) => (v === null || v === undefined ? '—' : v);

  const go = (id) => () => onSwitchToTab?.(id);

  const modules = [
    {
      number: '01',
      icon: PenTool,
      iconBg: 'bg-[var(--primary)]/10',
      iconColor: 'text-[var(--primary)]',
      title: 'Design and Drawing Management',
      description: 'Concept, working drawings, 3D & approval drawings with full revision control.',
      onClick: go('drawings'),
      stats: [
        { icon: FileText,      value: drawingCounts.total,    label: 'Total' },
        { icon: CheckCircle2,  value: drawingCounts.approved, label: 'Approved', tone: 'success' },
        { icon: Clock,         value: drawingCounts.pending,  label: 'In Review', tone: 'warning' },
      ],
    },
    {
      number: '02',
      icon: HardHat,
      iconBg: 'bg-[var(--accent-blue)]/10',
      iconColor: 'text-[var(--accent-blue)]',
      title: 'Site Execution and Monitoring System',
      description: 'Civil, electrical, plumbing & finishing tracked with daily site updates and photos.',
      onClick: go('logs'),
      stats: [
        { icon: Activity,    value: fallback(siteLogsCount),   label: 'Site Logs', tone: 'info' },
        { icon: HardHat,     value: fallback(siteVisitsCount), label: 'Visits' },
        { icon: TrendingUp,  value: progressPercent !== null ? `${progressPercent}%` : '—', label: 'Progress', tone: 'success' },
      ],
    },
    {
      number: '03',
      icon: Truck,
      iconBg: 'bg-[var(--accent-teal)]/10',
      iconColor: 'text-[var(--accent-teal)]',
      title: 'Procurement and Vendor Management',
      description: 'Material selection, purchase status & vendor performance — all in one place.',
      onClick: go('vendor_engagement'),
      stats: [
        { icon: Package,      value: fallback(materialsCount), label: 'Materials' },
        { icon: ShoppingCart, value: fallback(poCount),        label: 'POs', tone: 'info' },
        { icon: Truck,        value: fallback(vendorsCount),   label: 'Vendors' },
      ],
    },
    {
      number: '04',
      icon: UserCog,
      iconBg: 'bg-[var(--success)]/10',
      iconColor: 'text-[var(--success)]',
      title: 'Site Supervisor and Contractor',
      description: 'Supervisors, contractors & on-site team with assigned scope and contact details.',
      onClick: go('team'),
      stats: [
        { icon: Users,  value: teamSize,                  label: 'Members' },
        { icon: Hammer, value: fallback(contractorsCount), label: 'Contractors', tone: 'info' },
      ],
    },
    {
      number: '05',
      icon: ClipboardList,
      iconBg: 'bg-[var(--warning)]/10',
      iconColor: 'text-[var(--warning)]',
      title: 'Project Planner / Master Sheet',
      description: 'Phase plan, gates, tasks & approvals — the master sheet driving the whole project.',
      onClick: go('planner'),
      stats: [
        { icon: ListChecks,    value: taskCounts.total,     label: 'Tasks' },
        { icon: CheckCircle2,  value: taskCounts.completed, label: 'Done', tone: 'success' },
        { icon: AlertTriangle, value: taskCounts.overdue,   label: 'Overdue', tone: 'warning' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Phase 3a — "What's Blocking" at the top of Overview so PMs see it without tab-switching */}
      <WhatsBlockingWidget
        project={project}
        onSwitchToGates={onSwitchToTab ? () => onSwitchToTab('gates') : undefined}
      />

      {/* Module grid — 5 cards (3 + 2) acting as a navigable, client-friendly project overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((m) => (
          <ModuleCard key={m.number} {...m} />
        ))}
      </div>

      {/* Kickstart + Client Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <KickstartChecklist
          projectId={project._id}
          kickstartData={project.kickstartData || {}}
          onUpdated={onProjectUpdated}
        />
        <ClientApprovalTracker
          project={project}
          projectId={project._id}
          approvals={project.clientApprovals || []}
          onUpdated={onProjectUpdated}
        />
      </div>

      {/* Project notes */}
      {project.notes && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Notes</h3>
          <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{project.notes}</p>
        </div>
      )}

      {/* Activity log access (cards layout doesn't have a dedicated activity card) */}
      {onSwitchToTab && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onSwitchToTab('activity')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
          >
            <History size={13} />
            View activity log
          </button>
        </div>
      )}
    </div>
  );
};

export default OverviewTab;
