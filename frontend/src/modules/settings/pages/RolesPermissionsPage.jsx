import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Save, RotateCcw, Check, Minus, Plus, Lock,
  Trash2, Settings2, LayoutDashboard, UserCheck, Briefcase, CheckSquare,
  BarChart2, FileText, MessageCircle, DollarSign, Store,
  Globe, UserCog, ChevronLeft, ChevronDown, Zap, Search, Eye,
  Users, FolderOpen, Flag, Package, ShoppingCart,
  Activity, Calendar, Mail, MessageSquare, ThumbsUp, MapPin,
  ClipboardList, MoreHorizontal, Copy, AlertTriangle, X,
  Layers, UserX, KeyRound, Sparkles,
} from 'lucide-react';
import { useRolesPermissions } from '../hooks/useRolesPermissions';
import { ROLE_OPTIONS } from '../../../shared/constants/permissions';
import { settingsService } from '../../../shared/services/settingsService';
import PresetApply from '../components/PresetApply';

// ─── Module icons (keyed by registry module.icon) ─────────────────────────────
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
  mail:            Mail,
  whatsapp:        MessageSquare,
  communication:   Settings2,
  finance:         DollarSign,
  reports:         BarChart2,
  settings:        Settings2,
  users:           UserCog,
  vendor:          Store,
  client_portal:   Globe,
  approvals:       ThumbsUp,
  ai:              Sparkles,
};

// ─── Permission-set helpers ───────────────────────────────────────────────────
const sectionPerms = (sec) => sec.actions.map((act) => act.permission);
const modulePerms  = (mod) => mod.sections.flatMap(sectionPerms);

// Filter a module by a search query, returning a trimmed copy (or null).
const filterModule = (mod, q) => {
  if (!q) return mod;
  const modHit = mod.label.toLowerCase().includes(q) || (mod.description || '').toLowerCase().includes(q);
  if (modHit) return mod;
  const sections = mod.sections
    .map((sec) => {
      const secHit = sec.label.toLowerCase().includes(q);
      if (secHit) return sec;
      const actions = sec.actions.filter(
        (act) => act.label.toLowerCase().includes(q) || act.permission.toLowerCase().includes(q),
      );
      return actions.length ? { ...sec, actions } : null;
    })
    .filter(Boolean);
  return sections.length ? { ...mod, sections } : null;
};

