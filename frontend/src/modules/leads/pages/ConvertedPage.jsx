import React from 'react';
import LeadListView from '../components/LeadListView';
import useLeadList from '../hooks/useLeadList';

const ConvertedPage = () => {
  const { 
    leads, 
    isLoading, 
    error, 
    statusSummary, 
    searchTerm, 
    setSearchTerm,
    projectFilter,
    setProjectFilter 
  } = useLeadList({ status: 'converted' });

  return (
    <LeadListView
      title="Converted / Won"
      subtitle="Successfully converted leads"
      leads={leads}
      isLoading={isLoading}
      error={error}
      statusSummary={statusSummary}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      projectFilter={projectFilter}
      setProjectFilter={setProjectFilter}
      emptyMessage="No converted leads yet."
      accentColor="var(--success)"
    />
  );
};

export default ConvertedPage;
