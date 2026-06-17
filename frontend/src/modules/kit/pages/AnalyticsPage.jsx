import { BarChart2, Loader2, Send, CheckCircle2, Eye, AlertTriangle, Megaphone, Zap, Users, Award, RotateCcw } from 'lucide-react';
import Card from '../../../shared/components/Card/Card';
import { kitService } from '../../../shared/services/kitService';
import {
  GlobalDateFilter, SnapshotBadge, DashboardRefetchOverlay, useDashboardRange, useDashboardQuery,
} from '../../../shared/dashboard-filter';
import { KIT_ANALYTICS_CONFIG } from '../config/kitDashboardConfig';

// Composite fetch — 3 analytics endpoints; flow metrics honor `range`, state counts stay all-time.
const fetchKitAnalytics = (range) =>
  Promise.all([
    kitService.getAnalyticsOverview(range),
    kitService.getCampaignAnalytics(range),
    kitService.getTemplateAnalytics(range),
  ]).then(([o, c, t]) => ({ overview: o?.data || null, campaigns: c?.data || [], templates: t?.data || [] }));

const StatCard = ({ icon: Icon, label, value, sub, color = 'var(--primary)', badge }) => (
  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 min-w-0">
        <span className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] truncate">{label}</span>
        {badge}
      </span>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
        <Icon size={16} />
      </div>
    </div>
    <p className="text-3xl font-black text-[var(--text-primary)] mt-2">{value}</p>
    {sub && <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">{sub}</p>}
  </div>
);

