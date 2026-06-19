import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Lock } from 'lucide-react';

/**
 * sheetCells — shared presentational primitives for the master-sheet grid
 * language. Used by BOTH the per-project Project Planner (ProjectPlannerTab)
 * and the global Master Template editor (WorkflowTemplatesPage) so the two
 * sheets look and feel identical. Keep these dumb/presentational — no API
 * calls, no business rules.
 */

export const StatCard = ({ icon: Icon, label, value, tone = 'default' }) => {
  const colors = {
    default: 'text-[var(--text-primary)]',
    success: 'text-[var(--success)]',
    warning: 'text-[var(--warning)]',
    info:    'text-[var(--accent-blue)]',
    danger:  'text-[var(--error)]',
  };
  return (
    <div className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 min-w-[120px]">
      <Icon size={16} className={colors[tone]} />
      <div>
        <p className={`text-base font-bold leading-none ${colors[tone]}`}>{value}</p>
        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-1">{label}</p>
      </div>
    </div>
  );
};

// Centred card on a black backdrop with header, body, and footer buttons.
export const ModalShell = ({ title, subtitle, onClose, children, footer, wide = false }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
    <div
      onClick={(e) => e.stopPropagation()}
      className={`bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 w-full ${wide ? 'max-w-xl' : 'max-w-md'}`}
    >
      <h3 className="text-sm font-extrabold text-[var(--text-primary)]">{title}</h3>
      {subtitle && <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
      <div className="mt-4">{children}</div>
      {footer && <div className="flex items-center justify-end gap-2 mt-5">{footer}</div>}
    </div>
  </div>
);

export const EditableNumberCell = ({ value, onSave, disabled, min = 0, max = 10000, widthClass = 'w-16', align = '' }) => {
  const [local, setLocal] = useState(value ?? 0);
  useEffect(() => { setLocal(value ?? 0); }, [value]);
  if (disabled) return <span className="text-xs text-[var(--text-muted)]">{value ?? 0}</span>;
  return (
    <input
      type="number"
      min={min} max={max}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const n = Number(local);
        if (!Number.isNaN(n) && n !== Number(value || 0)) onSave(n);
      }}
      className={`${widthClass} ${align} px-1.5 py-0.5 text-xs bg-transparent border border-transparent hover:border-[var(--border)] focus:border-[var(--primary)] rounded text-[var(--text-primary)] focus:outline-none`}
    />
  );
};

export const EditableTextCell = ({ value, onSave, disabled, placeholder, width = 'w-32', autoSize = false }) => {
  const [local, setLocal] = useState(value || '');
  useEffect(() => { setLocal(value || ''); }, [value]);
  if (disabled) return <span className="text-xs text-[var(--text-muted)]">{value || '—'}</span>;
  // Empty-state gets a full dashed border (same affordance as the "Assign…"
  // chip) so the user sees it as a "fillable" cell rather than a label.
  const isEmpty = !local;
  // autoSize — grow the input with its content (plus padding allowance) so
  // values like "Ground Floor" are never clipped by a fixed width class.
  const sizeCh = Math.max(local.length, (placeholder || '').length) + 3;
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== (value || '')) onSave(local); }}
      style={autoSize ? { width: `${sizeCh}ch`, minWidth: '4.5rem', maxWidth: '16rem' } : undefined}
      className={`${autoSize ? '' : width} px-2 py-1 text-xs bg-transparent rounded-md text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:bg-[var(--bg)]
        ${isEmpty
          ? 'border border-dashed border-[var(--text-muted)]/50 placeholder:text-[var(--text-secondary)] hover:border-[var(--primary)]'
          : 'border border-[var(--border)] hover:border-[var(--primary)]'}`}
    />
  );
};

/**
 * EditableDurationCell — number of days. Shows a faded "→ <due>" preview of the
 * implied end date (start + duration) while editing so the user sees the effect
 * before commit. Read-only (rolled up) for parent rows with children.
 */
