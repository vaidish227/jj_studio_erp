import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Download, BarChart3, FileSpreadsheet } from 'lucide-react';
import { Button, Loader } from '../../../shared/components';
import usePMSDashboard from '../hooks/usePMSDashboard';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { exportReportAsExcel } from '../../../shared/utils/excelExport';
import { SnapshotBadge, DashboardRefetchOverlay, useDashboardRange } from '../../../shared/dashboard-filter';
import { PMS_DASHBOARD_CONFIG, toLegacyPeriod } from '../config/pmsDashboardConfig';

import DashboardHeader         from '../components/dashboard/DashboardHeader';
import KPIStrip                from '../components/dashboard/KPIStrip';
import OverdueAlertBanner      from '../components/dashboard/OverdueAlertBanner';
import OverdueProjectsModal    from '../components/dashboard/OverdueProjectsModal';
import AlertsSection           from '../components/dashboard/AlertsSection';
import ProjectHealthGrid       from '../components/dashboard/ProjectHealthGrid';
import PhaseDistributionChart  from '../components/dashboard/PhaseDistributionChart';
import ActiveProjectsTimeline  from '../components/dashboard/ActiveProjectsTimeline';
import PendingMyApprovalList   from '../components/dashboard/PendingMyApprovalList';
import GateAgingBars           from '../components/dashboard/GateAgingBars';
import RecentActivityFeed      from '../components/dashboard/RecentActivityFeed';
import UpcomingMilestonesList  from '../components/dashboard/UpcomingMilestonesList';
import DeliveryTrendCards      from '../components/dashboard/DeliveryTrendCards';

/**
 * PMSDashboardPage — MD landing for Project Management.
 *
 * Sections (top to bottom):
 *   1. Header (title + period selector + refresh)
 *   2. Overdue alert banner (conditional) — Review Now opens OverdueProjectsModal
 *   3. KPI strip (6 tiles)
 *   4. AlertsSection (4-tab consolidated alerts feed)
 *   5. Project Health card grid (sorted worst-first)
 *   6. Active Projects Gantt timeline
 *   7. Designer KPI/KRA Scoreboard | Pending My Approval (2-up)
 *   8. Gate Aging | Phase Distribution (2-up)
 *   9. Recent Activity | Upcoming Milestones (2-up)
 */
