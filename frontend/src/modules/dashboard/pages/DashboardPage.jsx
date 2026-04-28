import React from 'react';
import { Users, TrendingUp, FileText, TrendingDown, Activity } from 'lucide-react';
import StatCard from '../components/StatCard';
import SalesPipeline from '../components/SalesPipeline';
import FollowUpsPanel from '../components/FollowUpsPanel';
import useDashboardData from '../hooks/useDashboardData';

// ─── Dashboard Page ───────────────────────────────────────────────────────────
const DashboardPage = () => {
  const { stats, pipeline, followups, isLoading, error } = useDashboardData();

  const statCards = [
    {
      label: 'Total Leads',
      value: stats?.totalLeads ?? 0,
      trend: 'Realtime total leads',
      trendUp: true,
      icon: <Users size={20} className="text-[var(--primary)]" />,
      iconBg: 'bg-[var(--primary)]/10',
    },
    {
      label: 'Converted',
      value: stats?.converted ?? 0,
      trend: 'Live converted count',
      trendUp: true,
      icon: <TrendingUp size={20} className="text-[var(--success)]" />,
      iconBg: 'bg-[var(--success)]/10',
    },
    {
      label: 'Follow-ups',
      value: stats?.followups ?? 0,
      trend: 'Pending reminders',
      trendUp: true,
      icon: <FileText size={20} className="text-[var(--warning)]" />,
      iconBg: 'bg-[var(--warning)]/10',
    },
    {
      label: 'Lost Leads',
      value: stats?.lostLeads ?? 0,
      trend: 'Current lost count',
      trendUp: false,
      icon: <TrendingDown size={20} className="text-[var(--error)]" />,
      iconBg: 'bg-[var(--error)]/10',
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
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="In Progress"
          value={stats?.inProgress ?? 0}
          trend="Meeting and KIT stage"
          trendUp={true}
          icon={<Activity size={20} className="text-[var(--accent-blue)]" />}
          iconBg="bg-[var(--accent-blue)]/10"
          compact
        />
        <StatCard
          label="Interested"
          value={stats?.interested ?? 0}
          trend="Proposal stage"
          trendUp={true}
          icon={<FileText size={20} className="text-[var(--accent-teal)]" />}
          iconBg="bg-[var(--accent-teal)]/10"
          compact
        />
        <StatCard
          label="Dashboard Sync"
          value={isLoading ? '...' : 'Live'}
          trend="Auto refresh every 30s"
          trendUp={true}
          icon={<TrendingUp size={20} className="text-[var(--primary)]" />}
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
