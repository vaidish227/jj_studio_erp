import React from 'react';
import LeadListView from '../components/LeadListView';
import useLeadList from '../hooks/useLeadList';

const KITPage = () => {
  const { leads, isLoading, error, statusSummary, searchTerm, setSearchTerm } = useLeadList();

  return (
    <LeadListView
      title="Keep In Touch (KIT)"
      subtitle="All leads available for nurture and relationship tracking"
      leads={leads}
      isLoading={isLoading}
      error={error}
      statusSummary={statusSummary}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      emptyMessage="No KIT leads at the moment."
      accentColor="var(--accent-blue)"
    />
  );
};

export default KITPage;
