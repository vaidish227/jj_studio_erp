import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Activity,
  Target,
  TrendingDown,
  Clock,
  LineChart,
  PieChart,
  Filter as FunnelIcon,
  Building2,
  MapPin,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

import useCRMDashboard from '../hooks/useCRMDashboard';
import KPIStatCard from '../components/crm/KPIStatCard';
import RangeSwitcher from '../components/crm/RangeSwitcher';
import SectionPanel from '../components/crm/SectionPanel';
import HotLeadsPanel from '../components/crm/HotLeadsPanel';
import AreaLineChart from '../components/charts/AreaLineChart';
import DonutChart from '../components/charts/DonutChart';
import FunnelChart from '../components/charts/FunnelChart';
import HorizontalBarChart from '../components/charts/HorizontalBarChart';
import AskAIButton from '../../ai/components/AskAIButton';
import { resolveEntry } from '../../ai/aiEntryPoints';

const SOURCE_COLORS = {
  walk_in:   '#D4B76C',
  referral:  '#3A6EA5',
  website:   '#4A8F7C',
  instagram: '#9B59B6',
  whatsapp:  '#27AE60',
  other:     '#A0A0A0',
};

const PROJECT_COLORS = {
  Residential: '#D4B76C',
  Commercial:  '#3A6EA5',
};

const FUNNEL_COLORS = [
  { color: '#3A6EA5', colorEnd: '#2E5B89' }, // enquiry
  { color: '#4A8F7C', colorEnd: '#3D7868' }, // meeting
  { color: '#D4B76C', colorEnd: '#C5A85F' }, // interested
  { color: '#E59E3D', colorEnd: '#C88729' }, // proposal
  { color: '#9B59B6', colorEnd: '#7E489A' }, // advance
  { color: '#4CAF50', colorEnd: '#3F9243' }, // converted
];

const formatINR = (value) => {
  if (!value && value !== 0) return '—';
  if (value >= 1e7) return `₹${(value / 1e7).toFixed(1)}Cr`;
  if (value >= 1e5) return `₹${(value / 1e5).toFixed(1)}L`;
  if (value >= 1e3) return `₹${(value / 1e3).toFixed(1)}K`;
  return `₹${value}`;
};

const RANGE_LABELS = {
  '7d': 'last 7 days',
  '30d': 'last 30 days',
  '90d': 'last 90 days',
  '1y':  'last 12 months',
};

