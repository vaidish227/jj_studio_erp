import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Save, RotateCcw, Check, Minus,
  Eye, Plus, Pencil, Trash2, CheckCircle, Download, Settings2,
  LayoutDashboard, UserCheck, Briefcase, CheckSquare,
  BarChart2, FileText, MessageCircle, DollarSign, Store,
  Globe, UserCog, ChevronRight, ChevronLeft, Zap, Search, Layers, Users,
} from 'lucide-react';
import { useRolesPermissions } from '../hooks/useRolesPermissions';
import { PERMISSION_MODULES, ROLE_OPTIONS } from '../../../shared/constants/permissions';

// ─── Config ───────────────────────────────────────────────────────────────────

const MODULE_ICONS = {
  dashboard:     LayoutDashboard,
  crm:           Users,
  kit:           MessageCircle,
  proposal:      FileText,
  clients:       UserCheck,
  projects:      Briefcase,
  tasks:         CheckSquare,
  reports:       BarChart2,
  finance:       DollarSign,
  settings:      Settings2,
  users:         UserCog,
  vendor:        Store,
  client_portal: Globe,
};

const ACTION_CONFIG = {
  read:    { icon: Eye,         label: 'Read',    hint: 'Can view records in this module' },
  create:  { icon: Plus,        label: 'Create',  hint: 'Can add new records' },
  update:  { icon: Pencil,      label: 'Update',  hint: 'Can edit existing records' },
  delete:  { icon: Trash2,      label: 'Delete',  hint: 'Can permanently delete records' },
  approve: { icon: CheckCircle, label: 'Approve', hint: 'Can approve pending workflows' },
  export:  { icon: Download,    label: 'Export',  hint: 'Can export or download data' },
  manage:  { icon: Settings2,   label: 'Manage',  hint: 'Has full management access' },
};

const ALL_ACTIONS = Object.keys(ACTION_CONFIG);

const MODULE_GROUPS = [
  { label: 'Core',                  keys: ['dashboard', 'crm', 'kit', 'clients'] },
  { label: 'Documents & Proposals', keys: ['proposal'] },
  { label: 'Operations',            keys: ['projects', 'tasks', 'reports', 'finance'] },
  { label: 'Administration',        keys: ['settings', 'users'] },
  { label: 'External Access',       keys: ['vendor', 'client_portal'] },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const RoleCard = ({ role, isSelected, onClick }) => {
  const meta       = ROLE_OPTIONS.find((r) => r.value === role.name);
  const color      = meta?.color || role.color || '#6B6B6B';
  const isWildcard = role.permissions.includes('*');
  const total      = isWildcard ? '∞' : role.permissions.length;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 transition-all duration-200 group ${
        isSelected
          ? 'border-[var(--primary)] bg-[var(--primary)]/8 shadow-sm'
          : 'border-transparent hover:border-[var(--border)] hover:bg-[var(--bg)]'
      }`}
    >
      <div className="flex items-center gap-3 p-3">
        <div
          className="w-1.5 h-10 rounded-full shrink-0"
          style={{ backgroundColor: isSelected ? color : `${color}60` }}
        />
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-bold shadow-sm"
          style={{ backgroundColor: color }}
        >
          {role.displayName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${isSelected ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'}`}>
            {role.displayName}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {isWildcard ? (
              <span className="flex items-center gap-1">
                <Zap size={10} className="text-[var(--primary)]" />
                Full access
              </span>
            ) : `${total} permission${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        <ChevronRight
          size={15}
          className={`shrink-0 transition-all ${
            isSelected ? 'text-[var(--primary)] translate-x-0.5' : 'text-[var(--border)] group-hover:text-[var(--text-muted)]'
          }`}
        />
      </div>
    </button>
  );
};

const ActionHeader = ({ action }) => {
  const { icon: Icon, label, hint } = ACTION_CONFIG[action];
  const [tip, setTip] = useState(false);
  return (
    <th className="py-3 w-14 relative select-none">
      <div
        className="flex flex-col items-center gap-1.5 cursor-help"
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
      >
        <Icon size={14} className="text-[var(--text-muted)]" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          {label}
        </span>
      </div>
      {tip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[70] bg-[var(--text-primary)] text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap shadow-lg pointer-events-none">
          {hint}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-[var(--text-primary)]" />
        </div>
      )}
    </th>
  );
};

const PermCell = ({ action, active, isWildcard, isSupported, onChange }) => {
  const { icon: Icon, label } = ACTION_CONFIG[action];
  const [tip, setTip] = useState(false);

  if (!isSupported) {
    return (
      <td className="py-2 px-1">
        <div className="flex justify-center">
          <span className="text-[var(--border)] text-sm select-none">—</span>
        </div>
      </td>
    );
  }

  if (isWildcard) {
    return (
      <td className="py-2 px-1">
        <div className="flex justify-center relative">
          <div
            className="w-8 h-8 rounded-lg bg-[var(--primary)]/20 border border-[var(--primary)]/40 flex items-center justify-center cursor-default"
            onMouseEnter={() => setTip(true)}
            onMouseLeave={() => setTip(false)}
          >
            <Icon size={13} className="text-[var(--primary)]" />
          </div>
          {tip && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[70] bg-[var(--text-primary)] text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap shadow-lg pointer-events-none">
              {label} — auto-granted (wildcard)
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--text-primary)]" />
            </div>
          )}
        </div>
      </td>
    );
  }

  return (
    <td className="py-2 px-1">
      <div className="flex justify-center relative">
        <button
          onClick={onChange}
          onMouseEnter={() => setTip(true)}
          onMouseLeave={() => setTip(false)}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 ${
            active
              ? 'bg-[var(--primary)] text-black shadow-sm'
              : 'bg-transparent border border-[var(--border)] text-[var(--border)] hover:border-[var(--primary)]/60 hover:text-[var(--primary)] hover:bg-[var(--primary)]/8'
          }`}
        >
          <Icon size={13} />
        </button>
        {tip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[70] bg-[var(--text-primary)] text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap shadow-lg pointer-events-none">
            {active ? `Revoke ${label}` : `Grant ${label}`}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--text-primary)]" />
          </div>
        )}
      </div>
    </td>
  );
};

