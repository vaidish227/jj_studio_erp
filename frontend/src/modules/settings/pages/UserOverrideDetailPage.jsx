import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronDown, Lock, KeyRound, Plus, UserX } from 'lucide-react';
import { useRolesPermissions } from '../hooks/useRolesPermissions';
import { ROLE_OPTIONS } from '../../../shared/constants/permissions';
import { settingsService } from '../../../shared/services/settingsService';
import {
  PermissionMatrix, SaveBar, SearchBar,
} from '../components/PermissionMatrix';

const UserOverrideDetailPage = () => {
  const navigate   = useNavigate();
  const { userId } = useParams();

  const {
    registry, registryLoading,
    effectivePerms, overrideDraft, overrideDirty,
    loadingOverride, savingOverride,
    loadOverrideUser,
    toggleOverridePermission, saveOverrides, discardOverrides,
  } = useRolesPermissions();

  const [user,       setUser]       = useState(null);
  const [notFound,   setNotFound]   = useState(false);
  const [permSearch, setPermSearch] = useState('');
  const [expanded,   setExpanded]   = useState({});

  useEffect(() => {
    let active = true;
    settingsService.getUsers()
      .then((res) => {
        if (!active) return;
        const u = (res.data || []).find((x) => x._id === userId);
        if (u) { setUser(u); loadOverrideUser(u); }
        else setNotFound(true);
      })
      .catch(() => { if (active) setNotFound(true); });
    return () => { active = false; };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const backToList = () => navigate('/settings/roles-permissions?tab=overrides');

  // Toggle a whole action (one or more permission strings) in override mode.
  const toggleOverrideSet = (perms) => {
    const inherited = (p) =>
      effectivePerms?.rolePermissions?.includes(p) || effectivePerms?.rolePermissions?.includes('*');
    const togglable = perms.filter((p) => !inherited(p));
    if (togglable.length === 0) return;
    const allOn = togglable.every((p) => overrideDraft.includes(p));
    togglable.forEach((p) => {
      const on = overrideDraft.includes(p);
      if (allOn && on) toggleOverridePermission(p);
      else if (!allOn && !on) toggleOverridePermission(p);
    });
  };

  if (notFound) {
    return (
      <div className="max-w-md mx-auto py-24 text-center">
        <div className="w-14 h-14 bg-[var(--bg)] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <UserX size={28} className="text-[var(--text-muted)]" />
        </div>
        <p className="font-bold text-[var(--text-primary)] mb-1">User not found</p>
        <p className="text-sm text-[var(--text-muted)] mb-5">This account may have been removed.</p>
        <button onClick={backToList} className="px-4 py-2 rounded-xl bg-[var(--primary)] text-black text-sm font-bold hover:opacity-90">
          Back to users
        </button>
      </div>
    );
  }

  if (!user || loadingOverride || !effectivePerms) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-[var(--text-muted)]">
        <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading permissions…</p>
      </div>
    );
  }

  const meta  = ROLE_OPTIONS.find((r) => r.value === user.role);
  const color = meta?.color || '#6B6B6B';

  const moduleKeys = registry.map((m) => m.key);
  const anyOpen    = moduleKeys.some((k) => expanded[k]);
  const toggleAll  = () => setExpanded(anyOpen ? {} : Object.fromEntries(moduleKeys.map((k) => [k, true])));

  return (
    <>
      <div className="pb-28">
        {/* Pinned top: breadcrumb + hero + toolbar all stay fixed while the matrix
            scrolls. The wrapper's background bleeds over <main>'s padding (negative
            margins + negative top) so no content peeks above or beside it. */}
        <div className="sticky -top-4 sm:-top-6 z-30 bg-[var(--bg)] -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b border-[var(--border)]/70 shadow-[0_10px_18px_-14px_rgba(42,32,23,.30)]">
          {/* Breadcrumb / back */}
          <div className="flex items-center gap-2 mb-3 text-sm">
            <button onClick={backToList} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--surface)] font-medium">
              <ChevronLeft size={16} />User Overrides
            </button>
            <span className="text-[var(--border)]">/</span>
            <span className="text-[var(--text-secondary)] font-semibold truncate">{user.name}</span>
          </div>

          <div className="relative bg-[var(--surface)] rounded-2xl border border-[var(--border)] px-5 py-5 shadow-[0_2px_6px_rgba(42,32,23,.06),0_12px_30px_rgba(42,32,23,.07)] overflow-hidden">
            <span className="absolute left-0 top-0 bottom-0 w-[5px]" style={{ backgroundColor: color }} />
            <div className="flex items-center gap-5 flex-wrap">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shrink-0"
                style={{ backgroundColor: color, boxShadow: `0 6px 18px ${color}55` }}
              >
                {user.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-[180px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight">{user.name}</h2>
                  <span className="px-2 py-0.5 bg-[var(--bg)] border border-[var(--border)] rounded-full text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wide">{meta?.label || user.role}</span>
                  {overrideDirty && (
                    <span className="px-2 py-0.5 bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-full text-[11px] text-[var(--warning)] font-semibold">Unsaved</span>
                  )}
                </div>
                <p className="text-sm text-[var(--text-muted)] mt-1 truncate">{user.email}</p>
              </div>

              <div className="flex items-center gap-5 pl-5 ml-1 border-l border-[var(--border)] text-center">
                <div>
                  <p className="text-2xl font-black text-[var(--accent-teal)] leading-none tabular-nums">{effectivePerms.rolePermissions.length}</p>
                  <p className="text-[9.5px] uppercase tracking-wide text-[var(--text-muted)] mt-1.5 font-bold">Inherited</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-[var(--warning)] leading-none tabular-nums">{overrideDraft.length}</p>
                  <p className="text-[9.5px] uppercase tracking-wide text-[var(--text-muted)] mt-1.5 font-bold">Custom</p>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 pt-4 border-t border-[var(--border)]">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded-lg border bg-[var(--accent-teal)]/12 text-[var(--accent-teal)] border-[var(--accent-teal)]/30 font-semibold">
                  <Lock size={9} />Inherited
                </span>
                <span className="text-[var(--text-muted)]">from role, locked</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded-lg border bg-[var(--warning)]/12 text-[var(--warning)] border-[var(--warning)]/40 font-semibold">
                  <KeyRound size={9} />Custom
                </span>
                <span className="text-[var(--text-muted)]">override, click to remove</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded-lg border border-dashed border-[var(--border)] text-[var(--text-muted)] font-semibold">
                  <Plus size={9} />Ungranted
                </span>
                <span className="text-[var(--text-muted)]">click to grant</span>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3 mt-3">
            <SearchBar value={permSearch} onChange={setPermSearch} placeholder="Search permissions, sections, or actions…" />
            <button
              type="button"
              onClick={toggleAll}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[12.5px] font-bold text-[var(--text-secondary)] shadow-sm hover:border-[var(--primary)]/50 hover:text-[var(--primary)] transition-all shrink-0 whitespace-nowrap"
              title={anyOpen ? 'Collapse all modules' : 'Expand all modules'}
            >
              <ChevronDown size={15} className={`transition-transform ${anyOpen ? 'rotate-180' : ''}`} />
              {anyOpen ? 'Collapse all' : 'Expand all'}
            </button>
          </div>
        </div>

        {/* Matrix */}
        <div className="mt-4">
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
              onToggleAction={toggleOverrideSet}
              expanded={expanded}
              onToggleExpand={(k) => setExpanded((p) => ({ ...p, [k]: !p[k] }))}
            />
          )}
        </div>
      </div>

      <SaveBar
        isDirty={overrideDirty}
        saving={savingOverride}
        onSave={saveOverrides}
        onDiscard={discardOverrides}
        label={`Unsaved overrides for ${user.name}`}
      />
    </>
  );
};

export default UserOverrideDetailPage;
