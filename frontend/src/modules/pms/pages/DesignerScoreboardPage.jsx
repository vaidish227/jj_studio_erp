import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Trophy, Star, ArrowLeft, ArrowRight, Search, RefreshCw, FileSpreadsheet,
  Award, CheckCircle2, TrendingUp, Activity, Users, Loader2, AlertCircle,
} from 'lucide-react';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { exportReportAsExcel } from '../../../shared/utils/excelExport';
import GlobalDateFilter from '../../../shared/dashboard-filter/components/GlobalDateFilter';
import {
  formatRangeLabel, isValidRange, rangeFromSearchParams, writeRangeToSearchParams,
} from '../../../shared/dashboard-filter/dateRangePresets';

/**
 * DesignerScoreboardPage — the "Full Report" target for the dashboard's
 * Designer KPI / KRA Scoreboard widget. Lists EVERY designer ranked by KRA,
 * with summary KPIs, search / role / sort controls, an Excel export, and a
 * row-level drill-down into the per-designer detail page.
 *
 * Data: GET /pms/dashboard/designer-kra (same numbers as the dashboard widget).
 * Route: /pms/designers  (sibling of /pms/designers/:userId)
 */

// The per-designer detail page accepts ranges too, but the row drill-down keeps
// passing a legacy week|month|quarter|all token for backward-compatible links.
const PRESET_TO_LEGACY = {
  today: 'week', yesterday: 'week', last_7_days: 'week',
  last_30_days: 'month', this_month: 'month', last_month: 'month',
  last_90_days: 'quarter', all_time: 'all',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const daySpan = (from, to) => {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return 30;
  return Math.round(Math.abs(b - a) / DAY_MS) + 1;
};
const rangeToLegacyPeriod = (range) => {
  if (!range) return 'month';
  if (range.preset === 'custom') {
    const d = daySpan(range.from, range.to);
    if (d <= 10) return 'week';
    if (d <= 45) return 'month';
    if (d <= 120) return 'quarter';
    return 'all';
  }
  return PRESET_TO_LEGACY[range.preset] || 'month';
};

// Filesystem-safe slug for the Excel filename.
const rangeSlug = (range) =>
  range?.preset === 'custom' ? `${range.from}_to_${range.to}` : (range?.preset || 'range');

const ROLE_LABEL = {
  primary_designer: 'Primary Designer',
  designer:         'Designer',
  supervisor:       'Supervisor',
  contractor:       'Contractor',
};

const SORT_OPTIONS = [
  { value: 'kra',    label: 'KRA Score' },
  { value: 'onTime', label: 'On-Time %' },
  { value: 'done',   label: 'Delivered' },
  { value: 'active', label: 'Active Tasks' },
  { value: 'name',   label: 'Name (A–Z)' },
];

const onTimeTone = (pct) =>
  pct >= 85 ? { text: 'var(--success)', fill: 'var(--success)' } :
  pct >= 70 ? { text: '#B98800',        fill: 'var(--warning)' } :
              { text: 'var(--error)',   fill: 'var(--error)' };

const scoreTone = (s) =>
  s >= 4.0 ? 'var(--success)' :
  s >= 3.0 ? '#B98800'         :
             'var(--error)';

const MEDAL = ['#D4AF37', '#A8A8A8', '#CD7F32']; // gold · silver · bronze

const Avatar = ({ name }) => {
  const initials = (name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center
                    bg-gradient-to-br from-[var(--primary)]/30 to-[var(--primary)]/10
                    text-[11px] font-black uppercase text-[var(--text-primary)]
                    ring-2 ring-[var(--surface)]">
      {initials}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, suffix, tone = 'default', sub }) => {
  const tones = {
    default: 'text-[var(--text-primary)]',
    success: 'text-[var(--success)]',
    warning: 'text-[var(--warning)]',
    danger:  'text-[var(--error)]',
    info:    'text-[var(--accent-blue)]',
    primary: 'text-[var(--primary)]',
  };
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={14} className={tones[tone]} />
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
      </div>
      <p className={`text-2xl font-extrabold tabular-nums ${tones[tone]}`}>
        {value}
        {suffix && <span className="text-sm font-bold text-[var(--text-muted)] ml-1">{suffix}</span>}
      </p>
      {sub && <p className="text-[10px] text-[var(--text-muted)] mt-1">{sub}</p>}
    </div>
  );
};

