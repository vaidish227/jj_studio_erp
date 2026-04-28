import React, { createContext, useContext, useState } from 'react';

const CRMContext = createContext();

export const CRMProvider = ({ children }) => {
  const [activeLead, setActiveLead] = useState(null); // Stores { id, name, email, phone }
  const [crmState, setCrmState] = useState({
    lastStep: 'none',
    drafts: {}
  });

  const clearActiveLead = () => setActiveLead(null);

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
