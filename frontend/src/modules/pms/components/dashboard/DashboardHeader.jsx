import React from 'react';
import { RotateCcw, LayoutDashboard } from 'lucide-react';

const PERIODS = [
  { id: 'week',    label: 'This Week'    },
  { id: 'month',   label: 'This Month'   },
  { id: 'quarter', label: 'This Quarter' },
  { id: 'all',     label: 'All Time'     },
];

const DashboardHeader = ({ period, onPeriodChange, onRefresh, isLoading }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/12 text-[var(--primary)] flex items-center justify-center">
          <LayoutDashboard size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] leading-tight">
            Project Management Dashboard
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Live operational view across all active projects.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={period}
          onChange={(e) => onPeriodChange(e.target.value)}
          className="text-sm font-semibold bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 outline-none focus:border-[var(--primary)] cursor-pointer"
        >
          {PERIODS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--primary)] hover:border-[var(--primary)]/40 transition-colors disabled:opacity-50"
        >
          <RotateCcw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </div>
  );
};

export default DashboardHeader;
