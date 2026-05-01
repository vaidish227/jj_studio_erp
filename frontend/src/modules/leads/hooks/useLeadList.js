import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { crmService } from '../../../shared/services/crmService';

/**
 * Shared hook for fetching leads filtered by status.
 * Used by: NewLeadsPage, MeetingsPage, FollowUpsPage, ProposalsPage, ConvertedPage, LostLeadsPage
 */
const useLeadList = (filters = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusSummary, setStatusSummary] = useState({
    new: 0,
    inProgress: 0,
    interested: 0,
    converted: 0,
    lost: 0,
  });

  const serializedFilters = JSON.stringify(filters);
  const searchTerm = searchParams.get('q') || '';
  const projectFilter = searchParams.get('type') || 'All';

  const setSearchTerm = useCallback((value) => {
    const next = new URLSearchParams(searchParams);
    if (value?.trim()) {
      next.set('q', value);
    } else {
      next.delete('q');
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const setProjectFilter = useCallback((value) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== 'All') {
      next.set('type', value);
    } else {
      next.delete('type');
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await crmService.getLeads({ ...JSON.parse(serializedFilters), limit: 100 });
      const [newRes, contactedRes, meetingDoneRes, interestedRes, convertedRes, lostRes] =
        await Promise.all([
          crmService.getLeads({ status: 'new', limit: 1 }),
          crmService.getLeads({ status: 'contacted', limit: 1 }),
          crmService.getLeads({ status: 'meeting_done', limit: 1 }),
          crmService.getLeads({ status: 'proposal_sent', limit: 1 }),
          crmService.getLeads({ status: 'converted', limit: 1 }),
          crmService.getLeads({ status: 'lost', limit: 1 }),
        ]);

      setLeads(response.leads || []);
      setStatusSummary({
        new: newRes.total || 0,
        inProgress: (contactedRes.total || 0) + (meetingDoneRes.total || 0),
        interested: interestedRes.total || 0,
        converted: convertedRes.total || 0,
        lost: lostRes.total || 0,
      });
    } catch (err) {
      setError('Failed to load leads. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [serializedFilters]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const filteredLeads = useMemo(() => leads.filter(
    (lead) => {
      const matchesSearch = 
        lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone?.includes(searchTerm) ||
        lead.projectType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.city?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = projectFilter === 'All' || lead.projectType === projectFilter;
      
      return matchesSearch && matchesFilter;
    }
  ), [leads, searchTerm, projectFilter]);

  return {
    leads: filteredLeads,
    totalCount: leads.length,
    isLoading,
    error,
    statusSummary,
    searchTerm,
    setSearchTerm,
    projectFilter,
    setProjectFilter,
    refresh: fetchLeads,
  };
};

export default useLeadList;
