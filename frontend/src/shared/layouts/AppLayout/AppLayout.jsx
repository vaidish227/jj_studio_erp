import React, { useState } from 'react';
import { useLocation, useNavigate, Outlet, useSearchParams } from 'react-router-dom';
import Sidebar from '../Sidebar/Sidebar';
import Navbar from '../Navbar/Navbar';
import { useAuth } from '../../context/AuthContext';

const AppLayout = ({ children }) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  // Redirect to login if not authenticated (after initial load)
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Determine active item from path
  const pathParts = location.pathname.split('/').filter(Boolean);
  let activeItem = 'dashboard';
  if (pathParts.length > 0) {
    if (pathParts[0] === 'proposal') {
      activeItem = pathParts.length === 1 ? 'proposal-list' : `proposal-${pathParts[1]}`;
    } else if (pathParts[0] === 'settings' && pathParts[1]) {
      activeItem = `settings-${pathParts[1]}`;
    } else {
      activeItem = pathParts[pathParts.length - 1];
    }
  }

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

  const handleGlobalSearch = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value?.trim()) {
      next.set('q', value);
    } else {
      next.delete('q');
    }
    setSearchParams(next, { replace: true });
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
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <Sidebar
        activeItem={activeItem}
        onSelect={handleNavSelect}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
        user={user}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <Navbar
          onMenuToggle={() => setIsMobileOpen((p) => !p)}
          user={user}
          onSearch={handleGlobalSearch}
          searchValue={searchParams.get('q') || ''}
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
    </div>
  );
};

export default AppLayout;
