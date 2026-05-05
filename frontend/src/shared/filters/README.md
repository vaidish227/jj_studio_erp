# Advanced Filter System

A comprehensive, reusable filter system for the JJ Studio ERP application.

## Features

- **Config-driven**: Easy to add/remove filter options
- **Reusable**: Works across all modules (CRM, Proposal, Dashboard)
- **Responsive**: Desktop inline, mobile drawer
- **Multiple filter types**: Search, Sort, Status, Category, Date Range, Priority
- **URL sync**: Filters persist in URL parameters
- **Performance optimized**: Memoized filtering logic

## Components

### 1. AdvancedFilter
Main component that combines all filter types.

```jsx
<AdvancedFilter
  filters={filters}
  filterConfig={filterConfig}
  updateFilter={updateFilter}
  clearAllFilters={clearAllFilters}
  hasActiveFilters={hasActiveFilters}
  activeFilterCount={activeFilterCount}
  showSearch={true}
  compact={false}
/>
```

### 2. FilterDropdown
Reusable dropdown for single/multi-select filters.

```jsx
<FilterDropdown
  placeholder="Status"
  options={statusOptions}
  value={selectedStatus}
  onChange={setSelectedStatus}
  multiSelect={true}
  searchable={true}
  width="w-48"
/>
```

### 3. DateRangeFilter
Calendar-based date range selector.

```jsx
<DateRangeFilter
  value={dateRange}
  onChange={setDateRange}
  placeholder="Select date range"
/>
```

### 4. SortSelector
Alphabetical and date sorting options.

```jsx
<SortSelector
  value={sortValue}
  onChange={setSortValue}
  options={customSortOptions}
/>
```

## Hook Usage

### useFilters Hook
Central hook for filter state management.

```jsx
import useFilters from '../../../shared/filters/useFilters';

const {
  filters,           // Current filter values
  apiQuery,         // Generated API query
  hasActiveFilters,  // Boolean if any filters active
  activeFilterCount, // Number of active filters
  filterConfig,      // Module-specific config
  updateFilter,      // Update single filter
  updateFilters,     // Update multiple filters
  clearAllFilters,   // Clear all filters
  clearFilter,       // Clear specific filter
  applyFilters,      // Apply filters to data array
  sortData,          // Sort data array
  process            // Apply filters + sort to data
} = useFilters('module', 'entity');
```

## Configuration

### FilterConfig.js
Central configuration for all modules.

```js
import { getFilterConfig } from './FilterConfig';

// Get config for specific module/entity
const filterConfig = getFilterConfig('crm', 'leads');
```

### Available Filter Types

- `SEARCH`: Universal search across multiple fields
- `SORT_ALPHABET`: A-Z / Z-A sorting
- `SORT_DATE`: Newest / Oldest sorting
- `STATUS`: Multi-select status filtering
- `CATEGORY`: Single-select category filtering
- `DATE_RANGE`: Calendar date range selection
- `PRIORITY`: Single-select priority filtering
- `AMOUNT`: Numeric range filtering

## Module Integration Examples

### CRM Leads
```jsx
const {
  filters,
  hasActiveFilters,
  activeFilterCount,
  filterConfig,
  updateFilter,
  clearAllFilters,
  process
} = useFilters('crm', 'leads');

const filteredLeads = process(leads);
```

### Proposals
```jsx
const {
  filters,
  hasActiveFilters,
  activeFilterCount,
  filterConfig,
  updateFilter,
  clearAllFilters,
  process
} = useFilters('proposal', 'proposals');

const filteredProposals = process(proposals);
```

### Dashboard
```jsx
const {
  filters,
  hasActiveFilters,
  activeFilterCount,
  filterConfig,
  updateFilter,
  clearAllFilters
} = useFilters('dashboard', 'overview');
```

## API Integration

The system generates API queries automatically:

```js
// Example query: ?status=new,contacted&sort=date_newest&dateFrom=2024-01-01&dateTo=2024-01-31
const apiQuery = {
  search: "john doe",
  status: "new,contacted",
  sort: "date_newest",
  dateFrom: "2024-01-01",
  dateTo: "2024-01-31",
  category: "residential",
  priority: "high"
};
```

## Adding New Filters

### 1. Add to FilterConfig.js
```js
export const CRM_FILTERS = {
  leads: {
    [FILTER_TYPES.NEW_FILTER]: {
      // Configuration here
    }
  }
};
```

### 2. Add to useFilters.js
```js
// Add filter logic in applyFilters function
if (filters.newFilter) {
  // Filter logic here
}
```

### 3. Add to AdvancedFilter.jsx
```js
// Add component rendering
if (filterConfig[FILTER_TYPES.NEW_FILTER]) {
  controls.push(
    <NewFilterComponent
      key="newFilter"
      value={filters.newFilter}
      onChange={(value) => updateFilter('newFilter', value)}
    />
  );
}
```

## Styling

All components use CSS custom properties for theming:

- `--primary`: Primary color
- `--surface`: Background color
- `--border`: Border color
- `--text-primary`: Primary text
- `--text-muted`: Muted text
- `--bg`: Background hover
- `--error`: Error color
- `--success`: Success color

## Performance

- Memoized filtering in useFilters hook
- Debounced search input
- Optimized re-renders with useCallback
- Efficient sorting algorithms
- Minimal DOM updates

## Responsive Behavior

### Desktop (md+)
- Inline filter controls
- All filters visible
- Horizontal layout

### Tablet (sm-md)
- Collapsible sections
- Vertical layout
- Clear grouping

### Mobile (xs-sm)
- Drawer/overlay interface
- Filter button with badge
- Full-width drawer

## Browser Support

- Modern browsers (ES2020+)
- Safari 14+
- Chrome 90+
- Firefox 88+
- Edge 90+
