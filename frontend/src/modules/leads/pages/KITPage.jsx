import React from 'react';
import LeadListView from '../components/LeadListView';
import useLeadList from '../hooks/useLeadList';

const KITPage = () => {
  const { leads, isLoading, error, searchTerm, setSearchTerm } = useLeadList('contacted');

  return (
    <LeadListView
      title="Keep In Touch (KIT)"
      subtitle="Qualified leads to nurture over time"
      leads={leads}
      isLoading={isLoading}
      error={error}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      emptyMessage="No KIT leads at the moment."
      accentColor="var(--accent-blue)"
    />
  );
};

export default KITPage;
