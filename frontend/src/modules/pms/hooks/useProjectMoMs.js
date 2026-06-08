import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'pms.recordedMoMs.v1';

const readAll = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeAll = (data) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* quota or private mode — ignore */ }
};

const newId = () => `mom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const useProjectMoMs = (projectId) => {
  const [moms, setMoms] = useState([]);

  useEffect(() => {
    if (!projectId) { setMoms([]); return; }
    const all = readAll();
    setMoms(Array.isArray(all[projectId]) ? all[projectId] : []);
  }, [projectId]);

  const persist = useCallback((nextForProject) => {
    const all = readAll();
    all[projectId] = nextForProject;
    writeAll(all);
    setMoms(nextForProject);
  }, [projectId]);

  const addMoM = useCallback((mom) => {
    if (!projectId) return null;
    const record = {
      ...mom,
      id: newId(),
      projectId,
      createdAt: new Date().toISOString(),
    };
    persist([record, ...moms]);
    return record;
  }, [moms, persist, projectId]);

  const updateMoM = useCallback((id, patch) => {
    if (!projectId) return;
    persist(moms.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m)));
  }, [moms, persist, projectId]);

  const removeMoM = useCallback((id) => {
    if (!projectId) return;
    persist(moms.filter((m) => m.id !== id));
  }, [moms, persist, projectId]);

  return { moms, addMoM, updateMoM, removeMoM };
};

export default useProjectMoMs;
