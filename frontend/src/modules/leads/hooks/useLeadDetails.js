import { useState, useEffect, useCallback } from 'react';
import { crmService } from '../../../shared/services/crmService';

const useLeadDetails = (id) => {
  const [lead, setLead] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLead = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const response = await crmService.getLeadById(id);
      setLead(response.lead);
    } catch (err) {
      setError(err?.message || err || 'Failed to fetch lead details');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  const updateStatus = async (status) => {
    try {
      await crmService.updateLeadStatus(id, status);
      setLead(prev => ({ ...prev, status }));
      return true;
    } catch (err) {
      return false;
    }
  };

  const updateLead = async (data) => {
    try {
      await crmService.updateLead(id, data);
      setLead(prev => ({ ...prev, ...data }));
      return true;
    } catch (err) {
      return false;
    }
  };

  return {
    lead,
    isLoading,
    error,
    refresh: fetchLead,
    updateStatus,
    updateLead
  };
};

export default useLeadDetails;
