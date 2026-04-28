import React from 'react';
import LeadListView from '../components/LeadListView';
import useLeadList from '../hooks/useLeadList';

const LostLeadsPage = () => {
  const { leads, isLoading, error, searchTerm, setSearchTerm } = useLeadList('lost');

  return (
    <LeadListView
      title="Lost Leads"
      subtitle="Leads that were not converted"
      leads={leads}
      isLoading={isLoading}
      error={error}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      emptyMessage="No lost leads. Keep up the great work!"
      accentColor="var(--error)"
    />
  );
};

export default LostLeadsPage;
