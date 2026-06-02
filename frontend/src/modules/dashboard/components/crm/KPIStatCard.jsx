import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Sparkline from '../charts/Sparkline';

const KPIStatCard = ({
  title,
  value,
  suffix = '',
  delta,
  deltaSuffix = '%',
  deltaLabel = 'vs prev',
  invertDeltaColor = false,
  icon: Icon,
  iconBg = 'bg-[var(--primary)]/10',
  iconColor = 'text-[var(--primary)]',
  sparkData = [],
  sparkColor = 'var(--primary)',
  onClick,
  isLoading = false,
}) => {
  const isClickable = !!onClick;
  const hasDelta = delta !== undefined && delta !== null && !Number.isNaN(delta);
  const positive = hasDelta && delta > 0;
  const negative = hasDelta && delta < 0;
  const neutral = hasDelta && delta === 0;

  // Some KPIs are "good when going down" (e.g. lost rate) — invert color logic.
  const deltaIsGood = invertDeltaColor ? negative : positive;
  const deltaIsBad = invertDeltaColor ? positive : negative;

  let deltaClasses = 'text-[var(--text-muted)] bg-[var(--bg)]';
  let DeltaIcon = Minus;
  if (deltaIsGood) {
    deltaClasses = 'text-[var(--success)] bg-[var(--success)]/10';
    DeltaIcon = TrendingUp;
  } else if (deltaIsBad) {
    deltaClasses = 'text-[var(--error)] bg-[var(--error)]/10';
    DeltaIcon = TrendingDown;
  } else if (neutral) {
    deltaClasses = 'text-[var(--text-muted)] bg-[var(--bg)]';
    DeltaIcon = Minus;
  }

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`relative group overflow-hidden flex flex-col gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 transition-all duration-300 ${
        isClickable
          ? 'cursor-pointer hover:border-[var(--primary)] hover:shadow-xl hover:-translate-y-1'
          : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] truncate">
            {title}
          </p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)] tabular-nums">
              {isLoading ? '—' : value}
            </span>
            {suffix && (
              <span className="text-sm font-bold text-[var(--text-secondary)]">{suffix}</span>
            )}
          </div>
        </div>
        {Icon && (
          <div
            className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110 ${iconBg}`}
          >
            <Icon size={20} className={iconColor} />
          </div>
        )}
      </div>

      {/* Delta chip */}
      {hasDelta && !isLoading && (
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${deltaClasses}`}
          >
            <DeltaIcon size={11} strokeWidth={3} />
            {delta > 0 ? '+' : ''}
            {delta}
            {deltaSuffix}
          </span>
          <span className="text-[11px] font-medium text-[var(--text-muted)]">{deltaLabel}</span>
        </div>
      )}

      {/* Sparkline */}
      {sparkData?.length > 0 && (
        <div className="mt-1 -mx-1">
          <Sparkline data={sparkData} color={sparkColor} height={32} />
        </div>
      )}
    </div>
  );
};

export default KPIStatCard;
