import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

/**
 * MultiPicker — generic searchable, multi-select dropdown.
 * Designed to replace single-select <Select> when the user needs to pick many
 * items (clients, templates, tags, etc) without scrolling a long flat list.
 *
 * Props
 *   items           : array of plain objects
 *   value           : array of selected items (or [] for empty)
 *   onChange        : (selected: T[]) => void
 *   getId           : (item) => string|number      — required, unique key
 *   getLabel        : (item) => string             — primary text
 *   getSubtitle?    : (item) => string             — secondary muted text
 *   getBadge?       : (item) => string             — small chip on the right
 *   searchFields?   : string[]                     — keys to search across (default ['name'])
 *   placeholder?    : string                       — empty trigger text
 *   searchPlaceholder?: string
 *   triggerIcon?    : lucide Icon component
 *   disabled?       : boolean
 *   maxChips?       : number  — how many selected chips to show before "+N more" (default 3)
 *   confirmMode?    : boolean — if true, selections only commit when user clicks "Add N selected"
 *                              (good for "add templates" UX where each pick is heavy).
 *                              Default false = live commit (good for filters).
 *   confirmLabel?   : string  — custom button text for confirm mode (default "Add N selected")
 *   emptyText?      : string  — when items is []
 */

// Approximate popover height including search bar + header strip + list + (optional) confirm footer.
// Used only to decide which way to open — if real height ends up smaller, the menu still fits below.
const POPOVER_MAX_HEIGHT = 360;