const RowAllToggle = ({ allActive, someActive, isWildcard, onChange }) => {
  const [tip, setTip] = useState(false);

  if (isWildcard) {
    return (
      <td className="py-2 px-1 border-l border-[var(--border)]">
        <div className="flex justify-center">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/20 border border-[var(--primary)]/40 flex items-center justify-center cursor-default">
            <Check size={13} className="text-[var(--primary)]" />
          </div>
        </div>
      </td>
    );
  }

  const tipText = allActive
    ? 'Revoke all'
    : someActive
      ? 'Grant remaining'
      : 'Grant all';

  return (
    <td className="py-2 px-1 border-l border-[var(--border)]">
      <div className="flex justify-center relative">
        <button
          onClick={onChange}
          onMouseEnter={() => setTip(true)}
          onMouseLeave={() => setTip(false)}
          className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-150 ${
            allActive
              ? 'bg-[var(--primary)] border-[var(--primary)] text-black shadow-sm'
              : someActive
                ? 'bg-[var(--primary)]/15 border-[var(--primary)]/40 text-[var(--primary)]'
                : 'bg-transparent border-[var(--border)] text-[var(--border)] hover:border-[var(--primary)]/50 hover:text-[var(--primary)] hover:bg-[var(--primary)]/5'
          }`}
        >
          {allActive && <Check size={13} />}
          {someActive && !allActive && <Minus size={13} />}
        </button>
        {tip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[70] bg-[var(--text-primary)] text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap shadow-lg pointer-events-none">
            {tipText}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--text-primary)]" />
          </div>
        )}
      </div>
    </td>
  );
};

const SaveBar = ({ isDirty, saving, onSave, onDiscard }) => {
  if (!isDirty) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-4 bg-[var(--text-primary)] text-white px-5 py-3 rounded-2xl shadow-2xl shadow-black/30">
        <div className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" />
        <p className="text-sm font-medium">Unsaved changes</p>
        <div className="flex items-center gap-2 ml-2">
          <button
            onClick={onDiscard}
            className="px-3 py-1.5 text-xs text-white/70 hover:text-white transition-colors rounded-lg hover:bg-white/10"
          >
            <RotateCcw size={12} className="inline mr-1" />
            Discard
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-1.5 bg-[var(--primary)] text-black text-xs font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {saving ? (
              <div className="w-3 h-3 border-2 border-black/40 border-t-black rounded-full animate-spin" />
            ) : <Save size={12} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const RolesPermissionsPage = () => {
  const navigate = useNavigate();
  const {
    roles, selectedRole, draftPermissions,
    isDirty, loading, saving,
    selectRole, togglePermission, toggleModule,
    savePermissions, discardChanges,
  } = useRolesPermissions();

  const [moduleSearch, setModuleSearch] = useState('');

  const isWildcard   = draftPermissions.includes('*');
  const grantedCount = isWildcard ? '∞' : draftPermissions.length;
  const query        = moduleSearch.toLowerCase().trim();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-[var(--text-muted)]">
        <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading roles &amp; permissions…</p>
      </div>
    );
  }

  const renderRow = (mod) => {
    const Icon        = MODULE_ICONS[mod.key] || Shield;
    const modulePerms = mod.actions.map((a) => `${mod.key}.${a}`);
    const allActive   = isWildcard || modulePerms.every((p) => draftPermissions.includes(p));
    const someActive  = !allActive && modulePerms.some((p) => draftPermissions.includes(p));
    const anyActive   = isWildcard || someActive || allActive;

    return (
      <tr
        key={mod.key}
        className={`border-b border-[var(--border)] last:border-0 transition-colors ${
          anyActive ? 'bg-[var(--primary)]/[0.03]' : 'hover:bg-[var(--bg)]/50'
        }`}
      >
        <td className="sticky left-0 z-10 py-2.5 pl-4 pr-3 border-r border-[var(--border)] bg-[var(--surface)]" style={{ minWidth: '180px' }}>
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              anyActive ? 'bg-[var(--primary)]/12 text-[var(--primary)]' : 'bg-[var(--bg)] text-[var(--text-muted)]'
            }`}>
              <Icon size={14} />
            </div>
            <span className={`text-sm font-medium whitespace-nowrap ${
              anyActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
            }`}>
              {mod.label}
            </span>
          </div>
        </td>

        {ALL_ACTIONS.map((action) => {
          const perm        = `${mod.key}.${action}`;
          const isSupported = mod.actions.includes(action);
          return (
            <PermCell
              key={action}
              action={action}
              active={draftPermissions.includes(perm)}
              isWildcard={isWildcard}
              isSupported={isSupported}
              onChange={() => isSupported && togglePermission(perm)}
            />
          );
        })}

        <RowAllToggle
          allActive={allActive}
          someActive={someActive}
          isWildcard={isWildcard}
          onChange={() => toggleModule(mod.key, mod.actions)}
        />
      </tr>
    );
  };

  const renderGroupHeader = (label) => (
    <tr key={`gh-${label}`} className="bg-[var(--bg)]">
      <td colSpan={ALL_ACTIONS.length + 2} className="px-4 pt-4 pb-1.5">
        <div className="flex items-center gap-2">
          <Layers size={10} className="text-[var(--text-muted)] shrink-0" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>
      </td>
    </tr>
  );

  const searchResults  = query ? PERMISSION_MODULES.filter((m) => m.label.toLowerCase().includes(query)) : null;
  const groupedModules = MODULE_GROUPS.map((g) => ({
    ...g,
    modules: g.keys.map((k) => PERMISSION_MODULES.find((m) => m.key === k)).filter(Boolean),
  }));

  return (
    <>
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-xl hover:bg-[var(--bg)] transition-colors text-[var(--text-muted)]"
          title="Back to Settings"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Roles &amp; Permissions</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Control exactly what each role can see and do in the system.
          </p>
        </div>
      </div>

      {/* ── Two-column layout ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[256px_1fr] gap-4 pb-24">

        {/* Left: Role list */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm self-start lg:sticky lg:top-4">
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              {roles.length} Roles
            </p>
          </div>
          <div className="p-2 space-y-0.5 max-h-[calc(100vh-220px)] overflow-y-auto custom-scrollbar">
            {roles.map((role) => (
              <RoleCard
                key={role._id}
                role={role}
                isSelected={selectedRole?._id === role._id}
                onClick={() => selectRole(role)}
              />
            ))}
          </div>
        </div>

        {/* Right: Permission matrix or empty state */}
        {selectedRole ? (
          <div className="space-y-3 min-w-0">

            {/* Role info strip */}
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 shadow-sm">
              <div className="flex items-center gap-4 flex-wrap">
                {(() => {
                  const meta  = ROLE_OPTIONS.find((r) => r.value === selectedRole.name);
                  const color = meta?.color || selectedRole.color || '#6B6B6B';
                  return (
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-sm shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {selectedRole.displayName.charAt(0)}
                    </div>
                  );
                })()}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-[var(--text-primary)] text-base">{selectedRole.displayName}</h3>
                    {selectedRole.isSystem && (
                      <span className="px-2 py-0.5 bg-[var(--bg)] border border-[var(--border)] rounded-full text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wide">
                        System
                      </span>
                    )}
                    {isDirty && (
                      <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-xs text-amber-600 font-medium">
                        Unsaved
                      </span>
                    )}
                  </div>
                  {selectedRole.description && (
                    <p className="text-sm text-[var(--text-muted)] mt-0.5">{selectedRole.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-black text-[var(--primary)]">{grantedCount}</p>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">permissions</p>
                </div>
              </div>
            </div>

            {/* Wildcard banner */}
            {isWildcard && (
              <div className="flex items-center gap-3 px-4 py-3 bg-[var(--primary)]/10 border border-[var(--primary)]/30 rounded-2xl">
                <div className="w-8 h-8 rounded-xl bg-[var(--primary)] flex items-center justify-center shrink-0">
                  <Zap size={15} className="text-black" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">Wildcard Access Enabled</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    This role has unrestricted access to all current and future modules.
                  </p>
                </div>
              </div>
            )}

            {/* Matrix card */}
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">

              {/* Toolbar */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg)]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  Permission Matrix
                  <span className="font-normal normal-case tracking-normal ml-1.5 hidden sm:inline">
                    — Click an icon to toggle access
                  </span>
                </p>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl w-44">
                  <Search size={13} className="text-[var(--text-muted)] shrink-0" />
                  <input
                    type="text"
                    value={moduleSearch}
                    onChange={(e) => setModuleSearch(e.target.value)}
                    placeholder="Filter modules…"
                    className="bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none w-full"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-[var(--border)]">
                      <th
                        className="sticky left-0 z-20 bg-[var(--bg)] text-left py-3 pl-4 pr-3 border-r border-[var(--border)]"
                        style={{ minWidth: '180px' }}
                      >
                        <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Module</span>
                      </th>
                      {ALL_ACTIONS.map((action) => (
                        <ActionHeader key={action} action={action} />
                      ))}
                      <th className="py-3 w-14 border-l border-[var(--border)]">
                        <div className="flex flex-col items-center gap-1.5">
                          <Zap size={14} className="text-[var(--primary)]" />
                          <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--primary)]">All</span>
                        </div>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {searchResults && (
                      searchResults.length === 0 ? (
                        <tr>
                          <td colSpan={ALL_ACTIONS.length + 2} className="text-center py-10 text-sm text-[var(--text-muted)]">
                            No modules match &ldquo;{moduleSearch}&rdquo;
                          </td>
                        </tr>
                      ) : searchResults.map(renderRow)
                    )}
                    {!searchResults && groupedModules.map((group) =>
                      group.modules.length === 0 ? null : (
                        <React.Fragment key={group.label}>
                          {renderGroupHeader(group.label)}
                          {group.modules.map(renderRow)}
                        </React.Fragment>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg)] flex items-center gap-5 flex-wrap">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Legend</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-lg bg-[var(--primary)] flex items-center justify-center">
                    <Eye size={11} className="text-black" />
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]">Granted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-lg border border-[var(--border)] flex items-center justify-center">
                    <Eye size={11} className="text-[var(--border)]" />
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]">Not granted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[var(--border)] text-sm font-bold">—</span>
                  <span className="text-xs text-[var(--text-secondary)]">Not applicable</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-lg bg-[var(--primary)]/20 border border-[var(--primary)]/40 flex items-center justify-center">
                    <Eye size={11} className="text-[var(--primary)]" />
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]">Auto-granted (wildcard)</span>
                </div>
              </div>
            </div>
          </div>

        ) : (
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-16 flex flex-col items-center justify-center text-center shadow-sm">
            <div className="w-14 h-14 bg-[var(--bg)] rounded-2xl flex items-center justify-center mb-4">
              <Shield size={28} className="text-[var(--text-muted)]" />
            </div>
            <p className="font-bold text-[var(--text-primary)] mb-1">Select a Role</p>
            <p className="text-sm text-[var(--text-muted)] max-w-xs">
              Choose a role from the left panel to view and edit its permissions.
            </p>
          </div>
        )}
      </div>

      <SaveBar
        isDirty={isDirty}
        saving={saving}
        onSave={savePermissions}
        onDiscard={discardChanges}
      />
    </>
  );
};

export default RolesPermissionsPage;
