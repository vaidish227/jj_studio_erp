import React, { useState } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import Sidebar from '../Sidebar/Sidebar';
import Navbar from '../Navbar/Navbar';
import { useAuth } from '../../context/AuthContext';
import { AIChatProvider } from '../../../modules/ai/context/AIChatContext';
import ChatLauncher from '../../../modules/ai/components/ChatLauncher';
import { NAV_ITEMS } from '../../constants/navigation';

// Flatten the nav tree to a list of { id, path } for every item that has a path.
const flattenNavPaths = (items) =>
  items.flatMap((it) => [
    ...(it.path ? [{ id: it.id, path: it.path }] : []),
    ...(it.children ? flattenNavPaths(it.children) : []),
  ]);

const NAV_PATHS = flattenNavPaths(NAV_ITEMS);

// Resolve the active sidebar id by matching the current pathname against the
// nav paths: an exact match wins, otherwise the longest path that is a parent
// prefix (so detail routes like /projects/:id highlight their parent). This
// replaces brittle last-URL-segment parsing, so EVERY row highlights correctly
// even when its id differs from the URL (e.g. new-leads → /crm/forms/enquiry).
const resolveActiveItem = (pathname) => {
  const exact = NAV_PATHS.find((n) => n.path === pathname);
  if (exact) return exact.id;
  const prefix = NAV_PATHS
    .filter((n) => pathname.startsWith(`${n.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return prefix ? prefix.id : '';
};

const AppLayout = ({ children }) => {
  const [isMobileOpen,  setIsMobileOpen]  = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  );

  const toggleCollapsed = () =>
    setIsCollapsed((prev) => {
      localStorage.setItem('sidebar-collapsed', String(!prev));
      return !prev;
    });
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, logout, hasPermission } = useAuth();

  // Redirect to login if not authenticated (after initial load)
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Active sidebar row, resolved by matching the URL against the nav tree.
  const activeItem = resolveActiveItem(location.pathname);

  const handleNavSelect = (id, path) => {
    if (path) {
      navigate(path);
    } else if (id === 'dashboard') {
      navigate('/dashboard');
    } else {
      if (['new-leads', 'contacted', 'meetings', 'follow-ups', 'qualified', 'proposal', 'converted', 'lost-leads'].includes(id)) {
        navigate(`/crm/${id}`);
      } else {
        navigate(`/${id}`);
      }
    }
    setIsMobileOpen(false);
  };

  // Show nothing while checking auth (prevents flash of content)
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg)]">
        <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    // AIChatProvider wraps the entire authenticated app (not just the launcher)
    // so contextual "Ask AI" buttons on any page/form can call useAIChat().
    // The floating launcher itself stays gated by the `ai.chat` permission below.
    <AIChatProvider>
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <Sidebar
        activeItem={activeItem}
        onSelect={handleNavSelect}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
        user={user}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapsed}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <Navbar
          onMenuToggle={() => setIsMobileOpen((p) => !p)}
          user={user}
          onLogout={logout}
        />
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar">
          {children || <Outlet />}
        </main>

        <footer className="px-6 py-4 text-center text-xs text-[var(--text-muted)] border-t border-[var(--border)]">
          © 2025{' '}
          <span className="text-[var(--primary)] font-semibold">JJ-Studio</span>{' '}
          ERP System. All rights reserved.
        </footer>
      </div>

      {hasPermission('ai.chat') && <ChatLauncher />}
    </div>
    </AIChatProvider>
  );
};

export default AppLayout;
