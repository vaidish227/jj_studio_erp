import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { notificationService } from '../services/notificationService';

const POLL_INTERVAL_MS = 30 * 1000;
const RECENT_LIMIT = 10;

const NotificationContext = createContext(null);

const isAuthenticated = () =>
  typeof window !== 'undefined' && !!window.localStorage.getItem('auth_token');

export const NotificationProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);

  const pollRef = useRef(null);
  const inFlightRef = useRef(false);

  // Pull the most recent N notifications + the canonical unread count.
  // Best-effort: any error is swallowed (next poll will retry).
  const refresh = useCallback(async () => {
    if (!isAuthenticated()) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsLoading(true);
    try {
      const res = await notificationService.list({ limit: RECENT_LIMIT, skip: 0 });
      setItems(res.items || []);
      setUnreadCount(typeof res.unread === 'number' ? res.unread : 0);
      setLastFetchedAt(new Date());
    } catch {
      // Silent — bell stays on last-known state until next poll
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, []);

  // ─── Polling lifecycle ───────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated()) return undefined;

    refresh();

    const startPolling = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') refresh();
      }, POLL_INTERVAL_MS);
    };
    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    startPolling();

    // Refetch when tab becomes visible or window regains focus
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onFocus = () => refresh();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  // ─── Mutations (optimistic UI, server reconciliation on next refresh) ──
  const markAsRead = useCallback(async (id) => {
    setItems((prev) => prev.map((n) => (n._id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await notificationService.markAsRead(id);
    } catch {
      refresh();
    }
  }, [refresh]);

  const markAllAsRead = useCallback(async () => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    setUnreadCount(0);
    try {
      await notificationService.markAllAsRead();
    } catch {
      refresh();
    }
  }, [refresh]);

  const dismiss = useCallback(async (id) => {
    let wasUnread = false;
    setItems((prev) => {
      const next = prev.filter((n) => {
        if (n._id === id && !n.readAt) wasUnread = true;
        return n._id !== id;
      });
      return next;
    });
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await notificationService.dismiss(id);
    } catch {
      refresh();
    }
  }, [refresh]);

  const value = {
    items,
    unreadCount,
    isLoading,
    lastFetchedAt,
    refresh,
    markAsRead,
    markAllAsRead,
    dismiss,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    // Soft fallback — if a consumer renders outside the provider, return inert
    // values rather than throwing (keeps the bell from crashing the navbar
    // during login/logout state transitions).
    return {
      items: [],
      unreadCount: 0,
      isLoading: false,
      lastFetchedAt: null,
      refresh: () => {},
      markAsRead: () => {},
      markAllAsRead: () => {},
      dismiss: () => {},
    };
  }
  return ctx;
};

export default NotificationContext;
