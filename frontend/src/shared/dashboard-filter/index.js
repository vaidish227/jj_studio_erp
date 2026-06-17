/**
 * Shared dashboard date-filter foundation.
 *
 * One import surface for every dashboard (MD, CRM, Main, PMS, …). Domain-specific
 * concerns — storage key, default range, legacy param mapping, which cards are
 * flow vs snapshot, layout — live in each dashboard's own config/components.
 */

// Components
export { default as GlobalDateFilter } from './components/GlobalDateFilter';
export { default as SnapshotBadge } from './components/SnapshotBadge';
export { default as DashboardRefetchOverlay } from './components/DashboardRefetchOverlay';

// Hooks
export { default as useDashboardRange } from './hooks/useDashboardRange';
export { default as useDashboardQuery } from './hooks/useDashboardQuery';

// Presets / utilities
export { DATE_PRESETS, isValidRange, formatRangeLabel, rangeToParams } from './dateRangePresets';

// Persistence (usually consumed via useDashboardRange, exported for direct use)
export { loadRange, saveRange } from './persistence';
