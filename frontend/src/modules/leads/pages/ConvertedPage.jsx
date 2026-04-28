import React from 'react';
import LeadListView from '../components/LeadListView';
import useLeadList from '../hooks/useLeadList';

const ConvertedPage = () => {
  const { leads, isLoading, error, searchTerm, setSearchTerm } = useLeadList('converted');

  return (
    <LeadListView
      title="Converted / Won"
      subtitle="Successfully converted leads"
      leads={leads}
      isLoading={isLoading}
      error={error}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      emptyMessage="No converted leads yet."
      accentColor="var(--success)"
    />
  );
};

export default ConvertedPage;