const MultiPicker = ({
  items = [],
  value = [],
  onChange,
  getId,
  getLabel,
  getSubtitle,
  getBadge,
  searchFields = ['name'],
  placeholder = 'Select items...',
  searchPlaceholder = 'Search...',
  triggerIcon: TriggerIcon,
  disabled = false,
  maxChips = 3,
  confirmMode = false,
  confirmLabel,
  emptyText = 'No items',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Draft state for confirmMode — what's been ticked inside the open dropdown
  // but not yet committed to the parent's value.
  const [draft, setDraft] = useState(value);
  // 'down' (default) or 'up' — decided each time the popover opens based on
  // available viewport space, so the menu never gets clipped or covers the
  // primary action sitting below the trigger.
  const [dropDirection, setDropDirection] = useState('down');
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);

  // Reset draft to current value every time the popover opens.
  useEffect(() => {
    if (open) setDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Decide drop direction the moment we open. useLayoutEffect so the choice
  // is committed before the popover paints — avoids a flicker.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    if (spaceBelow < POPOVER_MAX_HEIGHT && spaceAbove > spaceBelow) {
      setDropDirection('up');
    } else {
      setDropDirection('down');
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const workingSet = confirmMode ? draft : value;
  const selectedIds = useMemo(() => new Set(workingSet.map(getId)), [workingSet, getId]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((item) =>
      searchFields.some((field) => {
        const v = item[field];
        return v && String(v).toLowerCase().includes(q);
      })
    );
  }, [items, query, searchFields]);

  const toggle = (item) => {
    const id = getId(item);
    const setter = confirmMode ? setDraft : (next) => onChange(next);
    if (selectedIds.has(id)) {
      setter(workingSet.filter((x) => getId(x) !== id));
    } else {
      setter([...workingSet, item]);
    }
  };

  // Select all currently-filtered items (respects the search query) — merges
  // with already-selected items so a select-all on a filter doesn't drop
  // anything that was picked under a previous filter.
  const selectAllFiltered = () => {
    const merged = [...workingSet];
    const ids = new Set(workingSet.map(getId));
    filtered.forEach((item) => {
      if (!ids.has(getId(item))) merged.push(item);
    });
    if (confirmMode) setDraft(merged);
    else onChange(merged);
  };

  const clearAll = () => {
    if (confirmMode) setDraft([]);
    else onChange([]);
  };

  const commit = () => {
    onChange(draft);
    setOpen(false);
    setQuery('');
  };

  const removeChip = (item) => {
    onChange(value.filter((x) => getId(x) !== getId(item)));
  };

  const visibleChips = value.slice(0, maxChips);
  const overflowCount = Math.max(0, value.length - maxChips);

  return (
    <div ref={wrapperRef} className="relative">
      {/* Trigger */}
      <div
        ref={triggerRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[var(--primary)]/50'}
          ${open ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/20 bg-[var(--surface)]' : 'border-[var(--border)] bg-[var(--bg)]'}
        `}
      >
        {TriggerIcon && <TriggerIcon size={15} className="text-[var(--text-muted)] shrink-0" />}
        <span className={`flex-1 ${value.length === 0 ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)] font-semibold'}`}>
          {value.length === 0
            ? placeholder
            : `${value.length} selected`}
        </span>
        <ChevronDown size={14} className={`text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {/* Selected chips below the trigger — capped at ~2 rows so 10 chips don't push the layout around */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 max-h-[60px] overflow-y-auto">
          {visibleChips.map((item) => (
            <span
              key={getId(item)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold"
            >
              {getLabel(item)}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeChip(item); }}
                className="hover:bg-[var(--primary)]/20 rounded-full p-0.5"
                aria-label={`Remove ${getLabel(item)}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
          {overflowCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[var(--bg)] border border-[var(--border)] text-[var(--text-muted)] text-xs font-bold">
              +{overflowCount} more
            </span>
          )}
        </div>
      )}

      {/* Popover — opens above or below depending on viewport space */}
      {open && (
        <div
          className={`absolute z-50 left-0 right-0 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden
            ${dropDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'}
          `}
        >
          {/* Search */}
          <div className="p-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
              <Search size={13} className="text-[var(--text-muted)] shrink-0" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Header strip — live count + select-all/clear toggle. Keeps the user
              oriented when filtering long lists and gives them a one-click way
              to grab everything visible (or wipe their picks). */}
          {items.length > 0 && (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg)]/30">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                {filtered.length} showing · {workingSet.length} selected
              </span>
              {workingSet.length > 0 ? (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[10px] font-black uppercase tracking-wider text-[var(--error)] hover:underline"
                >
                  Clear
                </button>
              ) : (
                filtered.length > 0 && (
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="text-[10px] font-black uppercase tracking-wider text-[var(--primary)] hover:underline"
                  >
                    Select all
                  </button>
                )
              )}
            </div>
          )}

          {/* List */}
          <div className="max-h-64 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">{emptyText}</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">No matches</p>
            ) : (
              filtered.map((item) => {
                const isSelected = selectedIds.has(getId(item));
                return (
                  <button
                    key={getId(item)}
                    type="button"
                    onClick={() => toggle(item)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg)] transition-colors text-left
                      ${isSelected ? 'bg-[var(--primary)]/8' : ''}
                    `}
                  >
                    {/* Checkbox on the LEFT — standard pattern, eyes scan left-to-right */}
                    <div
                      className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-colors shrink-0
                        ${isSelected ? 'border-[var(--primary)] bg-[var(--primary)]' : 'border-[var(--border)] bg-[var(--surface)]'}
                      `}
                    >
                      {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate transition-colors ${isSelected ? 'font-bold text-[var(--text-primary)]' : 'font-semibold text-[var(--text-primary)]'}`}>
                        {getLabel(item)}
                      </p>
                      {getSubtitle && getSubtitle(item) && (
                        <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{getSubtitle(item)}</p>
                      )}
                    </div>

                    {/* Badge — neutral and quiet, info not emphasis */}
                    {getBadge && getBadge(item) && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)] shrink-0">
                        {getBadge(item)}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Confirm footer (only in confirmMode) */}
          {confirmMode && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[var(--border)] bg-[var(--bg)]/40">
              <span className="text-xs text-[var(--text-muted)] font-medium">{draft.length} ticked</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setDraft(value); setOpen(false); setQuery(''); }}
                  className="text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={commit}
                  disabled={draft.length === 0}
                  className="text-xs font-black uppercase tracking-wider bg-[var(--primary)] text-black px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                >
                  {confirmLabel || `Add ${draft.length} selected`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiPicker;
