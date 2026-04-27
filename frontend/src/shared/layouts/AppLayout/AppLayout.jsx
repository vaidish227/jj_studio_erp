import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import Sidebar from '../Sidebar/Sidebar';
import Navbar from '../Navbar/Navbar';

const AppLayout = ({ children }) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active item from path
  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeItem = pathParts.length > 0 ? pathParts[pathParts.length - 1] : 'dashboard';

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

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      {/* Sidebar — handles both desktop (static) and mobile (drawer) */}
      <Sidebar
        activeItem={activeItem}
        onSelect={handleNavSelect}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar
          onMenuToggle={() => setIsMobileOpen((p) => !p)}
        />
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar">
          {children || <Outlet />}
        </main>

        {/* Footer */}
        <footer className="px-6 py-4 text-center text-xs text-[var(--text-muted)] border-t border-[var(--border)]">
          © 2025{' '}
          <span className="text-[var(--primary)] font-semibold">InteriorDash</span>{' '}
          CRM System. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

export default AppLayout;