const AnalyticsPage = () => {
  const [range, setRange] = useDashboardRange(KIT_ANALYTICS_CONFIG.storageKey, KIT_ANALYTICS_CONFIG.defaultRange);
  const { data, isLoading, error, refresh } = useDashboardQuery(fetchKitAnalytics, range, {
    pollMs: KIT_ANALYTICS_CONFIG.pollMs,
    errorMessage: KIT_ANALYTICS_CONFIG.errorMessage,
  });
  const overview = data?.overview || null;
  const campaigns = data?.campaigns || [];
  const templates = data?.templates || [];
  const isInitialLoading = isLoading && !data;  // first load → full loader
  const isRefetching = isLoading && !!data;     // range change / poll → overlay

  if (isInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-[var(--text-muted)]">
        <Loader2 size={40} className="animate-spin mb-4 opacity-20" />
        <p className="text-sm font-bold uppercase tracking-widest">Loading analytics...</p>
      </div>
    );
  }

  const d = overview?.delivery || {};
  const t = overview?.totals || {};

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)', color: 'var(--primary)' }}>
            <BarChart2 size={24} />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">KIT Analytics</h1>
            <p className="text-[var(--text-muted)] font-medium">Delivery health, campaign performance, and lead-to-sale attribution</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <GlobalDateFilter value={range} onChange={setRange} defaultRange={KIT_ANALYTICS_CONFIG.defaultRange} disabled={isRefetching} />
          <button
            type="button"
            onClick={refresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--primary)] hover:border-[var(--primary)]/40 transition-colors disabled:opacity-50"
          >
            <RotateCcw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--error)]/20 bg-[var(--error)]/10 px-4 py-3 text-sm text-[var(--error)]">{error}</div>
      )}

      {/* Flow vs snapshot hint */}
      <p className="text-[11px] text-[var(--text-muted)]">
        Delivery &amp; engagement metrics reflect the <strong>selected date range</strong>. Operational counts marked
        <SnapshotBadge variant="snapshot" className="mx-1 align-middle" />
        (active campaigns, automations, enrollments) are current-state snapshots.
      </p>

      <DashboardRefetchOverlay active={isRefetching} className="space-y-8">
      {/* Overview stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard icon={Send} label="Messages Sent" value={d.totalSent ?? 0} sub={`${d.totalFailed ?? 0} failed`} />
        <StatCard icon={CheckCircle2} label="Send Success" value={`${d.sendSuccessRate ?? 0}%`} sub="delivered to provider" color="var(--success, #27AE60)" />
        <StatCard icon={Eye} label="WhatsApp Read" value={d.whatsapp?.read ?? 0} sub={`${d.whatsapp?.readRate ?? 0}% read rate`} color="var(--accent-blue, #3A6EA5)" />
        <StatCard icon={AlertTriangle} label="Failures" value={d.totalFailed ?? 0} sub={`${d.kitSideFailures ?? 0} no-recipient`} color="var(--error)" />
        <StatCard icon={Megaphone} label="Active Campaigns" value={t.activeCampaigns ?? 0} sub={`${t.totalCampaigns ?? 0} total`} badge={<SnapshotBadge variant="snapshot" />} />
        <StatCard icon={Zap} label="Active Automations" value={t.activeWorkflows ?? 0} sub={`${t.triggerEvents ?? 0} events fired`} color="var(--warning)" badge={<SnapshotBadge variant="snapshot" />} />
        <StatCard icon={Users} label="Active Enrollments" value={t.activeEnrollments ?? 0} sub={`${t.completedEnrollments ?? 0} completed`} badge={<SnapshotBadge variant="snapshot" />} />
        <StatCard icon={Award} label="KIT Messages" value={t.kitMessages ?? 0} sub="in selected range" />
      </div>

      {/* Channel breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-black text-sm uppercase tracking-wider text-[var(--text-primary)] mb-3">WhatsApp</h3>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[['Sent', d.whatsapp?.sent], ['Delivered', d.whatsapp?.delivered], ['Read', d.whatsapp?.read], ['Failed', d.whatsapp?.failed]].map(([k, v]) => (
              <div key={k}><p className="text-2xl font-black text-[var(--text-primary)]">{v ?? 0}</p><p className="text-xs text-[var(--text-muted)] font-bold uppercase">{k}</p></div>
            ))}
          </div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          <h3 className="font-black text-sm uppercase tracking-wider text-[var(--text-primary)] mb-3">Email</h3>
          <div className="grid grid-cols-2 gap-2 text-center">
            {[['Sent', d.email?.sent], ['Failed', d.email?.failed]].map(([k, v]) => (
              <div key={k}><p className="text-2xl font-black text-[var(--text-primary)]">{v ?? 0}</p><p className="text-xs text-[var(--text-muted)] font-bold uppercase">{k}</p></div>
            ))}
          </div>
        </div>
      </div>

      {/* Campaign performance */}
      <div className="space-y-3">
        <h2 className="text-lg font-black text-[var(--text-primary)]">Campaign Performance</h2>
        <Card className="p-0 border-none shadow-xl shadow-black/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[var(--surface)] text-[var(--text-muted)] border-b border-[var(--border)] uppercase tracking-wider text-[11px] font-black">
                <tr>
                  <th className="px-6 py-4">Campaign</th>
                  <th className="px-6 py-4 text-right">Enrolled</th>
                  <th className="px-6 py-4 text-right">Active</th>
                  <th className="px-6 py-4 text-right">Completed</th>
                  <th className="px-6 py-4 text-right">Converted</th>
                  <th className="px-6 py-4 text-right">Conv. Rate</th>
                  <th className="px-6 py-4 text-right">Messages</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {campaigns.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-[var(--text-muted)]">No campaign data yet.</td></tr>
                ) : campaigns.map((c) => (
                  <tr key={c.campaignId} className="hover:bg-[var(--surface)]/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-[var(--text-primary)]">{c.name}</td>
                    <td className="px-6 py-4 text-right text-[var(--text-secondary)] font-bold">{c.enrolled}</td>
                    <td className="px-6 py-4 text-right text-[var(--text-secondary)]">{c.active}</td>
                    <td className="px-6 py-4 text-right text-[var(--text-secondary)]">{c.completed}</td>
                    <td className="px-6 py-4 text-right text-[var(--success,#27AE60)] font-bold">{c.converted}</td>
                    <td className="px-6 py-4 text-right font-black text-[var(--text-primary)]">{c.conversionRate}%</td>
                    <td className="px-6 py-4 text-right text-[var(--text-secondary)]">{c.messages}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Template usage */}
      <div className="space-y-3">
        <h2 className="text-lg font-black text-[var(--text-primary)]">Template Usage</h2>
        <Card className="p-0 border-none shadow-xl shadow-black/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[var(--surface)] text-[var(--text-muted)] border-b border-[var(--border)] uppercase tracking-wider text-[11px] font-black">
                <tr>
                  <th className="px-6 py-4">Template</th>
                  <th className="px-6 py-4">Channel</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4 text-right">Sends</th>
                  <th className="px-6 py-4 text-right">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {templates.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-[var(--text-muted)]">No template usage yet.</td></tr>
                ) : templates.map((t2) => (
                  <tr key={t2.templateId} className="hover:bg-[var(--surface)]/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-[var(--text-primary)]">{t2.name}</td>
                    <td className="px-6 py-4 capitalize text-[var(--text-secondary)]">{t2.channel}</td>
                    <td className="px-6 py-4 capitalize text-[var(--text-secondary)]">{t2.category || '—'}</td>
                    <td className="px-6 py-4 text-right font-bold text-[var(--text-primary)]">{t2.sends}</td>
                    <td className="px-6 py-4 text-right text-[var(--error)]">{t2.failed || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      </DashboardRefetchOverlay>
    </div>
  );
};

export default AnalyticsPage;
