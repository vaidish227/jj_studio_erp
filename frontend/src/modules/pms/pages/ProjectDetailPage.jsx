import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ChevronRight, RefreshCw, Calendar, MapPin,
  Briefcase, User, IndianRupee, ArrowLeft,
} from 'lucide-react';
import { Button, Loader } from '../../../shared/components';
import ProjectStatusBadge from '../components/ProjectStatusBadge';
import ProjectDelayBanner from '../components/ProjectDelayBanner';
import ProjectPhaseStepper from '../components/ProjectPhaseStepper';
import ProgressRing from '../components/ProgressRing';
import useProjectDetail from '../hooks/useProjectDetail';
import { getLeadDesigner } from '../utils/teamHelpers';
import OverviewTab        from '../components/tabs/OverviewTab';
import TasksTab           from '../components/tabs/TasksTab';
import DrawingsTab        from '../components/tabs/DrawingsTab';
import SiteLogsTab        from '../components/tabs/SiteLogsTab';
import TeamTab            from '../components/tabs/TeamTab';
import ClientApprovalsTab from '../components/tabs/ClientApprovalsTab';
import DLRSheetTab        from '../components/tabs/DLRSheetTab';
import MilestonesTab      from '../components/tabs/MilestonesTab';
import SiteVisitsTab      from '../components/tabs/SiteVisitsTab';
import MaterialsTab       from '../components/tabs/MaterialsTab';
import PurchaseOrdersTab  from '../components/tabs/PurchaseOrdersTab';
import WhatsAppTab        from '../components/tabs/WhatsAppTab';
import ActivityTab        from '../components/tabs/ActivityTab';
import DocumentsTab       from '../components/tabs/DocumentsTab';
// Phase 2 — Workflow Engine surfaces
import ProjectGatesTab        from '../components/tabs/ProjectGatesTab';
import VendorEngagementTab    from '../components/tabs/VendorEngagementTab';
import DrawingReleaseTab      from '../components/tabs/DrawingReleaseTab';
// Phase 3b — Handover
import HandoverTab            from '../components/tabs/HandoverTab';
// Project Planner / Master Plan
import ProjectPlannerTab      from '../components/planner/ProjectPlannerTab';
import AskAIButton from '../../ai/components/AskAIButton';
import { resolveEntry } from '../../ai/aiEntryPoints';

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—';

const fmtCurrency = (n) => (n || n === 0)
  ? Number(n).toLocaleString('en-IN')
  : '—';

// Phase 3a — Tab consolidation.
// We map 16 leaf tabs into 6 grouped top-level tabs (+ Activity always at the end).
// Behind a localStorage flag so users opt in: `localStorage.setItem('pms.tabsV2', '1')`
// To revert: `localStorage.removeItem('pms.tabsV2')`.
const TABS_LEGACY = [
  { id: 'overview',          label: 'Overview' },
  { id: 'documents',         label: 'Documents' },
  { id: 'planner',           label: 'Master Plan' },
  { id: 'gates',             label: 'Sign-offs' },
  { id: 'tasks',             label: 'Tasks' },
  { id: 'drawings',          label: 'Drawings' },
  { id: 'dlr',               label: 'DLR Sheet' },
  { id: 'release_log',       label: 'Release Log' },
  { id: 'milestones',        label: 'Milestones' },
  { id: 'logs',              label: 'Site Logs' },
  { id: 'site_visits',       label: 'Site Visits' },
  { id: 'materials',         label: 'Materials' },
  { id: 'vendor_engagement', label: 'Vendors' },
  { id: 'purchase_orders',   label: 'POs' },
  { id: 'team',              label: 'Team' },
  { id: 'approvals',         label: 'Approvals' },
  { id: 'whatsapp',          label: 'WhatsApp' },
  { id: 'handover',          label: 'Handover' },
  { id: 'activity',          label: 'Activity' },
];

// 6-tab consolidated layout with sub-tabs inside each group.
const TABS_V2 = [
  { id: 'overview',  label: 'Overview',         subTabs: ['overview'] },
  { id: 'documents', label: 'Documents',        subTabs: ['documents'] },
  { id: 'workflow',  label: 'Workflow',         subTabs: [
    { id: 'planner',   label: 'Master Plan' },
    { id: 'gates',     label: 'Sign-offs' },
    { id: 'tasks',     label: 'Tasks' },
    { id: 'approvals', label: 'Approvals' },
    { id: 'handover',  label: 'Handover' },
  ]},
  { id: 'drawings',  label: 'Drawings',         subTabs: [
    { id: 'drawings',    label: 'Drawings' },
    { id: 'dlr',         label: 'DLR Sheet' },
    { id: 'release_log', label: 'Release Log' },
  ]},
  { id: 'site',      label: 'Site & Procurement', subTabs: [
    { id: 'logs',              label: 'Site Logs' },
    { id: 'site_visits',       label: 'Site Visits' },
    { id: 'materials',         label: 'Materials' },
    { id: 'vendor_engagement', label: 'Vendors' },
    { id: 'purchase_orders',   label: 'POs' },
    { id: 'milestones',        label: 'Milestones' },
  ]},
  { id: 'team',      label: 'Team & Comms',     subTabs: [
    { id: 'team',     label: 'Team' },
    { id: 'whatsapp', label: 'WhatsApp' },
  ]},
  { id: 'activity',  label: 'Activity',         subTabs: ['activity'] },
];

