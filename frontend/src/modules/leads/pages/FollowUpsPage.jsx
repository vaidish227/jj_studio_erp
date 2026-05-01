import React from 'react';
import LeadListView from '../components/LeadListView';
import useLeadList from '../hooks/useLeadList';

const FollowUpsPage = () => {
  const { 
    leads, 
    isLoading, 
    error, 
    statusSummary, 
    searchTerm, 
    setSearchTerm,
    projectFilter,
    setProjectFilter 
  } = useLeadList({ lifecycleStage: 'followup_due' });

  return (
    <LeadListView
      title="Follow-ups"
      subtitle="Leads with completed meetings requiring follow-up"
      leads={leads}
      isLoading={isLoading}
      error={error}
      statusSummary={statusSummary}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      projectFilter={projectFilter}
      setProjectFilter={setProjectFilter}
      emptyMessage="No follow-ups pending."
      accentColor="var(--warning)"
    />
  );
};

export default FollowUpsPage;