export const EditableDurationCell = ({ value, startDate, onSave, disabled, previewLabel }) => {
  const [local, setLocal] = useState(value ?? '');
  const [focused, setFocused] = useState(false);
  useEffect(() => { setLocal(value ?? ''); }, [value]);

  // Client-side preview of the implied due date.
  const previewDue = () => {
    if (!startDate || local === '' || Number.isNaN(Number(local))) return null;
    const d = new Date(startDate);
    d.setDate(d.getDate() + Number(local));
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  if (disabled) {
    return <span className="text-xs text-[var(--text-muted)]">{value != null ? `${value}d` : '—'}</span>;
  }

  const preview = focused ? previewDue() : null;
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={365}
        value={local}
        onFocus={() => setFocused(true)}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          setFocused(false);
          const n = Number(local);
          if (local !== '' && !Number.isNaN(n) && n !== Number(value ?? -1)) onSave(n);
        }}
        className="w-12 px-1.5 py-0.5 text-xs bg-transparent border border-transparent hover:border-[var(--border)] focus:border-[var(--primary)] rounded text-[var(--text-primary)] focus:outline-none"
      />
      {preview && (
        <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">→ {previewLabel || preview}</span>
      )}
    </span>
  );
};

/**
 * LockToggleCell — toggles a row's scheduleLocked flag. When locked the row's
 * date/duration cells should be rendered disabled by the parent grid.
 */
export const LockToggleCell = ({ locked, onToggle, disabled }) => (
  <button
    type="button"
    onClick={() => onToggle(!locked)}
    disabled={disabled}
    title={locked ? 'Schedule locked — click to unlock' : 'Lock schedule (excludes from auto-shift)'}
    className={`p-1 rounded transition-colors ${
      locked
        ? 'text-[var(--warning)] hover:bg-[var(--warning)]/10'
        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)]'
    } disabled:opacity-40 disabled:cursor-not-allowed`}
  >
    <Lock size={13} className={locked ? '' : 'opacity-50'} />
  </button>
);

// Inline priority dropdown with colour badge. Always-visible (no edit mode flip).
export const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];
export const PRIORITY_BADGE = {
  low:    'bg-[var(--text-muted)]/15 text-[var(--text-muted)] border-[var(--text-muted)]/30',
  medium: 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border-[var(--accent-blue)]/30',
  high:   'bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/30',
  urgent: 'bg-[var(--error)]/15 text-[var(--error)] border-[var(--error)]/30',
};
export const EditablePriorityCell = ({ value, onSave, disabled }) => {
  const cls = PRIORITY_BADGE[value || 'medium'] || PRIORITY_BADGE.medium;
  if (disabled) {
    return <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cls}`}>{value}</span>;
  }
  return (
    <select
      value={value || 'medium'}
      onChange={(e) => onSave(e.target.value)}
      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border focus:outline-none focus:ring-1 focus:ring-[var(--primary)] ${cls}`}
    >
      {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
};

/**
 * PhaseHeaderRow — the accordion group header used above each phase's task
 * rows. Slot-based so callers can plug in their own name cell (planner uses a
 * click-to-rename control, the template editor a controlled input), meta text
 * and right-aligned actions.
 */
export const PhaseHeaderRow = ({ colSpan, order, collapsed, onToggle, nameSlot, metaSlot, actionsSlot }) => (
  <tr
    className="bg-[var(--primary)]/8 border-b border-[var(--border)] cursor-pointer hover:bg-[var(--primary)]/12"
    onClick={onToggle}
  >
    <td colSpan={colSpan} className="px-3 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
          className="text-[var(--text-secondary)] hover:text-[var(--primary)] -ml-1 p-0.5"
          title={collapsed ? 'Expand phase' : 'Collapse phase'}
          aria-label={collapsed ? 'Expand phase' : 'Collapse phase'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <span className="text-[10px] font-black w-6 h-6 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center shrink-0">
          {order}
        </span>
        {nameSlot}
        {metaSlot}
        <div className="ml-auto flex items-center gap-1.5">{actionsSlot}</div>
      </div>
    </td>
  </tr>
);

// Gold dashed full-width affordance row ("+ Add task to …", "+ Add Phase").
export const AddDashedRow = ({ colSpan, label, icon: Icon = Plus, onClick, disabled }) => (
  <tr>
    <td colSpan={colSpan} className="px-3 py-2">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="w-full px-3 py-2 rounded-lg border border-dashed border-[var(--primary)]/40 text-xs font-bold uppercase tracking-wider text-[var(--primary)] hover:bg-[var(--primary)]/8 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
      >
        <Icon size={13} /> {label}
      </button>
    </td>
  </tr>
);
