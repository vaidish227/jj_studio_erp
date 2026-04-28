import { useState, useEffect, useCallback } from 'react';
import { crmService } from '../../../shared/services/crmService';

/**
 * Shared hook for fetching leads filtered by status.
 * Used by: NewLeadsPage, MeetingsPage, FollowUpsPage, ProposalsPage, ConvertedPage, LostLeadsPage
 */
const useLeadList = (statusFilter = null) => {
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const response = await crmService.getLeads(params);
      setLeads(response.leads || []);
    } catch (err) {
      setError('Failed to load leads. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const filteredLeads = leads.filter(
    (lead) =>
      lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone?.includes(searchTerm) ||
      lead.projectType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return {
    leads: filteredLeads,
    totalCount: leads.length,
    isLoading,
    error,
    searchTerm,
    setSearchTerm,
    refresh: fetchLeads,
  };
};

export default useLeadList;
