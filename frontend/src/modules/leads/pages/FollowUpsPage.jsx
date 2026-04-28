import React from 'react';
import LeadListView from '../components/LeadListView';
import useLeadList from '../hooks/useLeadList';

const FollowUpsPage = () => {
  const { leads, isLoading, error, searchTerm, setSearchTerm } = useLeadList('meeting_done');

  return (
    <LeadListView
      title="Follow-ups"
      subtitle="Leads with completed meetings requiring follow-up"
      leads={leads}
      isLoading={isLoading}
      error={error}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      emptyMessage="No follow-ups pending."
      accentColor="var(--warning)"
    />
  );
};

export default FollowUpsPage;
