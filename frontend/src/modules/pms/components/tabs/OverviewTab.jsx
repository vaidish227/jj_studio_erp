import React from 'react';
import {
  PenTool, HardHat, Truck, UserCog, ClipboardList,
  ArrowRight, History, FolderOpen,
} from 'lucide-react';
import KickstartChecklist from '../KickstartChecklist';
import ClientApprovalTracker from '../ClientApprovalTracker';
import PendingMDApprovalCard from '../PendingMDApprovalCard';
import { useAuth } from '../../../../shared/context/AuthContext';
import { canViewProjectTab } from '../../constants/projectTabs';

const ModuleCard = ({ number, icon: Icon, iconBg, iconColor, title, description, onClick }) => {
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
      className="group relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 cursor-pointer transition hover:border-[var(--primary)]/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
    >
      <span className="absolute top-4 right-5 text-xs font-black text-[var(--text-muted)]/50 tracking-wider">
        {number}
      </span>
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${iconBg}`}
      >
        <Icon size={22} className={iconColor} />
      </div>
      <h3 className="text-base font-extrabold text-[var(--text-primary)] mb-1.5 group-hover:text-[var(--primary)] transition-colors">
        {title}
      </h3>
      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
        {description}
      </p>
      <div className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors">
        Open
        <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
      </div>
    </div>
  );
};

const OverviewTab = ({ project, onProjectUpdated, onSwitchToTab }) => {
  const { user, hasAnyPermission } = useAuth();
  if (!project) return null;

  // Role-aware view: MD focuses on approvals + visibility; operational checklists
  // (kickstart, client-approval cycling) are PM territory.
  const role  = String(user?.role || '').toLowerCase();
  const isMD  = role === 'md';

  const go = (id) => () => onSwitchToTab?.(id);

  const modules = [
    {
      number: '01',
      icon: ClipboardList,
      iconBg: 'bg-[var(--warning)]/10',
      iconColor: 'text-[var(--warning)]',
      title: 'Project Planner / Master Sheet',
      description: 'Phase plan, gates, tasks & approvals — the master sheet driving the whole project.',
      tab: 'planner',
      onClick: go('planner'),
    },
    {
      number: '02',
      icon: PenTool,
      iconBg: 'bg-[var(--primary)]/10',
      iconColor: 'text-[var(--primary)]',
      title: 'Design and Drawing Management',
      description: 'Concept, working drawings, 3D & approval drawings with full revision control.',
      tab: 'drawings',
      onClick: go('drawings'),
    },
    {
      number: '03',
      icon: HardHat,
      iconBg: 'bg-[var(--accent-blue)]/10',
      iconColor: 'text-[var(--accent-blue)]',
      title: 'Site Execution and Monitoring',
      description: 'Civil, electrical, plumbing & finishing tracked with daily site updates and photos.',
      tab: 'logs',
      onClick: go('logs'),
    },
    {
      number: '04',
      icon: UserCog,
      iconBg: 'bg-[var(--success)]/10',
      iconColor: 'text-[var(--success)]',
      title: 'Site Supervisor and Contractor',
      description: 'Supervisors, contractors & on-site team with assigned scope and contact details.',
      tab: 'team',
      onClick: go('team'),
    },
    {
      number: '05',
      icon: Truck,
      iconBg: 'bg-[var(--accent-teal)]/10',
      iconColor: 'text-[var(--accent-teal)]',
      title: 'Procurement and Vendor Management',
      description: 'Material selection, purchase status & vendor performance — all in one place.',
      tab: 'vendor_engagement',
      onClick: go('vendor_engagement'),
    },
    {
      number: '06',
      icon: FolderOpen,
      iconBg: 'bg-[var(--accent-blue)]/10',
      iconColor: 'text-[var(--accent-blue)]',
      title: 'Document Repository',
      description: 'Agreements, BOQ, MOMs, design files & SOPs — review or download in one place.',
      tab: 'documents',
      onClick: go('documents'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* MD-only — pending designer submissions for this project, with quick actions */}
      {isMD && (
        <PendingMDApprovalCard
          projectId={project._id}
          projectName={project.name}
        />
      )}

      {/* Module grid — 5 cards (3 + 2) acting as a navigable, client-friendly project overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules
          .filter((m) => canViewProjectTab(m.tab, hasAnyPermission))
          .map((m) => (
            <ModuleCard key={m.number} {...m} />
          ))}
      </div>

      {/* Kickstart (PM-only) + Client Approvals (read-only for MD).
          For MD the row collapses to a single full-width Client Approvals card. */}
      <div className={isMD ? '' : 'grid grid-cols-1 lg:grid-cols-2 gap-4'}>
        {!isMD && (
          <KickstartChecklist
            projectId={project._id}
            kickstartData={project.kickstartData || {}}
            onUpdated={onProjectUpdated}
          />
        )}
        <ClientApprovalTracker
          project={project}
          projectId={project._id}
          approvals={project.clientApprovals || []}
          onUpdated={onProjectUpdated}
          readOnly={isMD}
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
