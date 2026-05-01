import React from 'react';
import LeadListView from '../components/LeadListView';
import useLeadList from '../hooks/useLeadList';

const NewLeadsPage = () => {
  const { 
    leads, 
    isLoading, 
    error, 
    statusSummary, 
    searchTerm, 
    setSearchTerm,
    projectFilter,
    setProjectFilter 
  } = useLeadList({ status: 'new' });

  return (
    <LeadListView
      title="New Leads"
      subtitle="Fresh enquiries awaiting action"
      leads={leads}
      isLoading={isLoading}
      error={error}
      statusSummary={statusSummary}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      projectFilter={projectFilter}
      setProjectFilter={setProjectFilter}
      showAddButton={true}
      emptyMessage="No new leads yet. Create your first enquiry to get started."
      accentColor="var(--primary)"
    />
  );
};

export default NewLeadsPage;
