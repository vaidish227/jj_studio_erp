import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronRight, RefreshCw, Calendar, MapPin,
  Briefcase, User, DollarSign,
} from 'lucide-react';
import { Button, Loader } from '../../../shared/components';
import ProjectStatusBadge from '../components/ProjectStatusBadge';
import useProjectDetail from '../hooks/useProjectDetail';
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

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—';

const fmtCurrency = (n) => n
  ? `₹${Number(n).toLocaleString('en-IN')}`
  : '—';

const TABS = [
  { id: 'overview',        label: 'Overview' },
  { id: 'tasks',           label: 'Tasks' },
  { id: 'drawings',        label: 'Drawings' },
  { id: 'dlr',             label: 'DLR Sheet' },
  { id: 'milestones',      label: 'Milestones' },
  { id: 'logs',            label: 'Site Logs' },
  { id: 'site_visits',     label: 'Site Visits' },
  { id: 'materials',       label: 'Materials' },
  { id: 'purchase_orders', label: 'POs' },
  { id: 'team',            label: 'Team' },
  { id: 'approvals',       label: 'Approvals' },
  { id: 'whatsapp',        label: 'WhatsApp' },
  { id: 'activity',        label: 'Activity' },
];

const ProjectDetailPage = () => {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

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

      {/* Header card */}
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
          <Button variant="ghost" onClick={refresh} className="shrink-0">
            <RefreshCw size={14} className="mr-1.5" />
            Refresh
          </Button>
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
            <DollarSign size={14} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Budget</p>
              <p className="text-sm text-[var(--text-primary)]">{fmtCurrency(project.budget)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <User size={14} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Primary Designer</p>
              <p className="text-sm text-[var(--text-primary)]">{project.primaryDesigner?.name || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--border)] pb-0 -mb-2 scrollbar-hide">
        {TABS.map((tab) => (
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

      {/* Tab content */}
      <div className="mt-2">
        {activeTab === 'overview'  && (
          <OverviewTab
            project={project}
            tasks={tasks}
            drawings={drawings}
            onProjectUpdated={refresh}
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
        {activeTab === 'milestones'      && <MilestonesTab      project={project} />}
        {activeTab === 'site_visits'     && <SiteVisitsTab      project={project} />}
        {activeTab === 'materials'       && <MaterialsTab       project={project} />}
        {activeTab === 'purchase_orders' && <PurchaseOrdersTab  project={project} />}
        {activeTab === 'whatsapp'        && <WhatsAppTab        project={project} />}
        {activeTab === 'activity'        && <ActivityTab        project={project} />}
      </div>
    </div>
  );
};

export default ProjectDetailPage;
