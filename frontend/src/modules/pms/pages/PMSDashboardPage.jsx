import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button, Loader } from '../../../shared/components';
import usePMSDashboard from '../hooks/usePMSDashboard';

import DashboardHeader         from '../components/dashboard/DashboardHeader';
import KPIStrip                from '../components/dashboard/KPIStrip';
import PhaseDistributionChart  from '../components/dashboard/PhaseDistributionChart';
import ProjectHealthChart      from '../components/dashboard/ProjectHealthChart';
import ActiveProjectsTimeline  from '../components/dashboard/ActiveProjectsTimeline';
import DesignerUtilisationBar  from '../components/dashboard/DesignerUtilisationBar';
import GateAgingBars           from '../components/dashboard/GateAgingBars';
import RecentActivityFeed      from '../components/dashboard/RecentActivityFeed';
import UpcomingMilestonesList  from '../components/dashboard/UpcomingMilestonesList';

/**
 * PMSDashboardPage — Operational landing for the Project Management module.
 *
 * Sections (top to bottom):
 *   1. Header (title + period selector + refresh)
 *   2. KPI strip (6 tiles)
 *   3. Phase Distribution donut · Project Health stacked bar
 *   4. Active Projects Timeline (Gantt-style)
 *   5. Designer Utilisation · Gate Aging
 *   6. Recent Activity · Upcoming Milestones
 *
 * Single round-trip to /api/pms/dashboard/overview.
 */
const PMSDashboardPage = () => {
  const [period, setPeriod] = useState('month');
  const { data, isLoading, error, refresh } = usePMSDashboard(period);

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
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      <DashboardHeader
        period={period}
        onPeriodChange={setPeriod}
        onRefresh={refresh}
        isLoading={isLoading}
      />

      <KPIStrip kpis={data?.kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PhaseDistributionChart data={data?.phaseDistribution || []} />
        <ProjectHealthChart    data={data?.projectHealth || {}} />
      </div>

      <ActiveProjectsTimeline projects={data?.activeProjects || []} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DesignerUtilisationBar designers={data?.designerUtilisation || []} />
        <GateAgingBars          data={data?.gateAging} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentActivityFeed       items={data?.recentActivity || []} />
        <UpcomingMilestonesList   items={data?.upcomingMilestones || []} />
      </div>
    </div>
  );
};

export default PMSDashboardPage;