const CRMDashboardPage = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState('30d');
  const { data, isLoading, error, refresh } = useCRMDashboard(range);

  const ai = resolveEntry('dashboard');

  // Derive chart-ready datasets from server response
  const sourceData = useMemo(
    () =>
      (data?.sourceBreakdown || []).map((s) => ({
        label: s.label,
        value: s.value,
        color: SOURCE_COLORS[s.key] || '#A0A0A0',
      })),
    [data]
  );

  const projectMixData = useMemo(
    () =>
      (data?.projectTypeMix || []).map((p) => ({
        label: p.label,
        value: p.value,
        color: PROJECT_COLORS[p.label] || '#A0A0A0',
        totalBudget: p.totalBudget,
      })),
    [data]
  );

  const funnelData = useMemo(
    () =>
      (data?.funnel || []).map((stage, i) => ({
        ...stage,
        ...FUNNEL_COLORS[i],
      })),
    [data]
  );

  const topCitiesData = data?.topCities || [];
  const acquisitionTrend = data?.trends?.acquisition || [];
  const convertedTrend = data?.trends?.converted || [];
  const lostTrend = data?.trends?.lost || [];
  const activeTrend = data?.trends?.active || [];

  const totalLeadsInRange = data?.kpis?.totalLeads?.rangeValue ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-active)] flex items-center justify-center shadow-md shadow-[var(--primary)]/30">
              <Sparkles size={18} className="text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
              CRM Dashboard
            </h1>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1.5 ml-12">
            Live pipeline analytics · {RANGE_LABELS[range]} · auto-refresh every 30s
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <RangeSwitcher value={range} onChange={setRange} />
          <button
            onClick={refresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--primary)] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--primary)] rounded-xl transition-all disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <AskAIButton label="Ask AI" variant="soft" actions={ai.actions} />
        </div>
      </div>

      {/* ── Error banner ───────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-[var(--error)]/20 bg-[var(--error)]/10 px-4 py-3 text-sm text-[var(--error)] flex items-center justify-between">
          <span className="font-semibold">{error}</span>
          <button
            onClick={refresh}
            className="text-xs font-bold underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Zone 1 — KPI Hero Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPIStatCard
          title="Total Leads"
          value={data?.kpis?.totalLeads?.value ?? 0}
          delta={data?.kpis?.totalLeads?.delta}
          deltaLabel={`vs prev ${range}`}
          icon={Users}
          iconBg="bg-[var(--primary)]/10"
          iconColor="text-[var(--primary)]"
          sparkData={acquisitionTrend}
          sparkColor="var(--primary)"
          onClick={() => navigate('/crm/clients')}
          isLoading={isLoading && !data}
        />
        <KPIStatCard
          title="Active Pipeline"
          value={data?.kpis?.activePipeline?.value ?? 0}
          icon={Activity}
          iconBg="bg-[var(--accent-blue)]/10"
          iconColor="text-[var(--accent-blue)]"
          sparkData={activeTrend}
          sparkColor="var(--accent-blue)"
          onClick={() => navigate('/crm/new-leads')}
          isLoading={isLoading && !data}
        />
        <KPIStatCard
          title="Conversion Rate"
          value={data?.kpis?.conversionRate?.value ?? 0}
          suffix="%"
          delta={data?.kpis?.conversionRate?.delta}
          deltaSuffix="pp"
          deltaLabel="pts vs prev"
          icon={Target}
          iconBg="bg-[var(--success)]/10"
          iconColor="text-[var(--success)]"
          sparkData={convertedTrend}
          sparkColor="var(--success)"
          onClick={() => navigate('/crm/converted')}
          isLoading={isLoading && !data}
        />
        <KPIStatCard
          title="Lost Rate"
          value={data?.kpis?.lostRate?.value ?? 0}
          suffix="%"
          delta={data?.kpis?.lostRate?.delta}
          deltaSuffix="pp"
          deltaLabel="pts vs prev"
          invertDeltaColor
          icon={TrendingDown}
          iconBg="bg-[var(--error)]/10"
          iconColor="text-[var(--error)]"
          sparkData={lostTrend}
          sparkColor="var(--error)"
          onClick={() => navigate('/crm/lost-leads')}
          isLoading={isLoading && !data}
        />
        <KPIStatCard
          title="Avg. Deal Cycle"
          value={data?.kpis?.avgDealCycle?.value ?? 0}
          suffix="days"
          icon={Clock}
          iconBg="bg-[var(--accent-teal)]/10"
          iconColor="text-[var(--accent-teal)]"
          isLoading={isLoading && !data}
        />
      </div>

      {/* ── Zone 2 — Acquisition Trend + Source Mix ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SectionPanel
            title="Lead Acquisition Trend"
            subtitle={`Daily new leads · ${RANGE_LABELS[range]}`}
            icon={LineChart}
            badge={`${totalLeadsInRange} total`}
            actionLabel="All Leads"
            onAction={() => navigate('/crm/new-leads')}
          >
            <AreaLineChart data={acquisitionTrend} color="var(--primary)" height={260} />
          </SectionPanel>
        </div>

        <SectionPanel
          title="Lead Sources"
          subtitle="Where leads come from"
          icon={PieChart}
          iconBg="bg-[var(--accent-blue)]/10"
          iconColor="text-[var(--accent-blue)]"
        >
          <div className="flex flex-col items-center py-2">
            <DonutChart
              data={sourceData}
              size={180}
              thickness={26}
              centerLabel="Sources"
              centerValue={sourceData.reduce((s, x) => s + x.value, 0)}
            />
          </div>
        </SectionPanel>
      </div>

      {/* ── Zone 3 — Funnel + Project Mix ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SectionPanel
            title="Sales Funnel"
            subtitle="Lifecycle stage flow & drop-off"
            icon={FunnelIcon}
            iconBg="bg-[var(--primary)]/10"
            iconColor="text-[var(--primary)]"
            actionLabel="Pipeline"
            onAction={() => navigate('/crm/new-leads')}
          >
            <FunnelChart stages={funnelData} />
          </SectionPanel>
        </div>

        <SectionPanel
          title="Project Type Mix"
          subtitle="Residential vs Commercial"
          icon={Building2}
          iconBg="bg-[var(--accent-teal)]/10"
          iconColor="text-[var(--accent-teal)]"
        >
          <div className="flex flex-col gap-4 items-center">
            <DonutChart
              data={projectMixData.map(({ label, value, color }) => ({ label, value, color }))}
              size={160}
              thickness={24}
              centerLabel="Projects"
              centerValue={projectMixData.reduce((s, x) => s + x.value, 0)}
              showLegend={false}
            />
            <div className="w-full flex flex-col gap-2">
              {projectMixData.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-2">
                  No project type data.
                </p>
              ) : (
                projectMixData.map((p) => (
                  <div
                    key={p.label}
                    className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg)]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ background: p.color }}
                      />
                      <span className="text-xs font-semibold text-[var(--text-secondary)] truncate">
                        {p.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-[var(--text-muted)] tabular-nums">
                        {p.value}
                      </span>
                      <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums">
                        {formatINR(p.totalBudget)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </SectionPanel>
      </div>

      {/* ── Zone 4 — Top Cities + Hot Leads ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionPanel
          title="Top Cities"
          subtitle="Highest lead concentration"
          icon={MapPin}
          iconBg="bg-[var(--accent-blue)]/10"
          iconColor="text-[var(--accent-blue)]"
        >
          <HorizontalBarChart
            data={topCitiesData}
            color="var(--accent-blue)"
            onItemClick={(item) =>
              navigate(`/crm/clients?city=${encodeURIComponent(item.label)}`)
            }
            emptyMessage="No city data yet."
          />
        </SectionPanel>

        <HotLeadsPanel leads={data?.hotLeads || []} />
      </div>

      {/* ── Footer / sync status ───────────────────────────────────────── */}
      <div className="flex items-center justify-center text-[11px] text-[var(--text-muted)] pt-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--success)] mr-1.5 animate-pulse" />
        {isLoading ? 'Refreshing data…' : 'Synced · auto-refresh every 30s'}
      </div>
    </div>
  );
};

export default CRMDashboardPage;
