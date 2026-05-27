import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Save, RotateCcw, Check, Minus, Plus, Lock,
  Trash2, Settings2, LayoutDashboard, UserCheck, Briefcase, CheckSquare,
  BarChart2, FileText, MessageCircle, DollarSign, Store,
  Globe, UserCog, ChevronLeft, Zap, Search, Eye,
  Users, FolderOpen, PenTool, Flag, Package, ShoppingCart,
  Activity, Calendar, Mail, MessageSquare, ThumbsUp, MapPin,
  ClipboardList, User, MoreHorizontal, Copy, AlertTriangle, X,
  Layers, UserX, KeyRound,
} from 'lucide-react';
import { useRolesPermissions } from '../hooks/useRolesPermissions';
import { PERMISSION_MODULES, ROLE_OPTIONS } from '../../../shared/constants/permissions';
import { settingsService } from '../../../shared/services/settingsService';

// ─── Module icons ─────────────────────────────────────────────────────────────
const MODULE_ICONS = {
  dashboard:       LayoutDashboard,
  crm:             Users,
  kit:             MessageCircle,
  proposal:        FileText,
  clients:         UserCheck,
  projects:        Briefcase,
  tasks:           CheckSquare,
  pms:             Layers,
  milestones:      Flag,
  site_logs:       ClipboardList,
  site_visits:     MapPin,
  materials:       Package,
  purchase_orders: ShoppingCart,
  activity:        Activity,
  calendar:        Calendar,
  drawings:        FolderOpen,
  design:          PenTool,
  designer:        User,
  approvals:       ThumbsUp,
  mail:            Mail,
  whatsapp:        MessageSquare,
  communication:   Settings2,
  finance:         DollarSign,
  reports:         BarChart2,
  settings:        Settings2,
  users:           UserCog,
  vendor:          Store,
  client_portal:   Globe,
};

const ACTION_LABELS = {
  read: 'Read', create: 'Create', update: 'Update', delete: 'Delete',
  approve: 'Approve', export: 'Export', manage: 'Manage',
  submit: 'Submit', upload: 'Upload', release: 'Release',
  reassign: 'Reassign', respond: 'Respond', send: 'Send',
  comment: 'Comment', dashboard: 'Dashboard',
};

const ACTION_COLORS = {
  read:      { on: 'bg-[#4A8F7C] text-white border-[#4A8F7C]',              off: 'border-[var(--border)] text-[var(--text-muted)] hover:border-[#4A8F7C]/50 hover:text-[#4A8F7C]' },
  create:    { on: 'bg-[var(--primary)] text-black border-[var(--primary)]', off: 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]/50 hover:text-[var(--primary)]' },
  update:    { on: 'bg-[#3A6EA5] text-white border-[#3A6EA5]',              off: 'border-[var(--border)] text-[var(--text-muted)] hover:border-[#3A6EA5]/50 hover:text-[#3A6EA5]' },
  delete:    { on: 'bg-[var(--error)] text-white border-[var(--error)]',     off: 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--error)]/50 hover:text-[var(--error)]' },
  approve:   { on: 'bg-[var(--success)] text-white border-[var(--success)]', off: 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--success)]/50 hover:text-[var(--success)]' },
  export:    { on: 'bg-[#4A8F7C] text-white border-[#4A8F7C]',              off: 'border-[var(--border)] text-[var(--text-muted)] hover:border-[#4A8F7C]/50 hover:text-[#4A8F7C]' },
  manage:    { on: 'bg-[var(--warning)] text-black border-[var(--warning)]', off: 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--warning)]/50 hover:text-[var(--warning)]' },
  submit:    { on: 'bg-[#3A6EA5] text-white border-[#3A6EA5]',              off: 'border-[var(--border)] text-[var(--text-muted)] hover:border-[#3A6EA5]/50 hover:text-[#3A6EA5]' },
  upload:    { on: 'bg-[var(--primary)] text-black border-[var(--primary)]', off: 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]/50 hover:text-[var(--primary)]' },
  release:   { on: 'bg-[var(--success)] text-white border-[var(--success)]', off: 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--success)]/50 hover:text-[var(--success)]' },
  reassign:  { on: 'bg-[var(--warning)] text-black border-[var(--warning)]', off: 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--warning)]/50 hover:text-[var(--warning)]' },
  respond:   { on: 'bg-[#4A8F7C] text-white border-[#4A8F7C]',              off: 'border-[var(--border)] text-[var(--text-muted)] hover:border-[#4A8F7C]/50 hover:text-[#4A8F7C]' },
  send:      { on: 'bg-[var(--primary)] text-black border-[var(--primary)]', off: 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]/50 hover:text-[var(--primary)]' },
  comment:   { on: 'bg-[#3A6EA5] text-white border-[#3A6EA5]',              off: 'border-[var(--border)] text-[var(--text-muted)] hover:border-[#3A6EA5]/50 hover:text-[#3A6EA5]' },
  dashboard: { on: 'bg-[var(--primary)] text-black border-[var(--primary)]', off: 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]/50 hover:text-[var(--primary)]' },
};

