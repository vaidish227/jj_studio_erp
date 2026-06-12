import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Shield, Plus, Trash2, ChevronLeft, ChevronRight, Zap,
  Search, Copy, AlertTriangle, X, KeyRound, MoreHorizontal, Check,
} from 'lucide-react';
import { useRolesPermissions } from '../hooks/useRolesPermissions';
import { ROLE_OPTIONS } from '../../../shared/constants/permissions';
import { settingsService } from '../../../shared/services/settingsService';
import { roleCoverage, flattenCatalogue } from '../components/permissionUtils';

// ─── Role box (grid card) ─────────────────────────────────────────────────────
const RoleBox = ({ role, registry, onOpen, onClone, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const meta       = ROLE_OPTIONS.find((r) => r.value === role.name);
  const color      = meta?.color || role.color || '#6B6B6B';
  const isWildcard = role.permissions.includes('*');
  const cov        = roleCoverage(role.permissions, registry);

  return (
    <div className="relative group h-full">
      <button
        type="button"
        onClick={onOpen}
        className="w-full h-full flex flex-col text-left rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[var(--primary)]/45 hover:shadow-[0_2px_6px_rgba(42,32,23,.06),0_18px_40px_rgba(42,32,23,.11)]"
      >
        {/* top accent */}
        <span className="absolute left-5 right-5 top-0 h-[3px] rounded-b-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: color }} />

        <div className="flex items-start gap-3.5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-black shrink-0"
            style={{ backgroundColor: color, boxShadow: `0 6px 16px ${color}40` }}
          >
            {role.displayName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <p className="text-[15px] font-bold text-[var(--text-primary)] leading-tight truncate">{role.displayName}</p>
            {role.isSystem
              ? <span className="inline-block mt-1.5 px-2 py-0.5 bg-[var(--bg)] border border-[var(--border)] rounded-full text-[9.5px] text-[var(--text-muted)] font-bold uppercase tracking-wide">System</span>
              : <span className="inline-block mt-1.5 px-2 py-0.5 bg-[var(--primary)]/10 border border-[var(--primary)]/25 rounded-full text-[9.5px] text-[var(--primary)] font-bold uppercase tracking-wide">Custom</span>}
          </div>
        </div>

        <p className="text-[12.5px] text-[var(--text-muted)] leading-snug mt-3.5 line-clamp-2 min-h-[34px]">
          {role.description || 'No description provided for this role.'}
        </p>

        <div className="mt-auto pt-4">
          {isWildcard ? (
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/25 text-[var(--primary)] text-[11.5px] font-bold">
                <Zap size={12} />Full access
              </span>
              <ChevronRight size={16} className="text-[var(--text-muted)] group-hover:text-[var(--primary)] group-hover:translate-x-0.5 transition-all" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-[11.5px] mb-1.5">
                <span className="font-bold text-[var(--text-secondary)] tabular-nums">
                  {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="font-bold text-[var(--primary)] tabular-nums">{cov.pct}%</span>
                  <ChevronRight size={15} className="text-[var(--text-muted)] group-hover:text-[var(--primary)] group-hover:translate-x-0.5 transition-all" />
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--primary)] transition-all duration-300" style={{ width: `${cov.pct}%` }} />
              </div>
            </>
          )}
        </div>
      </button>

      {/* Context menu */}
      <div className={`absolute right-3 top-3 transition-opacity ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((p) => !p); }}
          className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--primary)]/40 text-[var(--text-muted)] shadow-sm"
        >
          <MoreHorizontal size={14} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
            <div className="absolute right-0 top-9 z-50 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl min-w-[140px] overflow-hidden py-1">
              <button type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onClone(role); }} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-[var(--bg)] text-[var(--text-primary)]">
                <Copy size={13} className="text-[var(--text-muted)]" />Clone role
              </button>
              {!role.isSystem && (
                <button type="button" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(role); }} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-[var(--error)]/5 text-[var(--error)]">
                  <Trash2 size={13} />Delete role
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── User box (override grid card) ────────────────────────────────────────────
const UserBox = ({ user, onOpen }) => {
  const meta      = ROLE_OPTIONS.find((r) => r.value === user.role);
  const color     = meta?.color || '#6B6B6B';
  const customN   = user.customPermissions?.length || 0;
  const inactive  = user.isActive === false;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group/u w-full h-full flex flex-col text-left rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[var(--primary)]/45 hover:shadow-[0_2px_6px_rgba(42,32,23,.06),0_18px_40px_rgba(42,32,23,.11)] ${inactive ? 'opacity-55' : ''}`}
    >
      <div className="flex items-center gap-3.5">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-black shrink-0"
          style={{ backgroundColor: color, boxShadow: `0 6px 16px ${color}40` }}
        >
          {user.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-[var(--text-primary)] leading-tight truncate">{user.name}</p>
          <p className="text-[12px] text-[var(--text-muted)] truncate mt-0.5">{meta?.label || user.role}</p>
        </div>
        <ChevronRight size={16} className="text-[var(--text-muted)] group-hover/u:text-[var(--primary)] group-hover/u:translate-x-0.5 transition-all shrink-0" />
      </div>

      <div className="mt-auto pt-4 flex items-center justify-between gap-2">
        <span className="text-[11.5px] text-[var(--text-muted)] truncate">{user.email}</span>
        {customN > 0 ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--warning)]/12 border border-[var(--warning)]/30 text-[var(--warning)] text-[10.5px] font-bold shrink-0">
            <KeyRound size={10} />{customN} custom
          </span>
        ) : (
          <span className="text-[10.5px] text-[var(--text-muted)] font-semibold shrink-0">Role defaults</span>
        )}
      </div>
    </button>
  );
};

