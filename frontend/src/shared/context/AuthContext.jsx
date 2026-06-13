  import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { handleAuthFailure } from '../services/apiClient';
import { authService } from '../services/authService';

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

// Auth payloads expose the user id as `id`, but many pages compare ownership
// against `user._id` (Mongo document shape). Normalize so both always exist —
// also repairs stale localStorage sessions cached before this fix.
const normalizeUser = (u) => (u && !u._id && u.id ? { ...u, _id: u.id } : u);

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

  // Called after a successful login
  const login = useCallback((userData, token, userPermissions = []) => {
    const normalized = normalizeUser(userData);
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify(normalized));
    localStorage.setItem('permissions', JSON.stringify(userPermissions));
    setUser(normalized);
    setPermissions(userPermissions);
  }, []);

  // Re-fetch the current user + effective permissions from the server. Used to
  // pick up role/permission changes live — e.g. when an admin grants the MD
  // role the "Reports" permission, the MD user gets it on the next focus tick
  // instead of having to log out and log back in. A network error is treated
  // as transient: keep the cached state. A 401 is handled by the apiClient
  // interceptor (clears state, redirects to /login).
  const refreshSession = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    try {
      const data = await authService.me();
      if (!data) return;
      const freshUser = normalizeUser(data.user);
      const freshPermissions = data.permissions || [];
      if (freshUser) {
        localStorage.setItem('user', JSON.stringify(freshUser));
        setUser(freshUser);
      }
      localStorage.setItem('permissions', JSON.stringify(freshPermissions));
      setPermissions(freshPermissions);
    } catch {
      // Swallow transient errors. 401s already triggered a redirect in apiClient.
    }
  }, []);

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
      setUser(normalizeUser(savedUser));
      setPermissions(savedPermissions);
      // Hydrate UI immediately from cache, then refresh from server so any
      // role/permission changes that happened while logged out show up without
      // a re-login. Don't block the loading screen on this.
      refreshSession();
    }
    setIsLoading(false);
  }, [refreshSession]);

  // Re-fetch permissions when the user returns to the tab. Catches the common
  // "admin granted me a permission, switch back to my tab" flow cheaply.
  useEffect(() => {
    if (!user) return;
    const onFocus = () => { refreshSession(); };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshSession();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user, refreshSession]);

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
    // setTimeout caps near 2^31 ms (~24.8 days). Our session is 24 hours so
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
      refreshSession,
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
