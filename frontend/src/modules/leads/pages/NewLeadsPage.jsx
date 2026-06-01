import React from 'react';
import LeadListView from '../components/LeadListView';
import useLeadList from '../hooks/useLeadList';
import useFilters from '../../../shared/filters/useFilters';
import AdvancedFilter from '../../../shared/filters/AdvancedFilter';
import AskAIButton from '../../ai/components/AskAIButton';
import { resolveEntry } from '../../ai/aiEntryPoints';

const NewLeadsPage = () => {
  const { 
    leads, 
    isLoading, 
    error, 
    statusSummary, 
    refresh 
  } = useLeadList({ status: 'new' });

  const {
    filters,
    hasActiveFilters,
    activeFilterCount,
    filterConfig,
    updateFilter,
    clearAllFilters,
    process
  } = useFilters('crm', 'leads');

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
        title="New Leads"
        subtitle="Fresh enquiries awaiting action"
        leads={filteredLeads}
        isLoading={isLoading}
        error={error}
        statusSummary={statusSummary}
        showAddButton={true}
        emptyMessage="No new leads yet. Create your first enquiry to get started."
        accentColor="var(--primary)"
        refresh={refresh}
        headerExtra={<AskAIButton label="Ask AI" variant="soft" actions={resolveEntry('newLeads').actions} />}
      />
    </div>
  );
};

export default NewLeadsPage;
