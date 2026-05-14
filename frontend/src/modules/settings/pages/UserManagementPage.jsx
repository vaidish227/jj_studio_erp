import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, ChevronLeft, Mail, Lock, User,
  RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';
import Card from '../../../shared/components/Card/Card';
import Input from '../../../shared/components/Input/Input';
import Button from '../../../shared/components/Button/Button';
import FormField from '../../../shared/components/FormField/FormField';
import Select from '../../../shared/components/Select/Select';
import { useUserManagement } from '../hooks/useUserManagement';
import { ROLE_OPTIONS } from '../../../shared/constants/permissions';

const FORM_ROLE_OPTIONS = ROLE_OPTIONS
  .filter((r) => r.value !== 'client' && r.value !== 'vendor')
  .map((r) => ({ value: r.value, label: r.label }));

const UserManagementPage = () => {
  const navigate     = useNavigate();
  const [formOpen, setFormOpen] = useState(false);

  const {
    users, loadingUsers, fetchUsers,
    formData, formErrors, isCreating,
    handleChange, handleCreate,
    updateUserRole,
  } = useUserManagement();

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-xl hover:bg-[var(--bg)] transition-colors text-[var(--text-muted)]"
          title="Back to Settings"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">User Management</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Create accounts, assign roles, and manage team access.
          </p>
        </div>
      </div>

      {/* ── Create User (collapsible) ───────────────────────────────────────── */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
        <button
          onClick={() => setFormOpen((p) => !p)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--bg)]/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary)]/15 flex items-center justify-center">
              <UserPlus size={17} className="text-[var(--primary)]" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-[var(--text-primary)]">Add New User</p>
              <p className="text-xs text-[var(--text-muted)]">Register a new team member</p>
            </div>
          </div>
          {formOpen
            ? <ChevronUp size={18} className="text-[var(--text-muted)]" />
            : <ChevronDown size={18} className="text-[var(--text-muted)]" />
          }
        </button>

        {formOpen && (
          <div className="px-5 pb-5 border-t border-[var(--border)]">
            <form onSubmit={handleCreate} className="pt-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Full Name">
                  <Input
                    icon={User}
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    error={formErrors.name}
                  />
                </FormField>

                <FormField label="Email Address">
                  <Input
                    type="email"
                    icon={Mail}
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    error={formErrors.email}
                  />
                </FormField>

                <FormField label="Password">
                  <Input
                    type="password"
                    icon={Lock}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    error={formErrors.password}
                  />
                </FormField>

                <FormField label="Role">
                  <Select
                    options={FORM_ROLE_OPTIONS}
                    value={formData.role}
                    onChange={(value) => handleChange('role', value)}
                  />
                </FormField>
              </div>

              <div className="flex justify-end">
                <Button type="submit" variant="primary" isLoading={isCreating}>
                  Create Account
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* ── Team Members list ───────────────────────────────────────────────── */}
      <Card className="overflow-hidden p-0">
        {/* Card header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--bg)]">
          <div className="flex items-center gap-2">
            <Users size={17} className="text-[var(--text-muted)]" />
            <p className="text-sm font-bold text-[var(--text-primary)]">Team Members</p>
            {!loadingUsers && (
              <span className="px-2 py-0.5 bg-[var(--primary)]/15 text-[var(--primary)] text-xs font-bold rounded-full">
                {users.length}
              </span>
            )}
          </div>
          <button
            onClick={fetchUsers}
            disabled={loadingUsers}
            className="p-1.5 rounded-lg hover:bg-[var(--border)] transition-colors text-[var(--text-muted)] disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw size={15} className={loadingUsers ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Loading skeleton */}
        {loadingUsers && (
          <div className="divide-y divide-[var(--border)]">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-[var(--border)] shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-[var(--border)] rounded w-32" />
                  <div className="h-2.5 bg-[var(--border)] rounded w-48" />
                </div>
                <div className="h-8 w-28 bg-[var(--border)] rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loadingUsers && users.length === 0 && (
          <div className="py-12 text-center">
            <Users size={28} className="text-[var(--border)] mx-auto mb-3" />
            <p className="text-sm text-[var(--text-muted)]">No users found.</p>
          </div>
        )}

        {/* User rows */}
        {!loadingUsers && users.length > 0 && (
          <div className="divide-y divide-[var(--border)]">
            {users.map((u) => {
              const roleMeta = ROLE_OPTIONS.find((r) => r.value === u.role);
              const color    = roleMeta?.color || '#6B6B6B';
              return (
                <div
                  key={u._id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--bg)]/50 transition-colors"
                >
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {u.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {u.name}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{u.email}</p>
                  </div>

                  {/* Role badge (sm+ only) */}
                  <span
                    className="hidden sm:flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold text-white shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {roleMeta?.label || u.role}
                  </span>

                  {/* Role selector */}
                  <select
                    value={u.role}
                    onChange={(e) => updateUserRole(u._id, e.target.value)}
                    className="text-sm px-3 py-2 rounded-xl border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] outline-none focus:border-[var(--primary)] transition-colors cursor-pointer shrink-0"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default UserManagementPage;