const PMSDashboardPage = () => {
  const [range, setRange] = useDashboardRange(PMS_DASHBOARD_CONFIG.storageKey, PMS_DASHBOARD_CONFIG.defaultRange);
  const { data, alerts, isLoading, error, refresh } = usePMSDashboard(range);
  const [showOverdueModal, setShowOverdueModal] = useState(false);
  const [downloading, setDownloading] = useState(null); // 'kpi' | 'projects' | null
  const toast = useToast();

  // Adjacent report endpoints + the scoreboard's detail links speak the legacy
  // period vocabulary — derive it from the active range.
  const legacyPeriod = toLegacyPeriod(range.preset);
  const isRefetching = isLoading && !!data; // range change / poll → overlay (range-driven zones only)

  const downloadDesignerKpi = async () => {
    setDownloading('kpi');
    try {
      const res = await pmsService.getDesignerKpiReport(legacyPeriod);
      exportReportAsExcel(res, {
        fileName: `designer-kpi-${legacyPeriod}`,
        columns: [
          { header: 'Name',           key: 'name',          width: 22 },
          { header: 'Role',           key: 'role',          width: 14 },
          { header: 'Email',          key: 'email',         width: 26 },
          { header: 'Active Tasks',   key: 'activeTasks',   width: 12 },
          { header: 'Overdue Active', key: 'overdueActive', width: 14 },
          { header: 'Delivered',      key: 'delivered',     width: 11 },
          { header: 'On-Time %',      key: 'onTimePct',     width: 11 },
          { header: 'First-Pass %',   key: 'firstPassPct',  width: 12 },
          { header: 'KRA Score',      key: 'kraScore',      width: 11 },
        ],
        summaryLabels: {
          designers:      'Designers',
          avgKra:         'Average KRA',
          totalDelivered: 'Total Delivered',
          totalActive:    'Total Active',
          totalOverdue:   'Total Overdue',
        },
      });
      toast.success('Designer KPI report downloaded');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to download report');
    } finally {
      setDownloading(null);
    }
  };

  const downloadProjectSummary = async () => {
    setDownloading('projects');
    try {
      const res = await pmsService.getProjectSummaryReport(legacyPeriod);
      exportReportAsExcel(res, {
        fileName: `project-summary-${legacyPeriod}`,
        columns: [
          { header: 'Tracking ID',  key: 'trackingId',    width: 16 },
          { header: 'Name',         key: 'name',          width: 30 },
          { header: 'Status',       key: 'status',        width: 14 },
          { header: 'Phase',        key: 'phase',         width: 12 },
          { header: 'Health',       key: 'health',        width: 11 },
          { header: 'Progress %',   key: 'progressPct',   width: 11 },
          { header: 'Start Date',   key: 'startDate',     width: 12 },
          { header: 'ETA',          key: 'eta',           width: 12 },
          { header: 'Days to ETA',  key: 'daysToDeadline', width: 12 },
          { header: 'Delayed',      key: 'isDelayed',     width: 10 },
          { header: 'Tasks Total',  key: 'tasksTotal',    width: 12 },
          { header: 'Tasks Done',   key: 'tasksDone',     width: 11 },
          { header: 'Tasks Active', key: 'tasksActive',   width: 12 },
          { header: 'Tasks Overdue',key: 'tasksOverdue',  width: 13 },
          { header: 'Open Gates',   key: 'openGates',     width: 11 },
        ],
        summaryLabels: {
          total:             'Total Projects',
          active:            'Active',
          completed:         'Completed',
          delayed:           'Delayed',
          totalOverdueTasks: 'Total Overdue Tasks',
        },
      });
      toast.success('Project summary report downloaded');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to download report');
    } finally {
      setDownloading(null);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader label="Loading dashboard..." />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-[var(--text-muted)]">
        <AlertCircle size={36} className="opacity-50" />
        <p className="text-sm">{error || 'Failed to load dashboard.'}</p>
        <Button variant="outline" onClick={refresh}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">
      <DashboardHeader
        range={range}
        onRangeChange={setRange}
        onRefresh={refresh}
        isLoading={isLoading}
        isRefetching={isRefetching}
      />

      {/* Snapshot hint — PMS is mostly current-state; only "Released this period" and
          the Designer KRA scoreboard follow the selected range. */}
      <p className="text-[11px] text-[var(--text-muted)]">
        Only the “Released” KPI and Designer KRA follow the selected range. Cards marked
        <SnapshotBadge variant="snapshot" className="mx-1 align-middle" />
        are current totals,
        <SnapshotBadge variant="live" className="mx-1 align-middle" />
        are real-time, and
        <SnapshotBadge variant="fixed" className="mx-1 align-middle" />
        use their own window.
      </p>

      {/* Quick actions — Phase B link + Phase C report downloads */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          to="/pms/analytics"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-[var(--primary)] border border-[var(--primary)]/40 bg-[var(--primary)]/10 rounded-lg hover:bg-[var(--primary)]/15"
        >
          <BarChart3 size={13} /> Open Analytics
        </Link>
        <button
          type="button"
          onClick={downloadDesignerKpi}
          disabled={downloading === 'kpi'}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50"
        >
          <FileSpreadsheet size={13} /> {downloading === 'kpi' ? 'Preparing…' : 'Designer KPI (Excel)'}
        </button>
        <button
          type="button"
          onClick={downloadProjectSummary}
          disabled={downloading === 'projects'}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50"
        >
          <Download size={13} /> {downloading === 'projects' ? 'Preparing…' : 'Project Summary (Excel)'}
        </button>
      </div>

      <OverdueAlertBanner
        delayedProjects={data?.delayedProjects || []}
        onReview={() => setShowOverdueModal(true)}
      />

      {/* Range-driven: KPI strip (the "Released" tile is the only flow KPI) */}
      <DashboardRefetchOverlay active={isRefetching}>
        <KPIStrip kpis={data?.kpis} />
      </DashboardRefetchOverlay>

      <AlertsSection alerts={alerts} />

      <ProjectHealthGrid
        projects={data?.projectHealthGrid || []}
        healthSummary={data?.projectHealth}
      />

      <ActiveProjectsTimeline projects={data?.activeProjects || []} />

      <PendingMyApprovalList items={data?.pendingMyApproval || []} />

      <DeliveryTrendCards data={data?.weeklyTrend || []} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GateAgingBars data={data?.gateAging} />
        <PhaseDistributionChart data={data?.phaseDistribution || []} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentActivityFeed     items={data?.recentActivity || []} />
        <UpcomingMilestonesList items={data?.upcomingMilestones || []} />
      </div>

      <OverdueProjectsModal
        isOpen={showOverdueModal}
        onClose={() => setShowOverdueModal(false)}
        projects={data?.delayedProjects || []}
      />
    </div>
  );
};

export default PMSDashboardPage;
