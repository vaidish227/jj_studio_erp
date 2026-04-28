import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLeadFlow } from '../../../shared/hooks/useLeadFlow';

const CRMContext = createContext();
const ACTIVE_LEAD_KEY = 'crm_active_lead';

export const CRMProvider = ({ children }) => {
  const [activeLead, setActiveLeadState] = useState(() => {
    try {
      const raw = localStorage.getItem(ACTIVE_LEAD_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [crmState, setCrmState] = useState({
    lastStep: 'none',
    drafts: {}
  });

  useLeadFlow(activeLead?.id || activeLead?._id);

  useEffect(() => {
    if (activeLead) {
      localStorage.setItem(ACTIVE_LEAD_KEY, JSON.stringify(activeLead));
    } else {
      localStorage.removeItem(ACTIVE_LEAD_KEY);
    }
  }, [activeLead]);

  const setActiveLead = useCallback((lead) => {
    setActiveLeadState(lead);
  }, []);

  const clearActiveLead = useCallback(() => setActiveLeadState(null), []);

  return (
    <CRMContext.Provider value={{ 
      activeLead, 
      setActiveLead, 
      clearActiveLead,
      crmState,
      setCrmState
    }}>
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => {
  const context = useContext(CRMContext);
  if (!context) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
};
