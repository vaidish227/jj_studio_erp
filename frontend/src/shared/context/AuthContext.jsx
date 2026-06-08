  import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { handleAuthFailure } from '../services/apiClient';

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

// Read `exp` (seconds since epoch) from a JWT without verifying its signature.
// Returns null if the token is malformed. We only use this for client-side
// "when should I redirect" — the server still enforces real validity.
const getTokenExpiryMs = (token) => {
  if (!token || typeof token !== 'string') return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    // base64url → base64
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const claims = JSON.parse(atob(padded));
    return typeof claims.exp === 'number' ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  // Timer that fires exactly when the current JWT expires.
  const expiryTimerRef = useRef(null);

  // Hydrate from localStorage on mount (survives page refresh)
  useEffect(() => {
    const savedUser = readLocalStorage('user');
    const savedToken = localStorage.getItem('auth_token');
    const savedPermissions = readLocalStorage('permissions', []);

    if (savedToken && savedUser) {
      // If the saved token is already expired (user came back days later),
      // wipe state and force them to log in again.
      const expMs = getTokenExpiryMs(savedToken);
      if (expMs && expMs <= Date.now()) {
        handleAuthFailure('Your session expired. Please log in again.');
        setIsLoading(false);
        return;
      }
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
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('permissions');
    setUser(null);
    setPermissions([]);
  }, []);

  // ── Proactive expiry: when the JWT `exp` arrives, force a logout +
  //    redirect even if the user is idle (not making any API calls).
  useEffect(() => {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
    if (!user) return;

    const token = localStorage.getItem('auth_token');
    const expMs = getTokenExpiryMs(token);
    if (!expMs) return;

    const ms = expMs - Date.now();
    if (ms <= 0) {
      handleAuthFailure('Your session expired. Please log in again.');
      return;
    }
    // setTimeout caps near 2^31 ms (~24.8 days). Our session is 7 days so
    // we're well under that — no need to chain timers.
    expiryTimerRef.current = setTimeout(() => {
      handleAuthFailure('Your session expired. Please log in again.');
    }, ms);

    return () => {
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
    };
  }, [user]);

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
