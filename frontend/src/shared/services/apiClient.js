import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Auth helpers ──────────────────────────────────────────────────────────
// Centralised so both this interceptor and AuthContext.logout share the same
// "clear everything and go home" path.
const AUTH_KEYS = ['auth_token', 'user', 'permissions'];

const clearAuthAndRedirect = (reasonMessage) => {
  AUTH_KEYS.forEach((k) => localStorage.removeItem(k));
  // Use replace so the back button can't return to the now-broken page.
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    if (reasonMessage) {
      // Stash a one-shot toast so /login can surface "Session expired"
      try { sessionStorage.setItem('auth_redirect_reason', reasonMessage); } catch {}
    }
    window.location.replace('/login');
  }
};

// Exported for AuthContext.logout to reuse if it wants to.
export const handleAuthFailure = clearAuthAndRedirect;

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error?.response?.status;
    const url    = error?.config?.url || '';

    // 401 on any authed call → JWT missing / expired / invalid. Clear state
    // and bounce to /login. Skip when the failing call IS the login attempt
    // itself (so wrong-password still surfaces as a normal error) and when
    // we're already sitting on /login (no infinite loops).
    if (status === 401 && !url.includes('/auth/login')) {
      clearAuthAndRedirect('Your session expired. Please log in again.');
      return Promise.reject({ message: 'Session expired. Please log in again.' });
    }

    const data = error?.response?.data;
    // Preserve the full response data so callers can access extra fields (e.g. existingId)
    if (data && typeof data === 'object') {
      return Promise.reject(data);
    }
    const message = (typeof data === 'string' ? data : null) || error?.message || 'Something went wrong';
    return Promise.reject({ message });
  }
);

export default apiClient;
