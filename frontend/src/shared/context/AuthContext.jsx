  import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AuthContext = createContext(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const readLocalStorage = (key, fallback = null) => {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate from localStorage on mount (survives page refresh)
  useEffect(() => {
    const savedUser = readLocalStorage('user');
    const savedToken = localStorage.getItem('auth_token');
    const savedPermissions = readLocalStorage('permissions', []);

    if (savedToken && savedUser) {
      setUser(savedUser);
      setPermissions(savedPermissions);
    }
    setIsLoading(false);
  }, []);

  // Called after a successful login
  const login = useCallback((userData, token, userPermissions = []) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('permissions', JSON.stringify(userPermissions));
    setUser(userData);
    setPermissions(userPermissions);
  }, []);

  // Clear all auth state
  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('permissions');
    setUser(null);
    setPermissions([]);
  }, []);

  // ─── Permission helpers ─────────────────────────────────────────────────────
  // Wildcard '*' means admin — has everything
  const hasPermission = useCallback((permission) => {
    if (!permission) return true;
    if (permissions.includes('*')) return true;
    return permissions.includes(permission);
  }, [permissions]);

  const hasAnyPermission = useCallback((permissionList = []) => {
    if (permissions.includes('*')) return true;
    return permissionList.some((p) => permissions.includes(p));
  }, [permissions]);

  const hasAllPermissions = useCallback((permissionList = []) => {
    if (permissions.includes('*')) return true;
    return permissionList.every((p) => permissions.includes(p));
  }, [permissions]);

  const isAdmin = user?.role === 'admin';
  const isAuthenticated = !!user && !!localStorage.getItem('auth_token');

  return (
    <AuthContext.Provider value={{
      user,
      permissions,
      isAuthenticated,
      isLoading,
      isAdmin,
      login,
      logout,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

export default AuthContext;