// Phase 3b — V2 is now the default. Set `pms.tabsV2 = '0'` in localStorage to revert.
const isTabsV2 = () => {
  try { return localStorage.getItem('pms.tabsV2') !== '0'; } catch { return true; }
};

// For tabsV2, derive which top-group an active sub-tab belongs to
const findGroupForSubTab = (subId) => {
  for (const group of TABS_V2) {
    if (group.subTabs === undefined) continue;
    const flatIds = group.subTabs.map((s) => typeof s === 'string' ? s : s.id);
    if (flatIds.includes(subId)) return group.id;
  }
  return null;
};

const ProjectDetailPage = () => {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const location  = useLocation();
  const tabsV2    = isTabsV2();
  const initialTab = (() => {
    try {
      const t = new URLSearchParams(location.search).get('tab');
      return t || 'overview';
    } catch { return 'overview'; }
  })();
  const [activeTab, setActiveTab] = useState(initialTab);

  // Honour ?tab=… deep links on navigation (e.g. from the dashboard alerts).
  useEffect(() => {
    const t = new URLSearchParams(location.search).get('tab');
    if (t && t !== activeTab) setActiveTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const {
    project, tasks, drawings, siteLogs,
    isLoading, error,
    refresh, refreshTasks, refreshDrawings,
  } = useProjectDetail(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-[var(--text-muted)]">
        <p className="text-sm">Failed to load project.</p>
        <Button variant="outline" onClick={refresh}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        <Link to="/projects" className="hover:text-[var(--primary)] transition-colors">
          Projects
        </Link>
        <ChevronRight size={12} />
        <span className="text-[var(--text-primary)] font-semibold truncate max-w-xs">
          {project.name}
        </span>
      </nav>

      {/* Header card — only on Overview. When navigating into any module
          card, hide this so the page jumps straight to the module's sub-nav
          and content (no project metadata clutter). */}
      {activeTab === 'overview' && (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 lg:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                {project.trackingId}
              </span>
              <ProjectStatusBadge status={project.status} />
            </div>
            <h1 className="text-xl lg:text-2xl font-extrabold text-[var(--text-primary)] leading-tight">
              {project.name}
            </h1>
            {project.projectType && (
              <span className="text-xs text-[var(--text-muted)] mt-0.5 block">{project.projectType}</span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Phase 3a — project progress at a glance */}
            {project.workflowTemplateId && (
              <div className="flex items-center gap-2">
                <ProgressRing value={project.progressPercent || 0} size={48} stroke={5} />
                <div className="hidden sm:block">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Progress</p>
                  <p className="text-sm font-bold text-[var(--text-primary)] -mt-0.5">{project.progressPercent || 0}%</p>
                </div>
              </div>
            )}
            <AskAIButton
              label="Summarize"
              variant="soft"
              size="sm"
              actions={resolveEntry('projectOverview', {
                projectName: project.name,
                trackingId: project.trackingId,
              }).actions}
            />
            <Button variant="ghost" onClick={refresh}>
              <RefreshCw size={14} className="mr-1.5" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5 pt-5 border-t border-[var(--border)]">
          <div className="flex items-start gap-2">
            <MapPin size={14} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Location</p>
              <p className="text-sm text-[var(--text-primary)]">
                {project.siteAddress?.city || project.siteAddress?.fullAddress || '—'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Calendar size={14} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Est. Completion</p>
              <p className="text-sm text-[var(--text-primary)]">{fmt(project.estimatedCompletionDate)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <IndianRupee size={14} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Budget</p>
              <p className="text-sm text-[var(--text-primary)]">{fmtCurrency(project.budget)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <User size={14} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Lead Designer</p>
              <p className="text-sm text-[var(--text-primary)]">{getLeadDesigner(project)?.name || '—'}</p>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Delay alert + phase stepper — only on Overview. When the user drills
          into a module card (Master Plan, Drawings, Documents, etc.), hide
          these so the dedicated screen stays focused on its own content. */}
      {activeTab === 'overview' && (
        <>
          <ProjectDelayBanner
            project={project}
            overdueTasks={(tasks || []).filter((t) => {
              if (!t?.dueDate) return false;
              if (new Date(t.dueDate) >= new Date()) return false;
              const s = String(t.status || '').toLowerCase();
              return !['approved', 'released_to_site', 'completed', 'done'].includes(s);
            })}
            onViewTasks={() => setActiveTab('tasks')}
          />
          <ProjectPhaseStepper project={project} />
        </>
      )}

      {/* Card-driven navigation: top tab bar is hidden. When inside a module, show
          a compact "back to overview" + sub-tabs row instead. */}
      {tabsV2 ? (
        activeTab !== 'overview' && (
          <ModuleSubNav
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tasks={tasks}
            drawings={drawings}
            siteLogs={siteLogs}
          />
        )
      ) : (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--border)] pb-0 -mb-2 scrollbar-hide">
          {TABS_LEGACY.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
            >
              {tab.label}
              {tab.id === 'tasks'     && tasks.length    > 0 && (
                <span className="ml-1.5 text-[10px] font-black bg-[var(--primary)]/10 text-[var(--primary)] px-1.5 py-0.5 rounded-full">
                  {tasks.length}
                </span>
              )}
              {tab.id === 'drawings'  && drawings.length > 0 && (
                <span className="ml-1.5 text-[10px] font-black bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] px-1.5 py-0.5 rounded-full">
                  {drawings.length}
                </span>
              )}
              {tab.id === 'logs'      && siteLogs.length > 0 && (
                <span className="ml-1.5 text-[10px] font-black bg-[var(--border)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-full">
                  {siteLogs.length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Tab content */}
      <div className="mt-2">
        {activeTab === 'overview'  && (
          <OverviewTab
            project={project}
            tasks={tasks}
            drawings={drawings}
            onProjectUpdated={refresh}
            onSwitchToTab={setActiveTab}
          />
        )}
        {activeTab === 'tasks'     && (
          <TasksTab
            project={project}
            tasks={tasks}
            onTaskCreated={refreshTasks}
            onTaskUpdated={refreshTasks}
          />
        )}
        {activeTab === 'drawings'  && (
          <DrawingsTab
            project={project}
            drawings={drawings}
            onDrawingUpdated={refreshDrawings}
          />
        )}
        {activeTab === 'dlr'       && (
          <DLRSheetTab project={project} />
        )}
        {activeTab === 'logs'      && (
          <SiteLogsTab
            project={project}
            siteLogs={siteLogs}
            onLogAdded={refresh}
          />
        )}
        {activeTab === 'team'      && (
          <TeamTab project={project} onUpdated={refresh} />
        )}
        {activeTab === 'approvals' && (
          <ClientApprovalsTab
            project={project}
            onUpdated={refresh}
          />
        )}
        {activeTab === 'planner'           && <ProjectPlannerTab   project={project} onSwitchToTab={setActiveTab} />}
        {activeTab === 'gates'             && <ProjectGatesTab     project={project} />}
        {activeTab === 'release_log'       && <DrawingReleaseTab   project={project} />}
        {activeTab === 'handover'          && <HandoverTab         project={project} drawings={drawings} />}
        {activeTab === 'milestones'        && <MilestonesTab       project={project} />}
        {activeTab === 'site_visits'       && <SiteVisitsTab       project={project} />}
        {activeTab === 'materials'         && <MaterialsTab        project={project} />}
        {activeTab === 'vendor_engagement' && <VendorEngagementTab project={project} />}
        {activeTab === 'purchase_orders'   && <PurchaseOrdersTab   project={project} />}
        {activeTab === 'whatsapp'          && <WhatsAppTab         project={project} />}
        {activeTab === 'documents'         && <DocumentsTab        project={project} />}
        {activeTab === 'activity'          && <ActivityTab         project={project} />}
      </div>
    </div>
  );
};

// Friendly module titles that match the cards on the Overview page.
const MODULE_TITLES = {
  workflow:  'Project Planner / Master Sheet',
  drawings:  'Design and Drawing Management',
  site:      'Site Execution and Monitoring System',
  team:      'Site Supervisor and Contractor',
  documents: 'Document Repository',
  activity:  'Activity Log',
};

// Card-driven nav: a single compact row shown when the user has drilled into a module.
// Contains a "back to overview" button + the sub-tabs of the active group (when there are 2+).
const ModuleSubNav = ({ activeTab, setActiveTab, tasks, drawings, siteLogs }) => {
  const activeGroup = findGroupForSubTab(activeTab) || 'overview';
  const group = TABS_V2.find((g) => g.id === activeGroup);
  const subTabs = (group?.subTabs || []).filter((s) => typeof s !== 'string');
  const moduleTitle = MODULE_TITLES[activeGroup] || group?.label || '';

  return (
    <div className="flex items-center gap-3 flex-wrap border-b border-[var(--border)] pb-2">
      <button
        type="button"
        onClick={() => setActiveTab('overview')}
        className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/8 rounded-md transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Overview
      </button>

      {moduleTitle && (
        <span className="text-sm font-extrabold text-[var(--text-primary)] truncate">
          {moduleTitle}
        </span>
      )}

      {subTabs.length > 1 && (
        <div className="ml-auto flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {subTabs.map((s) => {
            const isActive = activeTab === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveTab(s.id)}
                className={`shrink-0 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md transition-colors
                  ${isActive
                    ? 'bg-[var(--primary)]/12 text-[var(--primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)]'
                  }`}
              >
                {s.label}
                {s.id === 'tasks'    && tasks.length    > 0 && <span className="ml-1 opacity-70">{tasks.length}</span>}
                {s.id === 'drawings' && drawings.length > 0 && <span className="ml-1 opacity-70">{drawings.length}</span>}
                {s.id === 'logs'     && siteLogs.length > 0 && <span className="ml-1 opacity-70">{siteLogs.length}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProjectDetailPage;
