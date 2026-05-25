import React, { createContext, useCallback, useContext, useState } from 'react';

const PMSContext = createContext();

export const PMSProvider = ({ children }) => {
  // Tracks which project is currently "open" so deep-linked tabs don't re-fetch
  const [activeProject, setActiveProject] = useState(null);
  // Increment to bust list-level caches in useProjects
  const [projectsVersion, setProjectsVersion] = useState(0);

  const invalidateProjects = useCallback(() => {
    setProjectsVersion((v) => v + 1);
  }, []);

  const clearActiveProject = useCallback(() => setActiveProject(null), []);

  return (
    <PMSContext.Provider
      value={{
        activeProject,
        setActiveProject,
        clearActiveProject,
        projectsVersion,
        invalidateProjects,
      }}
    >
      {children}
    </PMSContext.Provider>
  );
};

export const usePMS = () => {
  const ctx = useContext(PMSContext);
  if (!ctx) throw new Error('usePMS must be used within PMSProvider');
  return ctx;
};
