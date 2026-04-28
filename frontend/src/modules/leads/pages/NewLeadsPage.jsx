import React from 'react';
import LeadListView from '../components/LeadListView';
import useLeadList from '../hooks/useLeadList';

const NewLeadsPage = () => {
  const { leads, isLoading, error, searchTerm, setSearchTerm } = useLeadList('new');

  return (
    <LeadListView
      title="New Leads"
      subtitle="Fresh enquiries awaiting action"
      leads={leads}
      isLoading={isLoading}
      error={error}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      showAddButton={true}
      emptyMessage="No new leads yet. Create your first enquiry to get started."
      accentColor="var(--primary)"
    />
  );
};

export default NewLeadsPage;
