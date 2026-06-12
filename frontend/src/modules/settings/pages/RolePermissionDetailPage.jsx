import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronDown, Zap, Shield } from 'lucide-react';
import { useRolesPermissions } from '../hooks/useRolesPermissions';
import { ROLE_OPTIONS } from '../../../shared/constants/permissions';
import PresetApply from '../components/PresetApply';
import { roleCoverage } from '../components/permissionUtils';
import {
  PermissionMatrix, SaveBar, SearchBar, CoverageRing,
} from '../components/PermissionMatrix';

const RolePermissionDetailPage = () => {
  const navigate     = useNavigate();
  const { roleId }   = useParams();

  const {
    roles, selectedRole, draftPermissions,
    isDirty, loading, saving,
    registry, registryLoading,
    presets, applyPreset,
    selectRole, togglePermissionSet,
    savePermissions, discardChanges,
  } = useRolesPermissions();

  const [permSearch, setPermSearch] = useState('');
  const [expanded,   setExpanded]   = useState({});

  // Select the role named in the URL once roles arrive.
  useEffect(() => {
    if (!roles.length) return;
    const target = roles.find((r) => r._id === roleId);
    if (target && selectedRole?._id !== roleId) selectRole(target);
  }, [roles, roleId]); // eslint-disable-line react-hooks/exhaustive-deps

  const backToList = () => navigate('/settings/roles-permissions');

  // ── Loading / not-found guards ──────────────────────────────────────────────
  if (loading || (!selectedRole && roles.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-[var(--text-muted)]">
        <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading role…</p>
      </div>
    );
  }

  const roleFromList = roles.find((r) => r._id === roleId);
  if (!roleFromList) {
    return (
      <div className="max-w-md mx-auto py-24 text-center">
        <div className="w-14 h-14 bg-[var(--bg)] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Shield size={28} className="text-[var(--text-muted)]" />
        </div>
        <p className="font-bold text-[var(--text-primary)] mb-1">Role not found</p>
        <p className="text-sm text-[var(--text-muted)] mb-5">This role may have been deleted.</p>
        <button onClick={backToList} className="px-4 py-2 rounded-xl bg-[var(--primary)] text-black text-sm font-bold hover:opacity-90">
          Back to roles
        </button>
      </div>
    );
  }

  // While the hook is still aligning selection to the URL, render a loader.
  if (selectedRole?._id !== roleId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-[var(--text-muted)]">
        <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading role…</p>
      </div>
    );
  }

  const meta       = ROLE_OPTIONS.find((r) => r.value === selectedRole.name);
  const color      = meta?.color || selectedRole.color || '#6B6B6B';
  const isWildcard = draftPermissions.includes('*');
  const cov        = roleCoverage(draftPermissions, registry);

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
              <ChevronLeft size={16} />Roles
            </button>
            <span className="text-[var(--border)]">/</span>
            <span className="text-[var(--text-secondary)] font-semibold truncate">{selectedRole.displayName}</span>
          </div>

          <div className="relative bg-[var(--surface)] rounded-2xl border border-[var(--border)] px-5 py-5 shadow-[0_2px_6px_rgba(42,32,23,.06),0_12px_30px_rgba(42,32,23,.07)] overflow-hidden">
            <span className="absolute left-0 top-0 bottom-0 w-[5px]" style={{ backgroundColor: color }} />
            <div className="flex items-center gap-5 flex-wrap">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shrink-0"
                style={{ backgroundColor: color, boxShadow: `0 6px 18px ${color}55` }}
              >
                {selectedRole.displayName.charAt(0)}
              </div>
              <div className="flex-1 min-w-[180px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight">{selectedRole.displayName}</h2>
                  {selectedRole.isSystem
                    ? <span className="px-2 py-0.5 bg-[var(--bg)] border border-[var(--border)] rounded-full text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wide">System</span>
                    : <span className="px-2 py-0.5 bg-[var(--primary)]/10 border border-[var(--primary)]/25 rounded-full text-[10px] text-[var(--primary)] font-bold uppercase tracking-wide">Custom</span>}
                  {isDirty && (
                    <span className="px-2 py-0.5 bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-full text-[11px] text-[var(--warning)] font-semibold">Unsaved</span>
                  )}
                </div>
                {selectedRole.description && (
                  <p className="text-sm text-[var(--text-muted)] mt-1 line-clamp-2 max-w-xl">{selectedRole.description}</p>
                )}
              </div>

              <PresetApply
                presets={presets}
                draftPermissions={draftPermissions}
                isWildcard={isWildcard}
                onApply={applyPreset}
              />

              {/* Coverage ring + legend */}
              <div className="flex items-center gap-4 pl-5 ml-1 border-l border-[var(--border)]">
                <CoverageRing
                  pct={cov.pct}
                  value={isWildcard ? '∞' : cov.granted}
                  label="granted"
                  color={isWildcard ? 'var(--accent-teal)' : 'var(--primary)'}
                />
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[11.5px] text-[var(--text-secondary)]">
                    <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: isWildcard ? 'var(--accent-teal)' : 'var(--primary)' }} />
                    <b className="text-[var(--text-primary)] tabular-nums">{isWildcard ? cov.total : cov.granted}</b> granted
                  </div>
                  <div className="flex items-center gap-2 text-[11.5px] text-[var(--text-secondary)]">
                    <span className="w-2.5 h-2.5 rounded-[3px] bg-[var(--border)] shrink-0" />
                    <b className="text-[var(--text-primary)] tabular-nums">{isWildcard ? 0 : cov.available}</b> available
                  </div>
                  <div className="text-[11.5px] text-[var(--text-muted)]">of <b className="text-[var(--text-secondary)] tabular-nums">{cov.total}</b> total</div>
                </div>
              </div>
            </div>

            {isWildcard && (
              <div className="flex items-center gap-2.5 mt-4 px-3 py-2 rounded-xl bg-[var(--primary)]/8 border border-[var(--primary)]/20">
                <Zap size={13} className="text-[var(--primary)] shrink-0" />
                <p className="text-xs text-[var(--primary)] font-medium">Wildcard — unrestricted access to every module. Individual toggles are locked.</p>
              </div>
            )}
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
              mode="role"
              isWildcard={isWildcard}
              draftPermissions={draftPermissions}
              onToggleAction={togglePermissionSet}
              onToggleSet={togglePermissionSet}
              expanded={expanded}
              onToggleExpand={(k) => setExpanded((p) => ({ ...p, [k]: !p[k] }))}
            />
          )}
        </div>
      </div>

      <SaveBar isDirty={isDirty} saving={saving} onSave={savePermissions} onDiscard={discardChanges} />
    </>
  );
};

export default RolePermissionDetailPage;
