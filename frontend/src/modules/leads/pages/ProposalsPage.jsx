import React from 'react';
import LeadListView from '../components/LeadListView';
import useLeadList from '../hooks/useLeadList';

const ProposalsPage = () => {
  const { leads, isLoading, error, statusSummary, searchTerm, setSearchTerm } = useLeadList({ lifecycleStage: 'proposal_sent' });

  return (
    <LeadListView
      title="Proposals"
      subtitle="Leads awaiting proposal decisions"
      leads={leads}
      isLoading={isLoading}
      error={error}
      statusSummary={statusSummary}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      emptyMessage="No proposals sent yet."
      accentColor="var(--accent-teal)"
    />
  );
};

export default ProposalsPage;
