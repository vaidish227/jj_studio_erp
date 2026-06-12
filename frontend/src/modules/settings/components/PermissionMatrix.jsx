import { useMemo } from 'react';
import {
  Shield, Save, RotateCcw, Check, Minus, Plus, Lock,
  ChevronDown, Search, KeyRound, X,
} from 'lucide-react';
import {
  MODULE_ICONS, actionPerms, sectionPerms, modulePerms,
  isActionOn, helpFor, filterModule,
} from './permissionUtils';

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI building blocks for the Roles & Permissions editor. These power BOTH
// the role detail page and the user-override detail page, so the permission
// matrix renders identically in either flow. Expand/collapse state is owned by
// the parent page (fully controlled) — this module holds no effects.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Circular coverage indicator ──────────────────────────────────────────────
export const CoverageRing = ({ pct = 0, label, value, size = 78, stroke = 8, color = 'var(--primary)' }) => {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * circ;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray .5s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <b className="text-[19px] font-black leading-none text-[var(--text-primary)] tabular-nums">{value}</b>
        {label && <span className="text-[8.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] mt-0.5">{label}</span>}
      </div>
    </div>
  );
};

// ─── On / off switch ──────────────────────────────────────────────────────────
export const Switch = ({ on, dimmed }) => (
  <span
    aria-hidden
    className={`relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors duration-200 ${
      on ? 'bg-[var(--accent-teal)]' : 'bg-[var(--border)]'
    } ${dimmed ? 'opacity-60' : ''}`}
  >
    <span
      className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transform transition-transform duration-200 ${
        on ? 'translate-x-[20px]' : 'translate-x-[2px]'
      }`}
    />
  </span>
);

// ─── Capability row: name + plain-English description + switch ────────────────
export const ActionRow = ({ label, help, active, locked, badge, onClick }) => {
  const inner = (
    <>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[12.5px] font-bold text-[var(--text-primary)] leading-tight">{label}</span>
          {badge === 'inherited' && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--accent-teal)] bg-[var(--accent-teal)]/12 border border-[var(--accent-teal)]/30 rounded px-1 py-[1px]">
              <Lock size={7} />From role
            </span>
          )}
          {badge === 'custom' && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--warning)] bg-[var(--warning)]/12 border border-[var(--warning)]/30 rounded px-1 py-[1px]">
              <KeyRound size={7} />Custom
            </span>
          )}
        </div>
        <p className="text-[11px] text-[var(--text-muted)] leading-snug mt-0.5 pr-3">{help}</p>
      </div>
      <Switch on={active} dimmed={locked} />
    </>
  );
  if (locked) {
    return (
      <div title="Inherited from the role — can't be changed here"
        className="w-full flex items-center gap-3 py-2.5 px-2.5 rounded-xl select-none">
        {inner}
      </div>
    );
  }
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center gap-3 py-2.5 px-2.5 rounded-xl text-left hover:bg-[var(--bg)] transition-colors">
      {inner}
    </button>
  );
};

// ─── Module accordion row ─────────────────────────────────────────────────────
export const ModuleRow = ({
  mod, expanded, onToggleExpand,
  mode, isWildcard,
  draftPermissions, rolePerms, overrideDraft,
  onToggleAction, onToggleSet,
}) => {
  const Icon   = MODULE_ICONS[mod.icon] || Shield;
  const accent = mod.color || '#C19A45';

  // Is a single permission string held under the current mode?
  const has = (p) => {
    if (isWildcard) return true;
    if (mode === 'override') return rolePerms.includes(p) || rolePerms.includes('*') || overrideDraft.includes(p);
    return draftPermissions.includes(p);
  };

  // Counts are ACTION-based so the number matches the toggles the admin sees.
  const countOn    = (actions) => actions.filter((act) => isActionOn(act, has)).length;
  const allActions = mod.sections.flatMap((s) => s.actions);
  const granted    = countOn(allActions);
  const total      = allActions.length;
  const allActive  = isWildcard || (total > 0 && granted === total);
  const someActive = !allActive && granted > 0;
  const pct        = total > 0 ? (granted / total) * 100 : 0;

  const status = allActive ? 'full' : someActive ? 'part' : 'none';
  const statusCls = {
    full: 'text-[var(--accent-teal)] bg-[var(--accent-teal)]/12 border-[var(--accent-teal)]/30',
    part: 'text-[var(--warning)] bg-[var(--warning)]/12 border-[var(--warning)]/30',
    none: 'text-[var(--text-muted)] bg-[var(--bg)] border-[var(--border)]',
  }[status];
  const statusLabel = { full: 'Full access', part: 'Partial', none: 'No access' }[status];
  const barColor = allActive ? 'var(--accent-teal)' : 'var(--primary)';

  return (
    <div className={`bg-[var(--surface)] border rounded-2xl overflow-hidden transition-all duration-200 ${
      expanded ? 'shadow-[0_2px_6px_rgba(42,32,23,.06),0_12px_30px_rgba(42,32,23,.07)]' : 'shadow-sm'
    } ${granted > 0 ? 'border-[var(--primary)]/30' : 'border-[var(--border)]'}`}>
      {/* Header */}
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        <button type="button" onClick={onToggleExpand} className="flex items-center gap-3.5 flex-1 min-w-0 text-left">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}1A` }}>
            <Icon size={19} style={{ color: accent }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14.5px] font-bold text-[var(--text-primary)] leading-tight truncate">{mod.label}</p>
            {mod.description && <p className="text-[11.5px] text-[var(--text-muted)] truncate mt-0.5">{mod.description}</p>}
          </div>
        </button>

        {/* Coverage cluster */}
        <div className="hidden sm:flex flex-col items-end gap-1.5 shrink-0 w-[128px]">
          <span className={`text-[9.5px] font-extrabold uppercase tracking-wide px-2 py-[3px] rounded-full border ${statusCls}`}>
            {isWildcard ? 'Full access' : statusLabel}
          </span>
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${isWildcard ? 100 : pct}%`, backgroundColor: barColor }} />
            </div>
            <span className={`text-[11px] font-bold tabular-nums ${granted > 0 ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}>
              {isWildcard ? '∞' : granted}<span className="font-normal opacity-50">/{total}</span>
            </span>
          </div>
        </div>

        {/* Grant / Revoke all (role mode only) */}
        {mode === 'role' && !isWildcard && onToggleSet && (
          <button
            type="button"
            onClick={() => onToggleSet(modulePerms(mod))}
            title={allActive ? 'Revoke all' : 'Grant all'}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold border transition-all shrink-0 ${
              allActive
                ? 'bg-[var(--primary)] border-[var(--primary)] text-black'
                : someActive
                  ? 'bg-[var(--primary)]/15 border-[var(--primary)]/40 text-[var(--primary)]'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]/50 hover:text-[var(--primary)]'
            }`}
          >
            {allActive ? <Check size={11} /> : someActive ? <Minus size={11} /> : <Plus size={11} />}
            {allActive ? 'Revoke' : 'Grant all'}
          </button>
        )}

        <button type="button" onClick={onToggleExpand} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg)] text-[var(--text-muted)] shrink-0">
          <ChevronDown size={17} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Sections */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-[var(--border)] bg-[linear-gradient(180deg,rgba(42,32,23,.012),transparent_40px)]">
          {mod.sections.map((sec) => {
            const sGranted = countOn(sec.actions);
            const sTotal   = sec.actions.length;
            const sAll     = isWildcard || (sTotal > 0 && sGranted === sTotal);
            return (
              <div key={sec.key} className="pt-2">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{sec.label}</p>
                  <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{isWildcard ? '∞' : sGranted}/{sTotal}</span>
                  {sec.description && <span className="text-[10px] text-[var(--text-muted)] truncate hidden sm:inline">· {sec.description}</span>}
                  <div className="flex-1" />
                  {mode === 'role' && !isWildcard && onToggleSet && sTotal > 1 && (
                    <button
                      type="button"
                      onClick={() => onToggleSet(sectionPerms(sec))}
                      className="text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors shrink-0"
                    >
                      {sAll ? 'Revoke all' : 'Grant all'}
                    </button>
                  )}
                </div>
                <div className="divide-y divide-[var(--border)]/50">
                  {sec.actions.map((act) => {
                    const perms = actionPerms(act);
                    const help  = helpFor(act, sec.label, mod.label);
                    if (mode === 'override') {
                      const isInherited = perms.every((p) => rolePerms.includes(p) || rolePerms.includes('*'));
                      const isOn = perms.every((p) => rolePerms.includes(p) || rolePerms.includes('*') || overrideDraft.includes(p));
                      return (
                        <ActionRow
                          key={act.key || perms[0]}
                          label={act.label}
                          help={help}
                          active={isOn}
                          locked={isInherited}
                          badge={isInherited ? 'inherited' : (isOn ? 'custom' : null)}
                          onClick={() => onToggleAction(perms)}
                        />
                      );
                    }
                    return (
                      <ActionRow
                        key={act.key || perms[0]}
                        label={act.label}
                        help={help}
                        active={isActionOn(act, has)}
                        locked={isWildcard}
                        onClick={() => onToggleAction(perms)}
                      />
                    );
                  })}
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
// `expanded` (a {moduleKey: bool} map) and `onToggleExpand(key)` are owned by the
// parent page so "Expand all / Collapse all" needs no effect here.
export const PermissionMatrix = ({
  registry, query,
  mode, isWildcard,
  draftPermissions = [], rolePerms = [], overrideDraft = [],
  onToggleAction, onToggleSet,
  expanded = {}, onToggleExpand,
}) => {
  const q = query.toLowerCase().trim();

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
          <div className="flex items-center gap-2.5 mb-2.5 px-1">
            <p className="text-[10.5px] font-black uppercase tracking-widest text-[var(--text-muted)]">{group.name}</p>
            <span className="text-[9.5px] font-bold text-[var(--text-muted)] bg-[var(--bg)] border border-[var(--border)] rounded-full px-2 py-[1px]">
              {group.modules.length} module{group.modules.length !== 1 ? 's' : ''}
            </span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>
          <div className="space-y-2.5">
            {group.modules.map((mod) => (
              <ModuleRow
                key={mod.key}
                mod={mod}
                expanded={!!q || !!expanded[mod.key]}
                onToggleExpand={() => onToggleExpand?.(mod.key)}
                mode={mode}
                isWildcard={isWildcard}
                draftPermissions={draftPermissions}
                rolePerms={rolePerms}
                overrideDraft={overrideDraft}
                onToggleAction={onToggleAction}
                onToggleSet={onToggleSet}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Floating save bar ────────────────────────────────────────────────────────
export const SaveBar = ({ isDirty, saving, onSave, onDiscard, label = 'Unsaved changes' }) => {
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
export const SearchBar = ({ value, onChange, placeholder }) => (
  <div className="flex items-center gap-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-3 shadow-sm flex-1 focus-within:border-[var(--primary)]/60 transition-colors">
    <Search size={15} className="text-[var(--text-muted)] shrink-0" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none w-full"
    />
    {value && (
      <button type="button" onClick={() => onChange('')} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0"><X size={14} /></button>
    )}
  </div>
);