// Group color accents — shown as a top bar on each module card
const GROUP_COLORS = {
  'Core':               '#6B7280',
  'Sales':              '#D4B76C',
  'Project Management': '#4A8F7C',
  'Design':             '#9B59B6',
  'Site & Operations':  '#E67E22',
  'Communication':      '#3A6EA5',
  'External':           '#7F8C8D',
  'Finance & Reports':  '#27AE60',
  'Administration':     '#D93025',
};

const buildGroups = () => {
  const order = ['Core', 'Sales', 'Project Management', 'Design', 'Site & Operations', 'Communication', 'External', 'Finance & Reports', 'Administration'];
  const map = {};
  PERMISSION_MODULES.forEach((m) => {
    const g = m.group || 'Other';
    if (!map[g]) map[g] = [];
    map[g].push(m);
  });
  const groups = order
    .filter((g) => map[g])
    .map((g) => ({ label: g, modules: map[g], color: GROUP_COLORS[g] || '#6B7280' }));
  const remaining = Object.keys(map).filter((g) => !order.includes(g));
  remaining.forEach((g) => groups.push({ label: g, modules: map[g], color: '#6B7280' }));
  return groups;
};
const MODULE_GROUPS = buildGroups();

// ─── Action chip ──────────────────────────────────────────────────────────────
const Chip = ({ action, active, isWildcard, onChange }) => {
  const label  = ACTION_LABELS[action] || action;
  const colors = ACTION_COLORS[action] || ACTION_COLORS.read;

  if (isWildcard) {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-[5px] rounded-lg text-[11px] font-semibold border select-none ${colors.on} opacity-80`}>
        <Zap size={9} />{label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onChange}
      className={`inline-flex items-center gap-1 px-2.5 py-[5px] rounded-lg text-[11px] font-semibold border transition-all duration-100 ${
        active ? colors.on : colors.off
      }`}
    >
      {active && <Check size={9} />}
      {label}
    </button>
  );
};

// ─── Tab / section chip ───────────────────────────────────────────────────────
const TabChip = ({ label, active, isWildcard, onChange }) => {
  if (isWildcard) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-[4px] rounded-full text-[10px] font-semibold border bg-violet-500/20 text-violet-400 border-violet-500/30 select-none">
        <Eye size={8} />{label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onChange}
      className={`inline-flex items-center gap-1 px-2.5 py-[4px] rounded-full text-[10px] font-semibold border transition-all duration-100 ${
        active
          ? 'bg-violet-500 text-white border-violet-500'
          : 'border-[var(--border)] text-[var(--text-muted)] hover:border-violet-400/60 hover:text-violet-400'
      }`}
    >
      {active && <Eye size={8} />}
      {label}
    </button>
  );
};

// ─── Module card (role permissions mode) ─────────────────────────────────────
const ModuleCard = ({ mod, draftPermissions, isWildcard, togglePermission, togglePermissionSet, groupColor }) => {
  const Icon        = MODULE_ICONS[mod.key] || Shield;
  const actionPerms = mod.actions.map((a) => `${mod.key}.${a}`);
  const tabPerms    = (mod.tabs || []).map((t) => t.permission);
  const allPerms    = [...actionPerms, ...tabPerms];

  const grantedCount = isWildcard ? allPerms.length : allPerms.filter((p) => draftPermissions.includes(p)).length;
  const allActive    = isWildcard || (allPerms.length > 0 && allPerms.every((p) => draftPermissions.includes(p)));
  const someActive   = !allActive && allPerms.some((p) => draftPermissions.includes(p));
  const anyActive    = isWildcard || someActive || allActive;
  const hasActions   = mod.actions.length > 0;
  const hasTabs      = mod.tabs && mod.tabs.length > 0;

  return (
    <div className={`flex flex-col bg-[var(--surface)] rounded-2xl overflow-hidden border transition-all duration-200 ${
      anyActive
        ? 'border-[var(--primary)]/30 shadow-sm'
        : 'border-[var(--border)] hover:shadow-sm hover:border-[var(--border)]/90'
    }`}>

      {/* Colored top accent */}
      <div
        className="h-[3px] w-full shrink-0 transition-all duration-300"
        style={{ backgroundColor: anyActive ? (groupColor || '#D4B76C') : 'var(--border)' }}
      />

      {/* Card header */}
      <div className="px-4 pt-3.5 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
            anyActive ? 'bg-[var(--primary)]/12 text-[var(--primary)]' : 'bg-[var(--bg)] text-[var(--text-muted)]'
          }`}>
            <Icon size={16} />
          </div>
          <div className="min-w-0">
            <p className={`text-[13px] font-bold leading-tight truncate ${anyActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
              {mod.label}
            </p>
            {mod.description && (
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5 leading-snug line-clamp-1">{mod.description}</p>
            )}
          </div>
        </div>

        {/* Count + all-toggle */}
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          {allPerms.length > 0 && !isWildcard && (
            <span className={`text-[11px] font-bold tabular-nums ${anyActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
              {grantedCount}<span className="font-normal opacity-50">/{allPerms.length}</span>
            </span>
          )}
          {isWildcard ? (
            <div className="w-6 h-6 rounded-lg bg-[var(--primary)]/15 flex items-center justify-center">
              <Zap size={11} className="text-[var(--primary)]" />
            </div>
          ) : allPerms.length > 0 ? (
            <button
              type="button"
              onClick={() => togglePermissionSet(allPerms)}
              title={allActive ? 'Revoke all' : someActive ? 'Grant remaining' : 'Grant all'}
              className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                allActive
                  ? 'bg-[var(--primary)] border-[var(--primary)] text-black shadow-sm'
                  : someActive
                    ? 'bg-[var(--primary)]/15 border-[var(--primary)]/40 text-[var(--primary)]'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]/50 hover:text-[var(--primary)]'
              }`}
            >
              {allActive  && <Check size={10} />}
              {someActive && !allActive && <Minus size={10} />}
            </button>
          ) : null}
        </div>
      </div>

      {/* Permission body */}
      {(hasActions || hasTabs) && (
        <div className="px-4 pb-3.5 pt-0 space-y-2 mt-auto">
          <div className="h-px bg-[var(--border)] mb-2.5" />
          {hasActions && (
            <div className="flex flex-wrap gap-1.5">
              {mod.actions.map((action) => (
                <Chip
                  key={action}
                  action={action}
                  active={isWildcard || draftPermissions.includes(`${mod.key}.${action}`)}
                  isWildcard={isWildcard}
                  onChange={() => togglePermission(`${mod.key}.${action}`)}
                />
              ))}
            </div>
          )}
          {hasTabs && (
            <div className="space-y-1.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Sections</p>
              <div className="flex flex-wrap gap-1.5">
                {mod.tabs.map((tab) => (
                  <TabChip
                    key={tab.key}
                    label={tab.label}
                    active={isWildcard || draftPermissions.includes(tab.permission)}
                    isWildcard={isWildcard}
                    onChange={() => togglePermission(tab.permission)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Override module card ─────────────────────────────────────────────────────
const OverrideModuleCard = ({ mod, rolePerms, overrideDraft, toggleOverridePermission, groupColor }) => {
  const Icon        = MODULE_ICONS[mod.key] || Shield;
  const actionPerms = mod.actions.map((a) => `${mod.key}.${a}`);
  const tabPerms    = (mod.tabs || []).map((t) => t.permission);
  const allPerms    = [...actionPerms, ...tabPerms];

  const inheritedCount = allPerms.filter((p) => rolePerms.includes(p)).length;
  const customCount    = allPerms.filter((p) => !rolePerms.includes(p) && overrideDraft.includes(p)).length;
  const anyActive      = inheritedCount > 0 || customCount > 0;

  const hasActions = mod.actions.length > 0;
  const hasTabs    = mod.tabs && mod.tabs.length > 0;
  if (!hasActions && !hasTabs) return null;

  const renderChip = (permStr, label, isTab = false) => {
    const isInherited = rolePerms.includes(permStr);
    const isCustom    = !isInherited && overrideDraft.includes(permStr);
    const shape       = isTab ? 'rounded-full' : 'rounded-lg';

    if (isInherited) {
      return (
        <span
          key={permStr}
          title="Inherited from role"
          className={`inline-flex items-center gap-1 px-2.5 py-[5px] ${shape} text-[11px] font-semibold border bg-[#4A8F7C]/12 text-[#4A8F7C] border-[#4A8F7C]/30 select-none`}
        >
          <Lock size={8} />{label}
        </span>
      );
    }
    if (isCustom) {
      return (
        <button
          key={permStr}
          type="button"
          onClick={() => toggleOverridePermission(permStr)}
          title="Custom override — click to remove"
          className={`inline-flex items-center gap-1 px-2.5 py-[5px] ${shape} text-[11px] font-semibold border bg-amber-500/12 text-amber-600 border-amber-500/40 hover:bg-amber-500/20 transition-colors`}
        >
          <KeyRound size={8} />{label}<X size={8} className="ml-0.5 opacity-60" />
        </button>
      );
    }
    return (
      <button
        key={permStr}
        type="button"
        onClick={() => toggleOverridePermission(permStr)}
        title="Click to add as custom override"
        className={`inline-flex items-center gap-1 px-2.5 py-[5px] ${shape} text-[11px] font-semibold border border-dashed border-[var(--border)] text-[var(--text-muted)] hover:border-amber-500/50 hover:text-amber-500 transition-colors`}
      >
        <Plus size={8} />{label}
      </button>
    );
  };

  return (
    <div className={`flex flex-col bg-[var(--surface)] rounded-2xl overflow-hidden border transition-all duration-200 ${
      anyActive ? 'border-[var(--primary)]/20' : 'border-[var(--border)]'
    }`}>
      {/* Top accent */}
      <div
        className="h-[3px] w-full shrink-0 transition-all duration-300"
        style={{ backgroundColor: anyActive ? (groupColor || '#D4B76C') : 'var(--border)' }}
      />

      {/* Header */}
      <div className="px-4 pt-3.5 pb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            anyActive ? 'bg-[var(--primary)]/12 text-[var(--primary)]' : 'bg-[var(--bg)] text-[var(--text-muted)]'
          }`}>
            <Icon size={15} />
          </div>
          <p className={`text-[13px] font-bold truncate ${anyActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
            {mod.label}
          </p>
        </div>
        {anyActive && (
          <div className="flex items-center gap-2 shrink-0 text-[10px] font-semibold">
            {inheritedCount > 0 && <span className="text-[#4A8F7C] flex items-center gap-1"><Lock size={9} />{inheritedCount}</span>}
            {customCount    > 0 && <span className="text-amber-500 flex items-center gap-1"><KeyRound size={9} />{customCount}</span>}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 pb-3.5 pt-0 space-y-2 mt-auto">
        <div className="h-px bg-[var(--border)] mb-2.5" />
        {hasActions && (
          <div className="flex flex-wrap gap-1.5">
            {mod.actions.map((action) => renderChip(`${mod.key}.${action}`, ACTION_LABELS[action] || action, false))}
          </div>
        )}
        {hasTabs && (
          <div className="space-y-1.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Sections</p>
            <div className="flex flex-wrap gap-1.5">
              {mod.tabs.map((tab) => renderChip(tab.permission, tab.label, true))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Role card ────────────────────────────────────────────────────────────────
const RoleCard = ({ role, isSelected, onClick, onClone, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const meta       = ROLE_OPTIONS.find((r) => r.value === role.name);
  const color      = meta?.color || role.color || '#6B6B6B';
  const isWildcard = role.permissions.includes('*');
  const count      = isWildcard ? '∞' : role.permissions.length;

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left rounded-xl transition-all duration-150 ${
          isSelected ? 'bg-[var(--primary)]/8 ring-1 ring-[var(--primary)]/40' : 'hover:bg-[var(--bg)]'
        }`}
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="w-1 h-8 rounded-full shrink-0 transition-opacity" style={{ backgroundColor: color, opacity: isSelected ? 1 : 0.4 }} />
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-sm font-bold" style={{ backgroundColor: color }}>
            {role.displayName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className={`text-sm font-semibold truncate leading-tight ${isSelected ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'}`}>
              {role.displayName}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {isWildcard
                ? <span className="flex items-center gap-1 text-[var(--primary)]"><Zap size={9} />Full access</span>
                : `${count} permission${count !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
      </button>

      <div className={`absolute right-2 top-1/2 -translate-y-1/2 transition-opacity ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((p) => !p); }}
          className="p-1 rounded-md hover:bg-[var(--border)] text-[var(--text-muted)]"
        >
          <MoreHorizontal size={13} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-7 z-50 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl min-w-[130px] overflow-hidden py-1">
              <button type="button" onClick={() => { setMenuOpen(false); onClone(role); }} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-[var(--bg)] text-[var(--text-primary)]">
                <Copy size={12} className="text-[var(--text-muted)]" />Clone
              </button>
              {!role.isSystem && (
                <button type="button" onClick={() => { setMenuOpen(false); onDelete(role); }} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-[var(--error)]/5 text-[var(--error)]">
                  <Trash2 size={12} />Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Override user card ───────────────────────────────────────────────────────
const OverrideUserCard = ({ user, isSelected, onClick }) => {
  const roleMeta  = ROLE_OPTIONS.find((r) => r.value === user.role);
  const color     = roleMeta?.color || '#6B6B6B';
  const hasCustom = user.customPermissions?.length > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl transition-all duration-150 ${
        isSelected ? 'bg-[var(--primary)]/8 ring-1 ring-[var(--primary)]/40' : 'hover:bg-[var(--bg)]'
      } ${user.isActive === false ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-sm font-bold" style={{ backgroundColor: color }}>
          {user.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className={`text-sm font-semibold truncate leading-tight ${isSelected ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]'}`}>
            {user.name}
          </p>
          <p className="text-[11px] text-[var(--text-muted)] truncate">{roleMeta?.label || user.role}</p>
        </div>
        {hasCustom && (
          <div className="shrink-0 w-2 h-2 rounded-full bg-amber-500" title={`${user.customPermissions.length} custom permission(s)`} />
        )}
      </div>
    </button>
  );
};

// ─── Create / Clone modal ─────────────────────────────────────────────────────
const CreateRoleModal = ({ isOpen, onClose, cloneSource, onSubmit, isBusy }) => {
  const [name,        setName]        = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [color,       setColor]       = useState('#6B6B6B');
  const [errors,      setErrors]      = useState({});

  React.useEffect(() => {
    if (isOpen) {
      if (cloneSource) {
        setDisplayName(`${cloneSource.displayName} (Copy)`);
        setDescription(cloneSource.description || '');
        setColor(cloneSource.color || '#6B6B6B');
      } else {
        setDisplayName(''); setDescription(''); setColor('#6B6B6B');
      }
      setName(''); setErrors({});
    }
  }, [isOpen, cloneSource]);

  if (!isOpen) return null;

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!name.trim()) errs.name = 'Required';
    else if (!/^[a-z0-9_]+$/.test(name.trim())) errs.name = 'Lowercase, numbers, underscores only';
    if (!displayName.trim()) errs.displayName = 'Required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSubmit({ name: name.trim(), displayName: displayName.trim(), description, color, cloneFrom: cloneSource?._id });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              {cloneSource ? `Clone "${cloneSource.displayName}"` : 'New Role'}
            </h3>
            {cloneSource && <p className="text-xs text-[var(--text-muted)] mt-0.5">Permissions will be copied</p>}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg)] text-[var(--text-muted)]"><X size={15} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Internal name <span className="text-[var(--text-muted)] font-normal">(used in code)</span></label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')); setErrors((p) => ({ ...p, name: '' })); }}
              placeholder="project_manager"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-[var(--background)] text-[var(--text-primary)] outline-none transition-colors font-mono ${errors.name ? 'border-[var(--error)]' : 'border-[var(--border)] focus:border-[var(--primary)]'}`}
            />
            {errors.name && <p className="text-xs text-[var(--error)]">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Display name</label>
            <input
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); setErrors((p) => ({ ...p, displayName: '' })); }}
              placeholder="Project Manager"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-[var(--background)] text-[var(--text-primary)] outline-none transition-colors ${errors.displayName ? 'border-[var(--error)]' : 'border-[var(--border)] focus:border-[var(--primary)]'}`}
            />
            {errors.displayName && <p className="text-xs text-[var(--error)]">{errors.displayName}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Description <span className="text-[var(--text-muted)] font-normal">(optional)</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this role is responsible for…" rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] focus:border-[var(--primary)] text-sm bg-[var(--background)] text-[var(--text-primary)] outline-none transition-colors resize-none" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Badge colour</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded-lg border border-[var(--border)] cursor-pointer p-0.5 bg-transparent" />
            <code className="text-xs text-[var(--text-muted)]">{color}</code>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
            <button type="button" onClick={onClose} disabled={isBusy} className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">Cancel</button>
            <button type="submit" disabled={isBusy} className="flex items-center gap-2 px-5 py-2 bg-[var(--primary)] text-black text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-60">
              {isBusy && <div className="w-3.5 h-3.5 border-2 border-black/40 border-t-black rounded-full animate-spin" />}
              {cloneSource ? 'Clone Role' : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Delete confirm ───────────────────────────────────────────────────────────
const DeleteRoleConfirm = ({ role, onConfirm, onClose, isBusy }) => {
  if (!role) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--error)]/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-[var(--error)]" />
          </div>
          <div>
            <h3 className="font-bold text-[var(--text-primary)]">Delete &ldquo;{role.displayName}&rdquo;?</h3>
            <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">Permanent. All users assigned this role must be reassigned first.</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} disabled={isBusy} className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">Cancel</button>
          <button type="button" onClick={() => onConfirm(role._id)} disabled={isBusy} className="flex items-center gap-2 px-4 py-2 bg-[var(--error)] text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-60">
            {isBusy && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Floating save bar ────────────────────────────────────────────────────────
const SaveBar = ({ isDirty, saving, onSave, onDiscard, label = 'Unsaved changes' }) => {
  if (!isDirty) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-4 bg-[var(--text-primary)] text-white px-5 py-3 rounded-2xl shadow-2xl shadow-black/30">
        <div className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" />
        <p className="text-sm font-medium">{label}</p>
        <div className="flex items-center gap-2 ml-2">
          <button onClick={onDiscard} className="px-3 py-1.5 text-xs text-white/70 hover:text-white rounded-lg hover:bg-white/10">
            <RotateCcw size={12} className="inline mr-1" />Discard
          </button>
          <button onClick={onSave} disabled={saving} className="flex items-center gap-2 px-4 py-1.5 bg-[var(--primary)] text-black text-xs font-bold rounded-xl hover:opacity-90 disabled:opacity-60">
            {saving ? <div className="w-3 h-3 border-2 border-black/40 border-t-black rounded-full animate-spin" /> : <Save size={12} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Group header ─────────────────────────────────────────────────────────────
const GroupHeader = ({ label, count, color }) => (
  <div className="flex items-center gap-3 mb-3 mt-1">
    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap">{label}</span>
    <div className="flex-1 h-px bg-[var(--border)]" />
    <span className="text-[10px] text-[var(--text-muted)]">{count}</span>
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────
const RolesPermissionsPage = () => {
  const navigate = useNavigate();

  const {
    roles, selectedRole, draftPermissions,
    isDirty, loading, saving,
    selectRole, togglePermission, togglePermissionSet,
    savePermissions, discardChanges,
    createModalOpen, setCreateModalOpen,
    cloneTarget,     setCloneTarget,
    deleteTarget,    setDeleteTarget,
    roleActionBusy,
    handleCreateRole, handleDeleteRole,
    overrideUser, effectivePerms, overrideDraft, overrideDirty,
    loadingOverride, savingOverride,
    loadOverrideUser, clearOverrideUser,
    toggleOverridePermission, saveOverrides, discardOverrides,
  } = useRolesPermissions();

  const [mode,         setMode]         = useState('roles');
  const [moduleSearch, setModuleSearch] = useState('');
  const [users,        setUsers]        = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch,   setUserSearch]   = useState('');

  useEffect(() => {
    if (mode === 'overrides' && users.length === 0) {
      setLoadingUsers(true);
      settingsService.getUsers()
        .then((res) => setUsers(res.data || []))
        .catch(() => {})
        .finally(() => setLoadingUsers(false));
    }
  }, [mode]);

  const isWildcard   = draftPermissions.includes('*');
  const grantedCount = isWildcard ? '∞' : draftPermissions.length;
  const query        = moduleSearch.toLowerCase().trim();

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [users, userSearch]);

  const searchResults = query
    ? PERMISSION_MODULES.filter((m) => m.label.toLowerCase().includes(query) || (m.description || '').toLowerCase().includes(query))
    : null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-[var(--text-muted)]">
        <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading roles &amp; permissions…</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/settings')} className="p-2 rounded-xl hover:bg-[var(--bg)] text-[var(--text-muted)]" title="Back">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Roles &amp; Permissions</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Control what each role can see and do across the system.</p>
        </div>
      </div>

      {/* ── Mode tabs ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-5 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-1 w-fit shadow-sm">
        <button
          onClick={() => setMode('roles')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            mode === 'roles' ? 'bg-[var(--primary)] text-black shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Shield size={14} />Role Permissions
        </button>
        <button
          onClick={() => { setMode('overrides'); clearOverrideUser(); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            mode === 'overrides' ? 'bg-[var(--primary)] text-black shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <KeyRound size={14} />User Overrides
        </button>
      </div>

      {/* ══════════════ ROLE PERMISSIONS ══════════════ */}
      {mode === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5 pb-24">

          {/* Left: Role list */}
          <div className="self-start lg:sticky lg:top-4 space-y-2">
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-[var(--border)] text-[var(--text-muted)] text-sm font-medium hover:border-[var(--primary)]/50 hover:text-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all duration-150"
            >
              <Plus size={14} />New Role
            </button>

            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
              <div className="px-3 py-2.5 border-b border-[var(--border)] bg-[var(--bg)]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{roles.length} Roles</p>
              </div>
              <div className="p-1.5 space-y-0.5 max-h-[calc(100vh-280px)] overflow-y-auto">
                {roles.map((role) => (
                  <RoleCard
                    key={role._id}
                    role={role}
                    isSelected={selectedRole?._id === role._id}
                    onClick={() => selectRole(role)}
                    onClone={(r) => setCloneTarget(r)}
                    onDelete={(r) => setDeleteTarget(r)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right: Permission card grid */}
          {selectedRole ? (
            <div className="space-y-4 min-w-0">

              {/* Role summary */}
              <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] px-5 py-4 shadow-sm">
                <div className="flex items-center gap-4">
                  {(() => {
                    const meta  = ROLE_OPTIONS.find((r) => r.value === selectedRole.name);
                    const color = meta?.color || selectedRole.color || '#6B6B6B';
                    return (
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-sm shrink-0" style={{ backgroundColor: color }}>
                        {selectedRole.displayName.charAt(0)}
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-[var(--text-primary)]">{selectedRole.displayName}</h3>
                      {selectedRole.isSystem && (
                        <span className="px-2 py-0.5 bg-[var(--bg)] border border-[var(--border)] rounded-full text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wide">System</span>
                      )}
                      {isDirty && (
                        <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-[11px] text-amber-600 font-semibold">Unsaved</span>
                      )}
                    </div>
                    {selectedRole.description && (
                      <p className="text-sm text-[var(--text-muted)] mt-0.5">{selectedRole.description}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-2xl font-black text-[var(--primary)] leading-none">{grantedCount}</p>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mt-0.5">permissions</p>
                  </div>
                </div>
                {isWildcard && (
                  <div className="flex items-center gap-2.5 mt-3 px-3 py-2 rounded-xl bg-[var(--primary)]/8 border border-[var(--primary)]/20">
                    <Zap size={13} className="text-[var(--primary)] shrink-0" />
                    <p className="text-xs text-[var(--primary)] font-medium">Wildcard — unrestricted access to all modules.</p>
                  </div>
                )}
              </div>

              {/* Search */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-sm flex-1">
                  <Search size={13} className="text-[var(--text-muted)] shrink-0" />
                  <input
                    type="text"
                    value={moduleSearch}
                    onChange={(e) => setModuleSearch(e.target.value)}
                    placeholder="Search modules…"
                    className="bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none w-full"
                  />
                  {moduleSearch && (
                    <button type="button" onClick={() => setModuleSearch('')} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0"><X size={13} /></button>
                  )}
                </div>
                {/* Legend pills */}
                <div className="hidden xl:flex items-center gap-2 shrink-0 text-[10px]">
                  <span className="flex items-center gap-1 text-[var(--text-muted)]"><span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" />Sections</span>
                  <span className="flex items-center gap-1 text-[var(--text-muted)]"><span className="w-2.5 h-2.5 rounded bg-[#4A8F7C] inline-block" />Actions</span>
                </div>
              </div>

              {/* Card grid — search results */}
              {searchResults && (
                searchResults.length === 0 ? (
                  <div className="py-16 text-center bg-[var(--surface)] border border-[var(--border)] rounded-2xl">
                    <Search size={24} className="text-[var(--border)] mx-auto mb-3" />
                    <p className="text-sm text-[var(--text-muted)]">No modules match &ldquo;{moduleSearch}&rdquo;</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {searchResults.map((mod) => {
                      const group = MODULE_GROUPS.find((g) => g.modules.some((m) => m.key === mod.key));
                      return (
                        <ModuleCard
                          key={mod.key}
                          mod={mod}
                          draftPermissions={draftPermissions}
                          isWildcard={isWildcard}
                          togglePermission={togglePermission}
                          togglePermissionSet={togglePermissionSet}
                          groupColor={group?.color}
                        />
                      );
                    })}
                  </div>
                )
              )}

              {/* Card grid — grouped */}
              {!searchResults && (
                <div className="space-y-5">
                  {MODULE_GROUPS.map((group) =>
                    group.modules.length === 0 ? null : (
                      <div key={group.label}>
                        <GroupHeader label={group.label} count={group.modules.length} color={group.color} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {group.modules.map((mod) => (
                            <ModuleCard
                              key={mod.key}
                              mod={mod}
                              draftPermissions={draftPermissions}
                              isWildcard={isWildcard}
                              togglePermission={togglePermission}
                              togglePermissionSet={togglePermissionSet}
                              groupColor={group.color}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-16 flex flex-col items-center justify-center text-center shadow-sm">
              <div className="w-14 h-14 bg-[var(--bg)] rounded-2xl flex items-center justify-center mb-4">
                <Shield size={28} className="text-[var(--text-muted)]" />
              </div>
              <p className="font-bold text-[var(--text-primary)] mb-1">Select a Role</p>
              <p className="text-sm text-[var(--text-muted)] max-w-xs">Pick a role from the panel to view and configure its permissions.</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ USER OVERRIDES ══════════════ */}
      {mode === 'overrides' && (
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5 pb-24">

          {/* Left: User list */}
          <div className="self-start lg:sticky lg:top-4 space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm">
              <Search size={13} className="text-[var(--text-muted)] shrink-0" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users…"
                className="bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none w-full"
              />
            </div>

            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
              <div className="px-3 py-2.5 border-b border-[var(--border)] bg-[var(--bg)]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  {loadingUsers ? 'Loading…' : `${filteredUsers.length} Users`}
                </p>
              </div>
              <div className="p-1.5 space-y-0.5 max-h-[calc(100vh-320px)] overflow-y-auto">
                {loadingUsers && (
                  <div className="py-8 flex justify-center">
                    <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {!loadingUsers && filteredUsers.length === 0 && (
                  <p className="text-center text-sm text-[var(--text-muted)] py-6">No users found</p>
                )}
                {!loadingUsers && filteredUsers.map((user) => (
                  <OverrideUserCard
                    key={user._id}
                    user={user}
                    isSelected={overrideUser?._id === user._id}
                    onClick={() => loadOverrideUser(user)}
                  />
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Legend</p>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 px-2 py-[4px] rounded-lg border bg-[#4A8F7C]/12 text-[#4A8F7C] border-[#4A8F7C]/30 font-semibold shrink-0">
                  <Lock size={8} />Inherited
                </span>
                <span className="text-[var(--text-muted)]">from role, locked</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 px-2 py-[4px] rounded-lg border bg-amber-500/12 text-amber-600 border-amber-500/40 font-semibold shrink-0">
                  <KeyRound size={8} />Custom
                </span>
                <span className="text-[var(--text-muted)]">override, click to remove</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 px-2 py-[4px] rounded-lg border border-dashed border-[var(--border)] text-[var(--text-muted)] font-semibold shrink-0">
                  <Plus size={8} />Ungranted
                </span>
                <span className="text-[var(--text-muted)]">click to grant</span>
              </div>
            </div>
          </div>

          {/* Right: Override card grid */}
          {!overrideUser ? (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-16 flex flex-col items-center justify-center text-center shadow-sm">
              <div className="w-14 h-14 bg-[var(--bg)] rounded-2xl flex items-center justify-center mb-4">
                <UserX size={28} className="text-[var(--text-muted)]" />
              </div>
              <p className="font-bold text-[var(--text-primary)] mb-1">Select a User</p>
              <p className="text-sm text-[var(--text-muted)] max-w-xs">
                Pick a user to view their effective permissions and configure individual overrides on top of their role.
              </p>
            </div>
          ) : loadingOverride ? (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-16 flex flex-col items-center justify-center text-center shadow-sm">
              <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-[var(--text-muted)]">Loading permissions…</p>
            </div>
          ) : effectivePerms ? (
            <div className="space-y-4 min-w-0">

              {/* User summary */}
              <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] px-5 py-4 shadow-sm">
                <div className="flex items-center gap-4">
                  {(() => {
                    const meta  = ROLE_OPTIONS.find((r) => r.value === overrideUser.role);
                    const color = meta?.color || '#6B6B6B';
                    return (
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg font-bold shrink-0" style={{ backgroundColor: color }}>
                        {overrideUser.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-[var(--text-primary)]">{overrideUser.name}</h3>
                      {overrideDirty && (
                        <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-[11px] text-amber-600 font-semibold">Unsaved</span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">{overrideUser.email}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-5 text-right">
                    <div>
                      <p className="text-xl font-black text-[#4A8F7C] leading-none">{effectivePerms.rolePermissions.length}</p>
                      <p className="text-[9px] uppercase tracking-wide text-[var(--text-muted)]">inherited</p>
                    </div>
                    <div>
                      <p className="text-xl font-black text-amber-500 leading-none">{overrideDraft.length}</p>
                      <p className="text-[9px] uppercase tracking-wide text-[var(--text-muted)]">custom</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Module card grid */}
              <div className="space-y-5">
                {MODULE_GROUPS.map((group) =>
                  group.modules.length === 0 ? null : (
                    <div key={group.label}>
                      <GroupHeader label={group.label} count={group.modules.length} color={group.color} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {group.modules.map((mod) => (
                          <OverrideModuleCard
                            key={mod.key}
                            mod={mod}
                            rolePerms={effectivePerms.rolePermissions}
                            overrideDraft={overrideDraft}
                            toggleOverridePermission={toggleOverridePermission}
                            groupColor={group.color}
                          />
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Save bars ──────────────────────────────────────────────────────── */}
      {mode === 'roles' && (
        <SaveBar isDirty={isDirty} saving={saving} onSave={savePermissions} onDiscard={discardChanges} />
      )}
      {mode === 'overrides' && (
        <SaveBar
          isDirty={overrideDirty}
          saving={savingOverride}
          onSave={saveOverrides}
          onDiscard={discardOverrides}
          label={`Unsaved overrides for ${overrideUser?.name || ''}`}
        />
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <CreateRoleModal
        isOpen={createModalOpen || !!cloneTarget}
        onClose={() => { setCreateModalOpen(false); setCloneTarget(null); }}
        cloneSource={cloneTarget}
        onSubmit={handleCreateRole}
        isBusy={roleActionBusy}
      />
      <DeleteRoleConfirm
        role={deleteTarget}
        onConfirm={handleDeleteRole}
        onClose={() => setDeleteTarget(null)}
        isBusy={roleActionBusy}
      />
    </>
  );
};

export default RolesPermissionsPage;
