import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Target, Activity, TrendingDown, TrendingUp, Clock, Zap, Layers,
  LineChart as LineChartIcon, PieChart as PieChartIcon, Filter as FunnelIcon,
} from 'lucide-react';
import SalesPipeline from '../components/SalesPipeline';
import FollowUpsPanel from '../components/FollowUpsPanel';
import RangeSwitcher from '../components/crm/RangeSwitcher';
import SectionCard from '../components/common/SectionCard';
import KpiTile from '../components/common/KpiTile';
import LeadActivityTrend from '../components/overview/LeadActivityTrend';
import MetricDonut from '../components/overview/MetricDonut';
import FunnelChart from '../components/charts/FunnelChart';
import useDashboardData from '../hooks/useDashboardData';
import useCRMDashboard from '../hooks/useCRMDashboard';
import AskAIButton from '../../ai/components/AskAIButton';
import { resolveEntry } from '../../ai/aiEntryPoints';

const RANGE_LABELS = { '3m': '3 months', '6m': '6 months', '1y': '12 months' };

// Modern-Luxe-aligned palettes (hex so recharts <Cell> & funnel gradients render).
const SOURCE_COLORS = {
  walk_in: '#C19A45', referral: '#356293', website: '#3F7E6C',
  instagram: '#9B59B6', whatsapp: '#3C8A4D', other: '#9A8C73',
};
const STATUS_META = [
  { key: 'inProgress', label: 'In Progress', color: '#356293' },
  { key: 'interested', label: 'Interested',  color: '#C19A45' },
  { key: 'followup',   label: 'Follow-up',   color: '#3F7E6C' },
  { key: 'converted',  label: 'Converted',   color: '#3C8A4D' },
  { key: 'lost',       label: 'Lost',        color: '#C23B28' },
];
const FUNNEL_COLORS = [
  { color: '#356293', colorEnd: '#2E5279' },
  { color: '#3F7E6C', colorEnd: '#356A5B' },
  { color: '#C19A45', colorEnd: '#AD8638' },
  { color: '#A87320', colorEnd: '#8C5F1B' },
  { color: '#9B59B6', colorEnd: '#7E489A' },
  { color: '#3C8A4D', colorEnd: '#327540' },
];

const HeroStat = ({ label, value, sub, tone = 'var(--text-primary)' }) => (
  <div className="relative">
    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
    <p className="text-3xl font-extrabold tabular-nums leading-tight mt-1" style={{ color: tone }}>{value}</p>
    {sub && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{sub}</p>}
  </div>
);