// ─── Role-mode action toggle ──────────────────────────────────────────────────
const ActionToggle = ({ label, active, isWildcard, onClick }) => {
  if (isWildcard) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-[5px] rounded-lg text-[11px] font-semibold border bg-[var(--primary)] text-black border-[var(--primary)] opacity-80 select-none">
        <Zap size={9} />{label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-[5px] rounded-lg text-[11px] font-semibold border transition-all duration-100 ${
        active
          ? 'bg-[var(--accent-teal)] text-white border-[var(--accent-teal)]'
          : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent-teal)]/60 hover:text-[var(--accent-teal)]'
      }`}
    >
      {active ? <Check size={9} /> : <Plus size={9} />}{label}
    </button>
  );
};

// ─── Override-mode action toggle (inherited / custom / ungranted) ─────────────
const OverrideToggle = ({ label, permStr, rolePerms, overrideDraft, onClick }) => {
  const isInherited = rolePerms.includes(permStr) || rolePerms.includes('*');
  const isCustom    = !isInherited && overrideDraft.includes(permStr);

  if (isInherited) {
    return (
      <span
        title="Inherited from role"
        className="inline-flex items-center gap-1 px-2.5 py-[5px] rounded-lg text-[11px] font-semibold border bg-[var(--accent-teal)]/12 text-[var(--accent-teal)] border-[var(--accent-teal)]/30 select-none"
      >
        <Lock size={8} />{label}
      </span>
    );
  }
  if (isCustom) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Custom override — click to remove"
        className="inline-flex items-center gap-1 px-2.5 py-[5px] rounded-lg text-[11px] font-semibold border bg-[var(--warning)]/12 text-[var(--warning)] border-[var(--warning)]/40 hover:bg-[var(--warning)]/20 transition-colors"
      >
        <KeyRound size={8} />{label}<X size={8} className="ml-0.5 opacity-60" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title="Click to add as custom override"
      className="inline-flex items-center gap-1 px-2.5 py-[5px] rounded-lg text-[11px] font-semibold border border-dashed border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--warning)]/50 hover:text-[var(--warning)] transition-colors"
    >
      <Plus size={8} />{label}
    </button>
  );
};

// ─── Module accordion row ─────────────────────────────────────────────────────
const ModuleRow = ({
  mod, expanded, onToggleExpand,
  mode, isWildcard,
  draftPermissions, rolePerms, overrideDraft,
  onToggle, onToggleSet,
}) => {
  const Icon   = MODULE_ICONS[mod.icon] || Shield;
  const accent = mod.color || '#D4B76C';
  const perms  = modulePerms(mod);

  const grantedFor = (list) => {
    if (mode === 'override') {
      return list.filter((p) => rolePerms.includes(p) || rolePerms.includes('*') || overrideDraft.includes(p)).length;
    }
    return isWildcard ? list.length : list.filter((p) => draftPermissions.includes(p)).length;
  };

  const granted   = grantedFor(perms);
  const total     = perms.length;
  const allActive = isWildcard || (total > 0 && granted === total);
  const someActive = !allActive && granted > 0;

  return (
    <div className={`bg-[var(--surface)] border rounded-2xl shadow-sm overflow-hidden transition-colors ${
      granted > 0 ? 'border-[var(--primary)]/30' : 'border-[var(--border)]'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={onToggleExpand} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}1A` }}>
            <Icon size={18} style={{ color: accent }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[var(--text-primary)] leading-tight truncate">{mod.label}</p>
            {mod.description && <p className="text-[11px] text-[var(--text-muted)] truncate">{mod.description}</p>}
          </div>
        </button>

        <span className={`text-[12px] font-bold tabular-nums shrink-0 ${granted > 0 ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
          {isWildcard ? '∞' : granted}<span className="font-normal opacity-50">/{total}</span>
        </span>

        {/* Grant / Revoke all (role mode only) */}
        {mode === 'role' && !isWildcard && onToggleSet && (
          <button
            type="button"
            onClick={() => onToggleSet(perms)}
            title={allActive ? 'Revoke all' : 'Grant all'}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all shrink-0 ${
              allActive
                ? 'bg-[var(--primary)] border-[var(--primary)] text-black'
                : someActive
                  ? 'bg-[var(--primary)]/15 border-[var(--primary)]/40 text-[var(--primary)]'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]/50 hover:text-[var(--primary)]'
            }`}
          >
            {allActive ? <Check size={10} /> : someActive ? <Minus size={10} /> : <Plus size={10} />}
            {allActive ? 'Revoke' : 'Grant all'}
          </button>
        )}

        <button type="button" onClick={onToggleExpand} className="p-1 rounded-lg hover:bg-[var(--bg)] text-[var(--text-muted)] shrink-0">
          <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Sections */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-[var(--border)]">
          {mod.sections.map((sec) => {
            const sPerms = sectionPerms(sec);
            const sGranted = grantedFor(sPerms);
            const sAll = isWildcard || (sPerms.length > 0 && sGranted === sPerms.length);
            return (
              <div key={sec.key} className="pt-2">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{sec.label}</p>
                  <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{isWildcard ? '∞' : sGranted}/{sPerms.length}</span>
                  {sec.description && <span className="text-[10px] text-[var(--text-muted)] truncate hidden sm:inline">· {sec.description}</span>}
                  <div className="flex-1" />
                  {mode === 'role' && !isWildcard && onToggleSet && sPerms.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onToggleSet(sPerms)}
                      className="text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors shrink-0"
                    >
                      {sAll ? 'Revoke all' : 'Grant all'}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {sec.actions.map((act) =>
                    mode === 'override' ? (
                      <OverrideToggle
                        key={act.permission}
                        label={act.label}
                        permStr={act.permission}
                        rolePerms={rolePerms}
                        overrideDraft={overrideDraft}
                        onClick={() => onToggle(act.permission)}
                      />
                    ) : (
                      <ActionToggle
                        key={act.permission}
                        label={act.label}
                        active={isWildcard || draftPermissions.includes(act.permission)}
                        isWildcard={isWildcard}
                        onClick={() => onToggle(act.permission)}
                      />
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Permission matrix (grouped accordion) ────────────────────────────────────
const PermissionMatrix = ({
  registry, query,
  mode, isWildcard,
  draftPermissions = [], rolePerms = [], overrideDraft = [],
  onToggle, onToggleSet,
}) => {
  const q = query.toLowerCase().trim();
  const [expanded, setExpanded] = useState({});

  // Apply search filter
  const filtered = useMemo(
    () => registry.map((m) => filterModule(m, q)).filter(Boolean),
    [registry, q],
  );

  if (filtered.length === 0) {
    return (
      <div className="py-16 text-center bg-[var(--surface)] border border-[var(--border)] rounded-2xl">
        <Search size={24} className="text-[var(--border)] mx-auto mb-3" />
        <p className="text-sm text-[var(--text-muted)]">No permissions match &ldquo;{query}&rdquo;</p>
      </div>
    );
  }

  // Group by module.group, preserving registry order
  const groups = [];
  for (const mod of filtered) {
    let g = groups.find((x) => x.name === mod.group);
    if (!g) { g = { name: mod.group, modules: [] }; groups.push(g); }
    g.modules.push(mod);
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.name}>
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2 px-1">{group.name}</p>
          <div className="space-y-2.5">
            {group.modules.map((mod) => (
              <ModuleRow
                key={mod.key}
                mod={mod}
                expanded={!!q || !!expanded[mod.key]}
                onToggleExpand={() => setExpanded((prev) => ({ ...prev, [mod.key]: !prev[mod.key] }))}
                mode={mode}
                isWildcard={isWildcard}
                draftPermissions={draftPermissions}
                rolePerms={rolePerms}
                overrideDraft={overrideDraft}
                onToggle={onToggle}
                onToggleSet={onToggleSet}
              />
            ))}
          </div>
        </div>
      ))}
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
          <div className="shrink-0 w-2 h-2 rounded-full bg-[var(--warning)]" title={`${user.customPermissions.length} custom permission(s)`} />
        )}
      </div>
    </button>
  );
};

// ─── Create / Clone modal ─────────────────────────────────────────────────────
const CreateRoleModal = ({ isOpen, onClose, cloneSource, onSubmit, isBusy, presets = [] }) => {
  const [name,        setName]        = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [color,       setColor]       = useState('#6B6B6B');
  const [errors,      setErrors]      = useState({});
  const [picked,      setPicked]      = useState([]); // selected preset keys

  React.useEffect(() => {
    if (isOpen) {
      if (cloneSource) {
        setDisplayName(`${cloneSource.displayName} (Copy)`);
        setDescription(cloneSource.description || '');
        setColor(cloneSource.color || '#6B6B6B');
      } else {
        setDisplayName(''); setDescription(''); setColor('#6B6B6B');
      }
      setName(''); setErrors({}); setPicked([]);
    }
  }, [isOpen, cloneSource]);

  if (!isOpen) return null;

  const togglePreset = (key) =>
    setPicked((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

  const seedPermissions = [...new Set(
    presets.filter((p) => picked.includes(p.key)).flatMap((p) => p.permissions || [])
  )];

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!name.trim()) errs.name = 'Required';
    else if (!/^[a-z0-9_]+$/.test(name.trim())) errs.name = 'Lowercase, numbers, underscores only';
    if (!displayName.trim()) errs.displayName = 'Required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSubmit({ name: name.trim(), displayName: displayName.trim(), description, color, cloneFrom: cloneSource?._id, seedPermissions });
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

          {!cloneSource && presets.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                Start from template <span className="text-[var(--text-muted)] font-normal">(optional — combine any)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p) => {
                  const on = picked.includes(p.key);
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => togglePreset(p.key)}
                      title={p.description}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                        on
                          ? 'bg-[var(--primary)] text-black border-[var(--primary)]'
                          : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]/50 hover:text-[var(--primary)]'
                      }`}
                    >
                      {on && <Check size={9} />}{p.label}
                    </button>
                  );
                })}
              </div>
              {seedPermissions.length > 0 && (
                <p className="text-[11px] text-[var(--text-muted)]">
                  Seeds <span className="font-bold text-[var(--primary)]">{seedPermissions.length}</span> permission{seedPermissions.length !== 1 ? 's' : ''} — editable after creation.
                </p>
              )}
            </div>
          )}
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

