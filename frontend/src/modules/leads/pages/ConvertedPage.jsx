import React from 'react';
import LeadListView from '../components/LeadListView';
import useLeadList from '../hooks/useLeadList';
import useFilters from '../../../shared/filters/useFilters';
import AdvancedFilter from '../../../shared/filters/AdvancedFilter';

const ConvertedPage = () => {
  const { 
    leads, 
    isLoading, 
    error, 
    statusSummary, 
    refresh
  } = useLeadList({ status: 'converted' });

  const {
    filters,
    hasActiveFilters,
    activeFilterCount,
    filterConfig,
    updateFilter,
    clearAllFilters,
    process
  } = useFilters('crm', 'converted');

  // Apply filters to leads
  const filteredLeads = process(leads);

  return (
    <div className="space-y-6">
      <AdvancedFilter
        filters={filters}
        filterConfig={filterConfig}
        updateFilter={updateFilter}
        clearAllFilters={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
      />
      
      <LeadListView
        title="Converted / Won"
        subtitle="Successfully converted leads"
        leads={filteredLeads}
        isLoading={isLoading}
        error={error}
        statusSummary={statusSummary}
        emptyMessage="No converted leads yet."
        accentColor="var(--success)"
        refresh={refresh}
      />
    </div>
  );
};

export default ConvertedPage;