const Row = ({ d, rank, onOpen }) => {
  const onTime   = onTimeTone(d.onTimePct);
  const scoreCol = scoreTone(d.kraScore);
  const medal    = rank <= 3 ? MEDAL[rank - 1] : null;

  return (
    <tr
      className="border-t border-[var(--border)] hover:bg-[var(--bg)]/50 transition-colors cursor-pointer"
      onClick={() => onOpen?.(d)}
      title="Open designer detail"
    >
      {/* Rank + Designer */}
      <td className="px-3 lg:px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-6 text-center text-[11px] font-black tabular-nums shrink-0"
            style={{ color: medal || 'var(--text-muted)' }}
          >
            {rank}
          </span>
          <div className="relative">
            <Avatar name={d.name} />
            {medal && (
              <span
                className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full ring-2 ring-[var(--surface)]"
                style={{ background: medal }}
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--text-primary)] truncate">{d.name}</p>
            <p className="text-[10px] text-[var(--text-muted)] capitalize">
              {ROLE_LABEL[d.role] || d.role || '—'}
            </p>
          </div>
        </div>
      </td>

      {/* Active */}
      <td className="px-2 lg:px-3 py-3 text-center">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-[var(--accent-blue)]/12 text-[var(--accent-blue)]">
          {d.active}
        </span>
      </td>

      {/* Delivered */}
      <td className="px-2 lg:px-3 py-3 text-center text-sm font-bold text-[var(--text-primary)] tabular-nums">
        {d.done}
      </td>

      {/* On-Time % */}
      <td className="px-2 lg:px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-[60px] h-1.5 rounded-full bg-[var(--bg)] border border-[var(--border)] overflow-hidden">
            <div className="h-full transition-all" style={{ width: `${Math.min(100, d.onTimePct)}%`, background: onTime.fill }} />
          </div>
          <span className="shrink-0 w-9 text-right text-xs font-extrabold tabular-nums" style={{ color: onTime.text }}>
            {d.onTimePct}%
          </span>
        </div>
      </td>

      {/* First-Pass % */}
      <td className="px-2 lg:px-3 py-3 text-right">
        <span className="text-xs font-bold tabular-nums text-[var(--text-secondary)]">{d.firstPassPct}%</span>
      </td>

      {/* KRA Score */}
      <td className="px-3 lg:px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          <Star size={11} className="fill-current" style={{ color: scoreCol }} />
          <span className="text-sm font-black tabular-nums" style={{ color: scoreCol }}>
            {d.kraScore.toFixed(1)}
          </span>
          <span className="text-[10px] font-bold text-[var(--text-muted)]">/ 5</span>
        </div>
      </td>

      {/* Chevron */}
      <td className="pr-3 lg:pr-4 py-3 text-right">
        <ArrowRight size={14} className="inline text-[var(--text-muted)]" />
      </td>
    </tr>
  );
};

const TH_ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' };
const Th = ({ children, align = 'left' }) => (
  <th className={`px-3 lg:px-4 py-2.5 text-[10px] font-black uppercase tracking-widest ${TH_ALIGN[align]}`}>{children}</th>
);

const DesignerScoreboardPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [range, setRange]         = useState(() => rangeFromSearchParams(searchParams));
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [version, setVersion]     = useState(0);
  const [query, setQuery]         = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortBy, setSortBy]       = useState('kra');
  const [downloading, setDownloading] = useState(false);

  // ── Fetch the full ranked designer list ────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    pmsService.getDesignerKRA(range)
      .then((res) => { if (!cancelled) setData(res || null); })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || err?.message || 'Failed to load scoreboard');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range, version]);

  const designers = useMemo(() => data?.designers || [], [data]);

  const changeRange = (next) => {
    if (!next || !isValidRange(next)) return;
    setRange(next);
    setSearchParams(writeRangeToSearchParams(new URLSearchParams(searchParams), next), { replace: true });
  };

  // ── Summary KPIs (computed from the full list, ignoring filters) ────────────
  const summary = useMemo(() => {
    const count = designers.length;
    const totalDone   = designers.reduce((s, d) => s + d.done, 0);
    const totalActive = designers.reduce((s, d) => s + d.active, 0);
    const avgKra = count > 0
      ? Math.round((designers.reduce((s, d) => s + d.kraScore, 0) / count) * 10) / 10
      : 0;
    // Throughput-weighted on-time so big deliverers count more than idle ones.
    const weightedOnTime = totalDone > 0
      ? Math.round(designers.reduce((s, d) => s + d.onTimePct * d.done, 0) / totalDone)
      : 0;
    return { count, totalDone, totalActive, avgKra, weightedOnTime };
  }, [designers]);

  const roles = useMemo(() => {
    const set = new Set(designers.map((d) => d.role).filter(Boolean));
    return [...set];
  }, [designers]);

  // ── Filter + sort for the table ─────────────────────────────────────────────
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = designers.filter((d) => {
      const matchesQuery = !q || (d.name || '').toLowerCase().includes(q);
      const matchesRole  = roleFilter === 'all' || d.role === roleFilter;
      return matchesQuery && matchesRole;
    });
    const cmp = {
      kra:    (a, b) => b.kraScore - a.kraScore,
      onTime: (a, b) => b.onTimePct - a.onTimePct,
      done:   (a, b) => b.done - a.done,
      active: (a, b) => b.active - a.active,
      name:   (a, b) => (a.name || '').localeCompare(b.name || ''),
    }[sortBy];
    return [...list].sort(cmp);
  }, [designers, query, roleFilter, sortBy]);

  // True rank (by KRA, full list) so medals stay meaningful under any sort/filter.
  const rankByUser = useMemo(() => {
    const m = new Map();
    [...designers].sort((a, b) => b.kraScore - a.kraScore)
      .forEach((d, i) => m.set(String(d.userId), i + 1));
    return m;
  }, [designers]);

  const openDesigner = (d) => {
    if (d?.userId) navigate(`/pms/designers/${d.userId}?period=${rangeToLegacyPeriod(range)}`);
  };

  const downloadExcel = async () => {
    setDownloading(true);
    try {
      const res = await pmsService.getDesignerKpiReport(range);
      exportReportAsExcel(res, {
        fileName: `designer-kpi-${rangeSlug(range)}`,
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
      setDownloading(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg)]"
            title="Back"
          >
            <ArrowLeft size={14} />
          </button>
          <div className="w-11 h-11 rounded-full bg-[var(--primary)]/12 text-[var(--primary)] flex items-center justify-center shrink-0">
            <Trophy size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base lg:text-xl font-extrabold text-[var(--text-primary)]">Designer KPI / KRA Scoreboard</h1>
            <p className="text-[11px] lg:text-xs text-[var(--text-muted)] mt-0.5">
              {formatRangeLabel(range)} · auto-calculated · ranked by KRA score · click a row for full detail
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <GlobalDateFilter value={range} onChange={changeRange} />
          <button
            type="button"
            onClick={() => setVersion((v) => v + 1)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)]"
            title="Refresh"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={downloadExcel}
            disabled={downloading || designers.length === 0}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50"
            title="Download Designer KPI as Excel"
          >
            <FileSpreadsheet size={13} /> {downloading ? 'Preparing…' : 'Excel'}
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={Users}        label="Designers"  value={summary.count}          tone="default" sub="active in period" />
        <StatCard icon={Award}        label="Avg KRA"    value={summary.avgKra} suffix="/5" tone={summary.avgKra >= 4 ? 'success' : summary.avgKra >= 3 ? 'warning' : 'primary'} sub="team average" />
        <StatCard icon={CheckCircle2} label="On-Time"    value={summary.weightedOnTime} suffix="%" tone="success" sub="weighted by delivery" />
        <StatCard icon={Activity}     label="Delivered"  value={summary.totalDone}      tone="info" sub="tasks completed" />
        <StatCard icon={TrendingUp}   label="Active"     value={summary.totalActive}    tone="primary" sub="tasks in progress" />
      </div>

      {/* Toolbar — search · role · sort */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search designer…"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--primary)]"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--primary)] capitalize"
        >
          <option value="all">All roles</option>
          {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] || r}</option>)}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--primary)]"
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
        </select>
        <span className="text-[11px] text-[var(--text-muted)] ml-auto">
          {visible.length} of {designers.length} designer{designers.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={26} className="animate-spin text-[var(--text-muted)]" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--text-muted)]">
            <AlertCircle size={28} className="opacity-50" />
            <p className="text-sm">{error}</p>
            <button
              type="button"
              onClick={() => setVersion((v) => v + 1)}
              className="text-xs font-semibold text-[var(--primary)] hover:underline"
            >
              Retry
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center">
            <Trophy size={28} className="mx-auto text-[var(--text-muted)] opacity-60 mb-2" />
            <p className="text-sm text-[var(--text-muted)]">
              {designers.length === 0 ? 'No designer activity in this period.' : 'No designers match your filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg)]/60 text-[var(--text-muted)]">
                <tr>
                  <Th>Designer</Th>
                  <Th align="center">Active</Th>
                  <Th align="center">Delivered</Th>
                  <Th>On-Time %</Th>
                  <Th align="right">First-Pass</Th>
                  <Th align="right">KRA Score</Th>
                  <th className="pr-3 lg:pr-4" />
                </tr>
              </thead>
              <tbody>
                {visible.map((d) => (
                  <Row
                    key={d.userId}
                    d={d}
                    rank={rankByUser.get(String(d.userId))}
                    onOpen={openDesigner}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        {!loading && !error && designers.length > 0 && (
          <div className="px-5 py-2.5 border-t border-[var(--border)] bg-[var(--bg)]/30 flex items-center justify-between gap-3 text-[10px] text-[var(--text-muted)] flex-wrap">
            <span>
              KRA = 0.45 × On-Time + 0.35 × First-Pass + 0.20 × Throughput (0–5 scale)
            </span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--success)]" /> ≥ 4.0
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--warning)]" /> 3.0–3.9
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--error)]" /> &lt; 3.0
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DesignerScoreboardPage;
