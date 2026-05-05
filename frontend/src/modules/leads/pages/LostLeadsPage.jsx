import React from 'react';
import LeadListView from '../components/LeadListView';
import useLeadList from '../hooks/useLeadList';
import useFilters from '../../../shared/filters/useFilters';
import AdvancedFilter from '../../../shared/filters/AdvancedFilter';

const LostLeadsPage = () => {
  const { 
    leads, 
    isLoading, 
    error, 
    statusSummary, 
    refresh
  } = useLeadList({ status: 'lost' });

  const {
    filters,
    hasActiveFilters,
    activeFilterCount,
    filterConfig,
    updateFilter,
    clearAllFilters,
    process
  } = useFilters('crm', 'lostleads');

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
        title="Lost Leads"
        subtitle="Leads that were not converted"
        leads={filteredLeads}
        isLoading={isLoading}
        error={error}
        statusSummary={statusSummary}
        emptyMessage="No lost leads. Keep up the great work!"
        accentColor="var(--error)"
        refresh={refresh}
      />
    </div>
  );
};

export default LostLeadsPage;
