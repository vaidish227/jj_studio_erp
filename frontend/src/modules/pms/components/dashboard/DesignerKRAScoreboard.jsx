import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trophy, Star, ArrowRight } from 'lucide-react';

/**
 * DesignerKRAScoreboard — performance leaderboard the MD can rank designers by.
 *
 * Columns: Designer · Active · Done · On-Time % · KRA Score (0–5)
 * KRA = 0.45 × on-time + 0.35 × first-pass + 0.20 × throughput (normalised).
 */

const ROLE_LABEL = {
  primary_designer: 'Primary Designer',
  designer:         'Designer',
  supervisor:       'Supervisor',
  contractor:       'Contractor',
};

const onTimeTone = (pct) =>
  pct >= 85 ? { text: 'var(--success)', fill: 'var(--success)' } :
  pct >= 70 ? { text: '#B98800',        fill: 'var(--warning)' } :
              { text: 'var(--error)',   fill: 'var(--error)' };

const scoreTone = (s) =>
  s >= 4.0 ? 'var(--success)' :
  s >= 3.0 ? '#B98800'         :
             'var(--error)';

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

const Row = ({ d, rank, onOpen }) => {
  const onTime  = onTimeTone(d.onTimePct);
  const scoreCol = scoreTone(d.kraScore);

  return (
    <tr
      className="border-t border-[var(--border)] hover:bg-[var(--bg)]/40 transition-colors cursor-pointer"
      onClick={() => onOpen?.(d)}
      title="Open designer detail"
    >
      {/* Designer */}
      <td className="px-3 lg:px-4 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-5 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] tabular-nums">
            {rank}
          </span>
          <Avatar name={d.name} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--text-primary)] truncate">{d.name}</p>
            <p className="text-[10px] text-[var(--text-muted)] capitalize">
              {ROLE_LABEL[d.role] || d.role || '—'}
            </p>
          </div>
        </div>
      </td>

      {/* Active */}
      <td className="px-2 lg:px-3 py-2.5 text-center">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-[var(--accent-blue)]/12 text-[var(--accent-blue)]">
          {d.active}
        </span>
      </td>

      {/* Done */}
      <td className="px-2 lg:px-3 py-2.5 text-center text-sm font-bold text-[var(--text-primary)] tabular-nums">
        {d.done}
      </td>

      {/* On-Time % */}
      <td className="px-2 lg:px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-[60px] h-1.5 rounded-full bg-[var(--bg)] border border-[var(--border)] overflow-hidden">
            <div className="h-full transition-all" style={{ width: `${Math.min(100, d.onTimePct)}%`, background: onTime.fill }} />
          </div>
          <span className="shrink-0 w-9 text-right text-xs font-extrabold tabular-nums" style={{ color: onTime.text }}>
            {d.onTimePct}%
          </span>
        </div>
      </td>

      {/* KRA Score */}
      <td className="px-3 lg:px-4 py-2.5 text-right">
        <div className="inline-flex items-center gap-1">
          <Star size={11} className="fill-current" style={{ color: scoreCol }} />
          <span className="text-sm font-black tabular-nums" style={{ color: scoreCol }}>
            {d.kraScore.toFixed(1)}
          </span>
          <span className="text-[10px] font-bold text-[var(--text-muted)]">/ 5</span>
        </div>
      </td>
    </tr>
  );
};

const DesignerKRAScoreboard = ({ designers = [], period = 'month' }) => {
  const navigate = useNavigate();
  const periodLabel = { week: 'This Week', month: 'This Month', quarter: 'This Quarter', all: 'All Time' }[period] || 'This Month';
  const openDesigner = (d) => {
    if (d?.userId) navigate(`/pms/designers/${d.userId}?period=${period}`);
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-5 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-[var(--primary)]" />
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Designer KPI / KRA Scoreboard</h3>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {periodLabel} · auto-calculated · ranked by KRA score
            </p>
          </div>
        </div>
        <Link
          to={`/pms/designers?period=${period}`}
          className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
        >
          Full Report <ArrowRight size={11} />
        </Link>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-x-auto">
        {designers.length === 0 ? (
          <div className="py-12 text-center">
            <Trophy size={28} className="mx-auto text-[var(--text-muted)] opacity-60 mb-2" />
            <p className="text-sm text-[var(--text-muted)]">No designer activity in this period.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg)]/60 text-[var(--text-muted)]">
              <tr>
                <th className="px-3 lg:px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest">Designer</th>
                <th className="px-2 lg:px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest">Active</th>
                <th className="px-2 lg:px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest">Done</th>
                <th className="px-2 lg:px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest">On-Time %</th>
                <th className="px-3 lg:px-4 py-2 text-right text-[10px] font-black uppercase tracking-widest">KRA Score</th>
              </tr>
            </thead>
            <tbody>
              {designers.map((d, i) => <Row key={d.userId} d={d} rank={i + 1} onOpen={openDesigner} />)}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      <div className="px-5 py-2.5 border-t border-[var(--border)] bg-[var(--bg)]/30 flex items-center justify-end gap-3 text-[10px] text-[var(--text-muted)]">
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
  );
};

export default DesignerKRAScoreboard;