// ─── Search bar ───────────────────────────────────────────────────────────────
const SearchBar = ({ value, onChange, placeholder }) => (
  <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2 shadow-sm flex-1">
    <Search size={13} className="text-[var(--text-muted)] shrink-0" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none w-full"
    />
    {value && (
      <button type="button" onClick={() => onChange('')} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0"><X size={13} /></button>
    )}
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────
const RolesPermissionsPage = () => {
  const navigate = useNavigate();

  const {
    roles, selectedRole, draftPermissions,
    isDirty, loading, saving,
    registry, registryLoading,
    presets, applyPreset,
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
  const [permSearch,   setPermSearch]   = useState('');
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
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const isWildcard   = draftPermissions.includes('*');
  const grantedCount = isWildcard ? '∞' : draftPermissions.length;

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [users, userSearch]);

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

          {/* Right: Permission matrix */}
          {selectedRole ? (
            <div className="space-y-4 min-w-0">

              {/* Sticky role summary + search */}
              <div className="lg:sticky lg:top-4 z-20 space-y-3 bg-[var(--bg)] pb-1">
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
                          <span className="px-2 py-0.5 bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-full text-[11px] text-[var(--warning)] font-semibold">Unsaved</span>
                        )}
                      </div>
                      {selectedRole.description && (
                        <p className="text-sm text-[var(--text-muted)] mt-0.5 line-clamp-1">{selectedRole.description}</p>
                      )}
                    </div>
                    <PresetApply
                      presets={presets}
                      draftPermissions={draftPermissions}
                      isWildcard={isWildcard}
                      onApply={applyPreset}
                    />
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
                <SearchBar value={permSearch} onChange={setPermSearch} placeholder="Search permissions, sections, or actions…" />
              </div>

              {/* Matrix */}
              {registryLoading ? (
                <div className="py-16 flex justify-center">
                  <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <PermissionMatrix
                  registry={registry}
                  query={permSearch}
                  mode="role"
                  isWildcard={isWildcard}
                  draftPermissions={draftPermissions}
                  onToggle={togglePermission}
                  onToggleSet={togglePermissionSet}
                />
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
                <span className="inline-flex items-center gap-1 px-2 py-[4px] rounded-lg border bg-[var(--accent-teal)]/12 text-[var(--accent-teal)] border-[var(--accent-teal)]/30 font-semibold shrink-0">
                  <Lock size={8} />Inherited
                </span>
                <span className="text-[var(--text-muted)]">from role, locked</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 px-2 py-[4px] rounded-lg border bg-[var(--warning)]/12 text-[var(--warning)] border-[var(--warning)]/40 font-semibold shrink-0">
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

          {/* Right: Override matrix */}
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

              {/* Sticky user summary + search */}
              <div className="lg:sticky lg:top-4 z-20 space-y-3 bg-[var(--bg)] pb-1">
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
                          <span className="px-2 py-0.5 bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-full text-[11px] text-[var(--warning)] font-semibold">Unsaved</span>
                        )}
                      </div>
                      <p className="text-sm text-[var(--text-muted)] line-clamp-1">{overrideUser.email}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-5 text-right">
                      <div>
                        <p className="text-xl font-black text-[var(--accent-teal)] leading-none">{effectivePerms.rolePermissions.length}</p>
                        <p className="text-[9px] uppercase tracking-wide text-[var(--text-muted)]">inherited</p>
                      </div>
                      <div>
                        <p className="text-xl font-black text-[var(--warning)] leading-none">{overrideDraft.length}</p>
                        <p className="text-[9px] uppercase tracking-wide text-[var(--text-muted)]">custom</p>
                      </div>
                    </div>
                  </div>
                </div>
                <SearchBar value={permSearch} onChange={setPermSearch} placeholder="Search permissions, sections, or actions…" />
              </div>

              {/* Matrix */}
              {registryLoading ? (
                <div className="py-16 flex justify-center">
                  <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <PermissionMatrix
                  registry={registry}
                  query={permSearch}
                  mode="override"
                  isWildcard={false}
                  rolePerms={effectivePerms.rolePermissions}
                  overrideDraft={overrideDraft}
                  onToggle={toggleOverridePermission}
                />
              )}
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
        presets={presets}
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
