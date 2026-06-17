import { RotateCcw } from 'lucide-react';

/**
 * Wraps dashboard content and, while a refetch is in flight, keeps the cards
 * visible (dimmed + non-interactive) with a floating "Updating…" pill. Extracted
 * from the MD dashboard so every dashboard shares one refetch affordance.
 *
 * @param {boolean} active   true while a range-change / poll refetch is loading
 * @param {string}  label    pill text (default "Updating…")
 * @param {string}  className extra classes for the content wrapper (e.g. "space-y-5")
 */
const DashboardRefetchOverlay = ({ active = false, label = 'Updating…', className = '', children }) => (
  <div className={`relative transition-opacity duration-200 ${active ? 'opacity-60 pointer-events-none' : ''} ${className}`}>
    {active && (
      <div className="absolute inset-x-0 top-2 z-20 flex justify-center pointer-events-none">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-md text-xs font-semibold text-[var(--text-secondary)]">
          <RotateCcw size={13} className="animate-spin" /> {label}
        </span>
      </div>
    )}
    {children}
  </div>
);

export default DashboardRefetchOverlay;
