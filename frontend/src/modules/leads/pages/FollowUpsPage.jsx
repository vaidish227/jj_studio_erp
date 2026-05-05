import React from 'react';
import LeadListView from '../components/LeadListView';
import useLeadList from '../hooks/useLeadList';
import useFilters from '../../../shared/filters/useFilters';
import AdvancedFilter from '../../../shared/filters/AdvancedFilter';

const FollowUpsPage = () => {
  const { 
    leads, 
    isLoading, 
    error, 
    statusSummary, 
    refresh
  } = useLeadList({ lifecycleStage: 'followup_due' });

  const {
    filters,
    hasActiveFilters,
    activeFilterCount,
    filterConfig,
    updateFilter,
    clearAllFilters,
    process
  } = useFilters('crm', 'followups');

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
        title="Follow-ups"
        subtitle="Leads with completed meetings requiring follow-up"
        leads={filteredLeads}
        isLoading={isLoading}
        error={error}
        statusSummary={statusSummary}
        emptyMessage="No follow-ups pending."
        accentColor="var(--warning)"
        refresh={refresh}
      />
    </div>
  );
};

export default FollowUpsPage;
