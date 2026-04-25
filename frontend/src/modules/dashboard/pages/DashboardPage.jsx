import React from 'react';
import { Users, TrendingUp, FileText, TrendingDown } from 'lucide-react';
import StatCard from '../components/StatCard';
import SalesPipeline from '../components/SalesPipeline';
import FollowUpsPanel from '../components/FollowUpsPanel';

// ─── Stats Config ─────────────────────────────────────────────────────────────
const STATS = [
  {
    label: 'Total Leads',
    value: '248',
    trend: '+12% from last month',
    trendUp: true,
    icon: <Users size={20} className="text-[var(--primary)]" />,
    iconBg: 'bg-[var(--primary)]/10',
  },
  {
    label: 'Converted',
    value: '64',
    trend: '+8% from last month',
    trendUp: true,
    icon: <TrendingUp size={20} className="text-[var(--success)]" />,
    iconBg: 'bg-[var(--success)]/10',
  },
  {
    label: 'Follow-ups',
    value: '32',
    trend: '-2% from last month',
    trendUp: false,
    icon: <FileText size={20} className="text-[var(--warning)]" />,
    iconBg: 'bg-[var(--warning)]/10',
  },
  {
    label: 'Lost Leads',
    value: '18',
    trend: '+5% from last month',
    trendUp: true,
    icon: <TrendingDown size={20} className="text-[var(--error)]" />,
    iconBg: 'bg-[var(--error)]/10',
  },
];

// ─── Dashboard Page ───────────────────────────────────────────────────────────
const DashboardPage = () => {
  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Welcome back! Here's your sales overview.</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Main content grid: Sales Pipeline + Follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Pipeline — takes 2/3 width on lg+ */}
        <div className="lg:col-span-2">
          <SalesPipeline />
        </div>

        {/* Follow-ups — takes 1/3 width on lg+ */}
        <div className="lg:col-span-1">
          <FollowUpsPanel />
        </div>
      </div>

    </div>
  );
};

export default DashboardPage;