// ─── Dashboard Page (Sales Overview) ────────────────────────────────────────────
const DashboardPage = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState('3m');

  // Live pipeline rows + follow-ups
  const { pipeline, followups, error: feedError } = useDashboardData();
  // Aggregated KPIs, trends, funnel, source & status mix
  const { data, error: kpiError } = useCRMDashboard(range);

  const ai = resolveEntry('dashboard');
  const error = kpiError || feedError;

  const kpis = data?.kpis || {};
  const trends = data?.trends || {};

  const sourceData = useMemo(
    () => (data?.sourceBreakdown || []).map((s) => ({
      label: s.label, value: s.value, color: SOURCE_COLORS[s.key] || '#9A8C73',
    })),
    [data]
  );
  const statusData = useMemo(
    () => STATUS_META.map((m) => ({ label: m.label, value: (data?.leadStages || {})[m.key] || 0, color: m.color })),
    [data]
  );
  const funnelData = useMemo(
    () => (data?.funnel || []).map((stage, i) => ({ ...stage, ...FUNNEL_COLORS[i % FUNNEL_COLORS.length] })),
    [data]
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-500">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Dashboard</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--success)]/10 text-[var(--success)] text-xs font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]" />
              </span>
              Live
            </span>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1.5">
            Welcome back! Sales overview · last {RANGE_LABELS[range]} · auto-refresh every 30s
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <RangeSwitcher value={range} onChange={setRange} />
          <AskAIButton label="Ask AI" variant="soft" actions={ai.actions} />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--error)]/20 bg-[var(--error)]/10 px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      {/* ── Executive snapshot band ────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl p-5 sm:p-6 border"
        style={{
          borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 14%, var(--surface)), var(--surface) 72%)',
        }}
      >
        <TrendingUp size={150} className="absolute -right-6 -top-8 opacity-[0.07] text-[var(--primary)] pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-1.5 mb-4">
            <Zap size={13} className="text-[var(--primary)]" />
            <span className="text-[11px] font-black uppercase tracking-widest text-[var(--primary)]">Sales snapshot</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-4">
            <HeroStat label="Conversion Rate" value={`${kpis.conversionRate?.value ?? 0}%`} sub="Leads converted this period" tone="var(--success)" />
            <HeroStat label="Active Pipeline" value={kpis.activePipeline?.value ?? 0} sub="Live leads in motion" />
            <HeroStat label="Avg. Deal Cycle" value={`${kpis.avgDealCycle?.value ?? 0} days`} sub="Enquiry → conversion" tone="var(--accent-blue)" />
          </div>
        </div>
      </div>

      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiTile icon={Users}        label="Total Leads"     value={kpis.totalLeads?.value ?? 0}     delta={kpis.totalLeads?.delta}                          tone="primary" to="/crm/new-leads" />
        <KpiTile icon={Target}       label="Conversion"      value={kpis.conversionRate?.value ?? 0} suffix="%" delta={kpis.conversionRate?.delta} deltaSuffix="pp" tone="success" to="/crm/converted" />
        <KpiTile icon={Activity}     label="Active Pipeline" value={kpis.activePipeline?.value ?? 0}                                                         tone="accent"  to="/crm/new-leads" />
        <KpiTile icon={TrendingDown} label="Lost Rate"       value={kpis.lostRate?.value ?? 0}       suffix="%" delta={kpis.lostRate?.delta} deltaSuffix="pp" invertDelta tone="error" to="/crm/lost-leads" />
        <KpiTile icon={Clock}        label="Avg Deal Cycle"  value={kpis.avgDealCycle?.value ?? 0}   suffix="d"                                              tone="teal"    to="/crm/converted" />
      </div>

      {/* ── Charts row A — Activity trend + Lead sources ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SectionCard
            title="Lead Activity Trend"
            icon={LineChartIcon}
            color="var(--accent-blue)"
            action={<button onClick={() => navigate('/crm/dashboard')} className="text-xs font-semibold text-[var(--primary)] hover:underline">CRM Analytics</button>}
          >
            <LeadActivityTrend acquisition={trends.acquisition} converted={trends.converted} lost={trends.lost} height={260} />
          </SectionCard>
        </div>
        <SectionCard title="Lead Sources" icon={PieChartIcon} color="var(--accent-blue)">
          <MetricDonut data={sourceData} centerLabel="Sources" />
        </SectionCard>
      </div>

      {/* ── Charts row B — Sales funnel + Status mix ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SectionCard
            title="Sales Funnel"
            icon={FunnelIcon}
            color="var(--primary)"
            action={<button onClick={() => navigate('/crm/new-leads')} className="text-xs font-semibold text-[var(--primary)] hover:underline">Pipeline</button>}
          >
            <FunnelChart stages={funnelData} />
          </SectionCard>
        </div>
        <SectionCard title="Lead Status Mix" icon={Layers} color="var(--primary)">
          <MetricDonut data={statusData} centerLabel="Leads" />
        </SectionCard>
      </div>

      {/* ── Live pipeline + Follow-ups ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SalesPipeline pipeline={pipeline} />
        </div>
        <div className="lg:col-span-1">
          <FollowUpsPanel followUps={followups} />
        </div>
      </div>

    </div>
  );
};

export default DashboardPage;
