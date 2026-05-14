import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import CreateUserForm from '../components/CreateUserForm';
import RolesPermissionsPage from './RolesPermissionsPage';
import usePermission from '../../../shared/hooks/usePermission';

const SettingsPage = () => {
  const { pathname } = useLocation();
  const navigate     = useNavigate();
  const canManage    = usePermission('users.manage');

  // /settings → /settings/users
  useEffect(() => {
    if (pathname === '/settings' || pathname === '/settings/') {
      navigate('/settings/users', { replace: true });
    }
  }, [pathname, navigate]);

  const isRoles = pathname.includes('/settings/roles');

  // ── Access denied ──────────────────────────────────────────────────────────
  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 bg-[var(--bg)] rounded-2xl flex items-center justify-center mb-4">
          <Shield size={28} className="text-[var(--text-muted)]" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">Access Restricted</h2>
        <p className="text-sm text-[var(--text-muted)] max-w-xs">
          You don't have permission to access settings. Contact your administrator.
        </p>
      </div>
    );
  }

  // ── Roles & Permissions page — has its own complete layout ─────────────────
  if (isRoles) {
    return (
      <div className="max-w-6xl mx-auto">
        <RolesPermissionsPage />
      </div>
    );
  }

  // ── User Management page ───────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">User Management</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Create accounts, assign roles, and manage team members.
        </p>
      </div>
      <CreateUserForm />
    </div>
  );
};

export default SettingsPage;