// ─── New role box ─────────────────────────────────────────────────────────────
const NewRoleBox = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group/n w-full h-full min-h-[164px] flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border)] text-[var(--text-muted)] p-5 transition-all duration-200 hover:border-[var(--primary)]/55 hover:text-[var(--primary)] hover:bg-[var(--primary)]/[0.04]"
  >
    <div className="w-12 h-12 rounded-2xl bg-[var(--bg)] flex items-center justify-center group-hover/n:bg-[var(--primary)]/12 transition-colors">
      <Plus size={22} />
    </div>
    <div className="text-center">
      <p className="font-bold text-[14px] text-[var(--text-secondary)] group-hover/n:text-[var(--primary)]">New Role</p>
      <p className="text-[11.5px] mt-0.5 max-w-[180px]">Create a custom role from scratch or a template</p>
    </div>
  </button>
);

// ─── Create / Clone modal ─────────────────────────────────────────────────────
// Mounted only while open (and keyed by clone source), so field state is seeded
// from props at mount — no syncing effect needed.
const CreateRoleModal = ({ onClose, cloneSource, onSubmit, isBusy, presets = [] }) => {
  const [name,        setName]        = useState('');
  const [displayName, setDisplayName] = useState(cloneSource ? `${cloneSource.displayName} (Copy)` : '');
  const [description, setDescription] = useState(cloneSource?.description || '');
  const [color,       setColor]       = useState(cloneSource?.color || '#6B6B6B');
  const [errors,      setErrors]      = useState({});
  const [picked,      setPicked]      = useState([]);

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

// ─── KPI chip ─────────────────────────────────────────────────────────────────
const Kpi = ({ value, label, tone = 'default' }) => {
  const color = tone === 'gold' ? 'text-[var(--primary)]' : tone === 'teal' ? 'text-[var(--accent-teal)]' : 'text-[var(--text-primary)]';
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 shadow-sm text-right min-w-[92px]">
      <p className={`text-[20px] font-black leading-none tabular-nums ${color}`}>{value}</p>
      <p className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] mt-1.5">{label}</p>
    </div>
  );
};

