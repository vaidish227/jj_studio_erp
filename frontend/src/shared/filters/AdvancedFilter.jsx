import { useState } from 'react';
import { Search, Filter, X, RotateCcw } from 'lucide-react';
import FilterDropdown from './FilterDropdown';
import DateRangeFilter from './DateRangeFilter';
import SortSelector from './SortSelector';
import { FILTER_TYPES } from './FilterConfig';
import Button from '../components/Button/Button';

/**
 * Advanced filter component that combines all filter types
 * Responsive design with desktop inline and mobile drawer
 */
const AdvancedFilter = ({
  filters,
  filterConfig,
  updateFilter,
  clearAllFilters,
  hasActiveFilters,
  activeFilterCount,
  className = '',
  showSearch = true,
  compact = false,
  inlineSearch = false,
}) => {
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Handle mobile filter toggle
  const toggleMobileFilters = () => {
    setIsMobileFilterOpen(!isMobileFilterOpen);
  };

  // Render search input
  const renderSearch = () => {
    if (!showSearch || !filterConfig[FILTER_TYPES.SEARCH]) return null;

    return (
      <div className="relative group w-full min-w-0">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors"
        />
        <input
          type="text"
          placeholder={filterConfig[FILTER_TYPES.SEARCH].placeholder}
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all duration-200"
        />
      </div>
    );
  };

  // Render filter controls
  const renderFilterControls = () => {
    const controls = [];

    // Sort selector
    if (filterConfig[FILTER_TYPES.SORT_ALPHABET] || filterConfig[FILTER_TYPES.SORT_DATE]) {
      controls.push(
        <SortSelector
          key="sort"
          value={filters.sort}
          onChange={(value) => updateFilter('sort', value)}
        />
      );
    }

    // Status filter
    if (filterConfig[FILTER_TYPES.STATUS]) {
      controls.push(
        <FilterDropdown
          key="status"
          placeholder="Status"
          options={filterConfig[FILTER_TYPES.STATUS].options}
          value={filters.status}
          onChange={(value) => updateFilter('status', value)}
          multiSelect
          searchable
          width="w-32"
        />
      );
    }

    // Category filter
    if (filterConfig[FILTER_TYPES.CATEGORY]) {
      controls.push(
        <FilterDropdown
          key="category"
          placeholder={filterConfig[FILTER_TYPES.CATEGORY].label}
          options={filterConfig[FILTER_TYPES.CATEGORY].options}
          value={filters.category}
          onChange={(value) => updateFilter('category', value)}
          width="w-32"
        />
      );
    }

    // Lifecycle stage filter (CRM)
    if (filterConfig[FILTER_TYPES.LIFECYCLE_STAGE]) {
      controls.push(
        <FilterDropdown
          key="lifecycleStage"
          placeholder={filterConfig[FILTER_TYPES.LIFECYCLE_STAGE].label || 'Lifecycle Stage'}
          options={filterConfig[FILTER_TYPES.LIFECYCLE_STAGE].options}
          value={filters.lifecycleStage}
          onChange={(value) => updateFilter('lifecycleStage', value)}
          width="w-40"
        />
      );
    }

    // Source filter (origin channel)
    if (filterConfig[FILTER_TYPES.SOURCE]) {
      controls.push(
        <FilterDropdown
          key="source"
          placeholder={filterConfig[FILTER_TYPES.SOURCE].label || 'Source'}
          options={filterConfig[FILTER_TYPES.SOURCE].options}
          value={filters.source}
          onChange={(value) => updateFilter('source', value)}
          width="w-28"
        />
      );
    }

    // Priority filter
    if (filterConfig[FILTER_TYPES.PRIORITY]) {
      controls.push(
        <FilterDropdown
          key="priority"
          placeholder="Priority"
          options={filterConfig[FILTER_TYPES.PRIORITY].options}
          value={filters.priority}
          onChange={(value) => updateFilter('priority', value)}
          width="w-28"
        />
      );
    }

    // Date range filter
    if (filterConfig[FILTER_TYPES.DATE_RANGE]) {
      controls.push(
        <DateRangeFilter
          key="dateRange"
          value={filters.dateRange}
          onChange={(value) => updateFilter('dateRange', value)}
        />
      );
    }

    return controls;
  };

  // Render action buttons
  const renderActions = () => {
    return (
      <div className="flex items-center gap-2">
        {hasActiveFilters && (
          <>
            <span className="text-xs text-[var(--text-muted)]">
              {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-[var(--text-muted)]"
            >
              <RotateCcw size={14} />
              Clear All
            </Button>
          </>
        )}
      </div>
    );
  };

  // Desktop layout
  const renderDesktopLayout = () => {
    if (compact) {
      return (
        <div className="flex flex-wrap items-center gap-3">
          {renderSearch()}
          <div className="flex items-center gap-2">
            {renderFilterControls().slice(0, 2)}
            {renderFilterControls().length > 2 && (
              <span className="text-xs text-[var(--text-muted)]">
                +{renderFilterControls().length - 2} more
              </span>
            )}
          </div>
          {renderActions()}
        </div>
      );
    }

    // Inline mode: search sits on the same row as the filters (good when
    // there are only a few filter controls — keeps the section to one line).
    if (inlineSearch) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          {showSearch && filterConfig[FILTER_TYPES.SEARCH] && (
            <div className="flex-1 min-w-[220px] max-w-md">
              {renderSearch()}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {renderFilterControls()}
          </div>
          <div className="ml-auto">{renderActions()}</div>
        </div>
      );
    }

    // Default: search on its own row above the filter controls (handles
    // pages with many filter dimensions where everything-on-one-row would
    // squash the search input to nothing).
    return (
      <div className="flex flex-col gap-2.5">
        {renderSearch()}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            {renderFilterControls()}
          </div>
          {renderActions()}
        </div>
      </div>
    );
  };

  // Mobile layout
  const renderMobileLayout = () => {
    return (
      <div className="space-y-4">
        {/* Mobile filter button */}
        <div className="flex items-center justify-between gap-4">
          {renderSearch()}
          <Button
            variant={hasActiveFilters ? "primary" : "outline"}
            size="sm"
            onClick={toggleMobileFilters}
            className="flex items-center gap-2"
          >
            <Filter size={16} />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-[var(--primary)]/20 text-[var(--primary)] px-2 py-0.5 rounded-full text-xs">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Mobile filter drawer */}
        {isMobileFilterOpen && (
          <div className="fixed inset-0 z-50 bg-black/50" onClick={toggleMobileFilters}>
            <div 
              className="fixed right-0 top-0 h-full w-80 bg-[var(--surface)] border-l border-[var(--border)] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-[var(--surface)] border-b border-[var(--border)] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[var(--text-primary)]">Filters</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleMobileFilters}
                  >
                    <X size={16} />
                  </Button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {renderFilterControls().map((control, index) => (
                  <div key={index}>{control}</div>
                ))}

                <div className="pt-4 border-t border-[var(--border)] flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={toggleMobileFilters}
                    className="flex-1"
                  >
                    Apply Filters
                  </Button>
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        clearAllFilters();
                        toggleMobileFilters();
                      }}
                    >
                      Clear All
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Desktop */}
      <div className="hidden md:block">
        {renderDesktopLayout()}
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        {renderMobileLayout()}
      </div>
    </div>
  );
};

export default AdvancedFilter;
