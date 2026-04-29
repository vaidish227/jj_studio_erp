import React from 'react';
import { Users, TrendingUp, FileText, TrendingDown, Activity } from 'lucide-react';
import { DashboardCard } from '../../../shared/components';
import SalesPipeline from '../components/SalesPipeline';
import FollowUpsPanel from '../components/FollowUpsPanel';
import useDashboardData from '../hooks/useDashboardData';

// ─── Dashboard Page ───────────────────────────────────────────────────────────
const DashboardPage = () => {
  const { stats, pipeline, followups, isLoading, error } = useDashboardData();

  const statCards = [
    {
      title: 'Total Leads',
      value: stats?.totalLeads ?? 0,
      trend: 'Realtime total leads',
      trendUp: true,
      icon: Users,
      iconBg: 'bg-[var(--primary)]/10',
      redirectPath: '/crm/new-leads',
    },
    {
      title: 'Converted',
      value: stats?.converted ?? 0,
      trend: 'Live converted count',
      trendUp: true,
      icon: TrendingUp,
      iconBg: 'bg-[var(--success)]/10',
      redirectPath: '/crm/converted',
    },
    {
      title: 'Follow-ups',
      value: stats?.followups ?? 0,
      trend: 'Pending reminders',
      trendUp: true,
      icon: FileText,
      iconBg: 'bg-[var(--warning)]/10',
      redirectPath: '/crm/follow-ups',
    },
    {
      title: 'Lost Leads',
      value: stats?.lostLeads ?? 0,
      trend: 'Current lost count',
      trendUp: false,
      icon: TrendingDown,
      iconBg: 'bg-[var(--error)]/10',
      redirectPath: '/crm/lost-leads',
    },
  ];

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Welcome back! Here's your realtime sales overview.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--error)]/20 bg-[var(--error)]/10 px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <DashboardCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DashboardCard
          title="In Progress"
          value={stats?.inProgress ?? 0}
          trend="Meeting and KIT stage"
          trendUp={true}
          icon={Activity}
          iconBg="bg-[var(--accent-blue)]/10"
          redirectPath="/crm/meetings"
          compact
        />
        <DashboardCard
          title="Interested"
          value={stats?.interested ?? 0}
          trend="Proposal stage"
          trendUp={true}
          icon={FileText}
          iconBg="bg-[var(--accent-teal)]/10"
          redirectPath="/crm/proposal"
          compact
        />
        <DashboardCard
          title="Dashboard Sync"
          value={isLoading ? '...' : 'Live'}
          trend="Auto refresh every 30s"
          trendUp={true}
          icon={TrendingUp}
          iconBg="bg-[var(--primary)]/10"
          compact
        />
      </div>

      {/* Main content grid: Sales Pipeline + Follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Pipeline — takes 2/3 width on lg+ */}
        <div className="lg:col-span-2">
          <SalesPipeline pipeline={pipeline} />
        </div>

        {/* Follow-ups — takes 1/3 width on lg+ */}
        <div className="lg:col-span-1">
          <FollowUpsPanel followUps={followups} />
        </div>
      </div>

    </div>
  );
};

export default DashboardPage;