// ─── Main page (index) ────────────────────────────────────────────────────────
const RolesPermissionsPage = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const mode = params.get('tab') === 'overrides' ? 'overrides' : 'roles';
  const setMode = (m) => setParams(m === 'overrides' ? { tab: 'overrides' } : {}, { replace: true });

  const {
    roles, loading, registry,
    presets,
    createModalOpen, setCreateModalOpen,
    cloneTarget,     setCloneTarget,
    deleteTarget,    setDeleteTarget,
    roleActionBusy,
    handleCreateRole, handleDeleteRole,
  } = useRolesPermissions();

  const [users,       setUsers]       = useState([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [roleSearch,  setRoleSearch]  = useState('');
  const [userSearch,  setUserSearch]  = useState('');

  // Lazy-load users the first time the Overrides tab is opened. setState only
  // happens inside async callbacks, so there's no synchronous effect render.
  useEffect(() => {
    if (mode !== 'overrides' || usersLoaded) return;
    let active = true;
    settingsService.getUsers()
      .then((res) => { if (active) setUsers(res.data || []); })
      .catch(() => {})
      .finally(() => { if (active) setUsersLoaded(true); });
    return () => { active = false; };
  }, [mode, usersLoaded]);

  const loadingUsers = mode === 'overrides' && !usersLoaded;

  const totalPerms = useMemo(() => flattenCatalogue(registry).size, [registry]);

  const filteredRoles = useMemo(() => {
    const q = roleSearch.toLowerCase().trim();
    if (!q) return roles;
    return roles.filter((r) =>
      r.displayName?.toLowerCase().includes(q) ||
      r.name?.toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q));
  }, [roles, roleSearch]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [users, userSearch]);

  const openRole = (role) => navigate(`/settings/roles-permissions/role/${role._id}`);
  const openUser = (user) => navigate(`/settings/roles-permissions/user/${user._id}`);

  const onCreate = async (payload) => {
    const created = await handleCreateRole(payload);
    if (created?._id) navigate(`/settings/roles-permissions/role/${created._id}`);
  };

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
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/settings')} className="w-10 h-10 flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm hover:text-[var(--primary)] text-[var(--text-muted)]" title="Back to settings">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Roles &amp; Permissions</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Control what each role can see and do across the system.</p>
        </div>
        <div className="hidden sm:flex items-center gap-2.5">
          {mode === 'roles'
            ? <Kpi value={roles.length} label="Roles" />
            : <Kpi value={loadingUsers ? '…' : users.length} label="Users" />}
          <Kpi value={totalPerms || '—'} label="Permissions" tone="gold" />
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex items-center gap-1 mb-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-1 w-fit shadow-sm">
        <button
          onClick={() => setMode('roles')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            mode === 'roles' ? 'bg-[var(--primary)] text-black shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Shield size={14} />Role Permissions
        </button>
        <button
          onClick={() => setMode('overrides')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            mode === 'overrides' ? 'bg-[var(--primary)] text-black shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <KeyRound size={14} />User Overrides
        </button>
      </div>

      {/* ══════════════ ROLE PERMISSIONS ══════════════ */}
      {mode === 'roles' && (
        <div className="pb-12">
          <div className="flex items-center gap-3 mb-4 max-w-md">
            <div className="flex items-center gap-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 shadow-sm flex-1 focus-within:border-[var(--primary)]/60 transition-colors">
              <Search size={14} className="text-[var(--text-muted)] shrink-0" />
              <input value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)} placeholder="Search roles…"
                className="bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none w-full" />
              {roleSearch && <button type="button" onClick={() => setRoleSearch('')} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={14} /></button>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredRoles.map((role) => (
              <RoleBox
                key={role._id}
                role={role}
                registry={registry}
                onOpen={() => openRole(role)}
                onClone={(r) => setCloneTarget(r)}
                onDelete={(r) => setDeleteTarget(r)}
              />
            ))}
            {!roleSearch && <NewRoleBox onClick={() => setCreateModalOpen(true)} />}
          </div>

          {roleSearch && filteredRoles.length === 0 && (
            <div className="py-16 text-center">
              <Search size={24} className="text-[var(--border)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-muted)]">No roles match &ldquo;{roleSearch}&rdquo;</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ USER OVERRIDES ══════════════ */}
      {mode === 'overrides' && (
        <div className="pb-12">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 shadow-sm w-full max-w-md focus-within:border-[var(--primary)]/60 transition-colors">
              <Search size={14} className="text-[var(--text-muted)] shrink-0" />
              <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search users by name or email…"
                className="bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none w-full" />
              {userSearch && <button type="button" onClick={() => setUserSearch('')} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={14} /></button>}
            </div>
            <p className="text-[12px] text-[var(--text-muted)]">
              Pick a user to layer individual permissions on top of their role.
            </p>
          </div>

          {loadingUsers ? (
            <div className="py-20 flex justify-center">
              <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 text-center">
              <Search size={24} className="text-[var(--border)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-muted)]">{userSearch ? `No users match “${userSearch}”` : 'No users found'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredUsers.map((user) => (
                <UserBox key={user._id} user={user} onOpen={() => openUser(user)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {(createModalOpen || cloneTarget) && (
        <CreateRoleModal
          key={cloneTarget?._id || 'new'}
          onClose={() => { setCreateModalOpen(false); setCloneTarget(null); }}
          cloneSource={cloneTarget}
          onSubmit={onCreate}
          isBusy={roleActionBusy}
          presets={presets}
        />
      )}
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
