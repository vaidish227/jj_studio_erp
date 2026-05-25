import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, ChevronLeft, Mail, Lock, User, Phone,
  RefreshCw, ChevronDown, ChevronUp, Pencil, KeyRound,
  Search, Filter, CheckCircle2, XCircle,
} from 'lucide-react';
import Input from '../../../shared/components/Input/Input';
import Button from '../../../shared/components/Button/Button';
import FormField from '../../../shared/components/FormField/FormField';
import Select from '../../../shared/components/Select/Select';
import EditUserModal from '../components/EditUserModal';
import ResetPasswordModal from '../components/ResetPasswordModal';
import { useUserManagement } from '../hooks/useUserManagement';
import { ROLE_OPTIONS } from '../../../shared/constants/permissions';

const FORM_ROLE_OPTIONS = ROLE_OPTIONS
  .filter((r) => r.value !== 'client' && r.value !== 'vendor')
  .map((r) => ({ value: r.value, label: r.label }));

const STATUS_FILTERS = [
  { value: 'all',      label: 'All' },
  { value: 'active',   label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const ROLE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Roles' },
  ...ROLE_OPTIONS.filter((r) => r.value !== 'client' && r.value !== 'vendor'),
];

// ─── Stat pill ────────────────────────────────────────────────────────────────
const StatPill = ({ label, value, color }) => (
  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${color}`}>
    <span className="font-black text-sm">{value}</span>
    <span>{label}</span>
  </div>
);

// ─── User card ────────────────────────────────────────────────────────────────
const UserCard = ({ user, onEdit, onReset }) => {
  const roleMeta = ROLE_OPTIONS.find((r) => r.value === user.role);
  const color    = roleMeta?.color || '#6B6B6B';
  const isActive = user.isActive !== false;

  return (
    <div className={`group flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--bg)]/50 transition-colors border-b border-[var(--border)] last:border-0 ${!isActive ? 'opacity-60' : ''}`}>

      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm"
        style={{ backgroundColor: color }}
      >
        {user.name?.charAt(0)?.toUpperCase() || '?'}
      </div>

      {/* Name + info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{user.name}</p>
          {isActive
            ? <CheckCircle2 size={13} className="text-[var(--success)] shrink-0" />
            : <XCircle      size={13} className="text-[var(--error)] shrink-0" />
          }
        </div>
        <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
        {(user.designation || user.department) && (
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
            {[user.designation, user.department].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {/* Role badge */}
      <span
        className="hidden sm:flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold text-white shrink-0 shadow-sm"
        style={{ backgroundColor: color }}
      >
        {roleMeta?.label || user.role}
      </span>

      {/* Action buttons — visible on hover */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(user)}
          className="p-2 rounded-lg hover:bg-[var(--primary)]/10 text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
          title="Edit user"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => onReset(user)}
          className="p-2 rounded-lg hover:bg-[var(--warning)]/10 text-[var(--text-muted)] hover:text-[var(--warning)] transition-colors"
          title="Reset password"
        >
          <KeyRound size={14} />
        </button>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const UserManagementPage = () => {
  const navigate = useNavigate();

  const {
    users, loadingUsers, fetchUsers,
    formData, formErrors, isCreating,
    handleChange, handleCreate,
    editTarget, isUpdating, openEdit, closeEdit, handleUpdateUser,
    resetTarget, isResetting, openResetPassword, closeResetPassword, handleResetPassword,
  } = useUserManagement();

  const [formOpen,    setFormOpen]    = useState(false);
  const [search,      setSearch]      = useState('');
  const [roleFilter,  setRoleFilter]  = useState('all');
  const [statusFilter,setStatusFilter]= useState('all');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter((u) => {
      if (q && !u.name?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false;
      if (roleFilter   !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter === 'active'   && u.isActive === false) return false;
      if (statusFilter === 'inactive' && u.isActive !== false) return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const totalActive   = users.filter((u) => u.isActive !== false).length;
  const totalInactive = users.filter((u) => u.isActive === false).length;

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
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">User Management</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Create accounts, assign roles, and manage team access.
          </p>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      {!loadingUsers && users.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <StatPill
            label="Total"   value={users.length}
            color="border-[var(--border)] text-[var(--text-secondary)]"
          />
          <StatPill
            label="Active"  value={totalActive}
            color="border-[var(--success)]/30 text-[var(--success)] bg-[var(--success)]/5"
          />
          {totalInactive > 0 && (
            <StatPill
              label="Inactive" value={totalInactive}
              color="border-[var(--error)]/30 text-[var(--error)] bg-[var(--error)]/5"
            />
          )}
        </div>
      )}

      {/* ── Add User (collapsible) ──────────────────────────────────────────── */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm overflow-visible">
        <button
          onClick={() => setFormOpen((p) => !p)}
          className={`w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--bg)]/50 transition-colors ${formOpen ? 'rounded-t-2xl' : 'rounded-2xl'}`}
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
            ? <ChevronUp   size={18} className="text-[var(--text-muted)]" />
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
                <FormField label="WhatsApp Number (optional)">
                  <Input
                    type="tel"
                    icon={Phone}
                    placeholder="+91 9876543210"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    error={formErrors.phone}
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

      {/* ── Team Members ───────────────────────────────────────────────────── */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">

        {/* Card header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[var(--border)] bg-[var(--bg)]">
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

        {/* Filter bar */}
        {!loadingUsers && users.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--border)] flex-wrap">
            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-xl flex-1 min-w-[160px]">
              <Search size={13} className="text-[var(--text-muted)] shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none w-full"
              />
            </div>
            {/* Role filter */}
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-[var(--text-muted)]" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] outline-none focus:border-[var(--primary)] cursor-pointer"
              >
                {ROLE_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {/* Status filter */}
            <div className="flex items-center gap-1">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStatusFilter(s.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    statusFilter === s.value
                      ? 'bg-[var(--primary)] text-black'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border)]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

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
                <div className="h-7 w-24 bg-[var(--border)] rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loadingUsers && filtered.length === 0 && (
          <div className="py-12 text-center">
            <Users size={28} className="text-[var(--border)] mx-auto mb-3" />
            <p className="text-sm text-[var(--text-muted)]">
              {users.length === 0 ? 'No users found.' : 'No users match the current filters.'}
            </p>
          </div>
        )}

        {/* User list */}
        {!loadingUsers && filtered.length > 0 && (
          <div>
            {filtered.map((u) => (
              <UserCard
                key={u._id}
                user={u}
                onEdit={openEdit}
                onReset={openResetPassword}
              />
            ))}
            {filtered.length < users.length && (
              <p className="text-center text-xs text-[var(--text-muted)] py-2.5 border-t border-[var(--border)]">
                Showing {filtered.length} of {users.length} users
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <EditUserModal
        isOpen={!!editTarget}
        onClose={closeEdit}
        user={editTarget}
        onSave={handleUpdateUser}
        isSaving={isUpdating}
      />
      <ResetPasswordModal
        isOpen={!!resetTarget}
        onClose={closeResetPassword}
        user={resetTarget}
        onReset={handleResetPassword}
        isResetting={isResetting}
      />
    </div>
  );
};

export default UserManagementPage;
