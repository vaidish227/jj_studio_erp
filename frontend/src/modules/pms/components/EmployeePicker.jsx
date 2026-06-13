import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X, User, Briefcase } from 'lucide-react';
import useAssignableUsers from '../hooks/useAssignableUsers';

const ROLE_LABELS = {
  admin:      'Admin',
  md:         'MD',
  manager:    'Manager',
  designer:   'Designer',
  supervisor: 'Supervisor',
};

const ROLE_COLORS = {
  admin:      'bg-[var(--error)]/10 text-[var(--error)]',
  md:         'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]',
  manager:    'bg-[var(--accent-teal)]/10 text-[var(--accent-teal)]',
  designer:   'bg-[var(--primary)]/10 text-[var(--primary)]',
  supervisor: 'bg-[var(--warning)]/10 text-[var(--warning)]',
};

const WorkloadDot = ({ count }) => {
  if (count === 0) return <span className="text-[10px] text-[var(--success)] font-bold">Free</span>;
  if (count <= 3)  return <span className="text-[10px] text-[var(--accent-blue)] font-bold">{count} tasks</span>;
  if (count <= 6)  return <span className="text-[10px] text-[var(--warning)] font-bold">{count} tasks</span>;
  return <span className="text-[10px] text-[var(--error)] font-bold">{count} tasks</span>;
};

const Avatar = ({ name, size = 'sm' }) => {
  const initials = (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const sz = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-8 h-8 text-xs';
  return (
    <div className={`${sz} rounded-full bg-[var(--primary)]/10 flex items-center justify-center font-black text-[var(--primary)] shrink-0`}>
      {initials}
    </div>
  );
};

/**
 * EmployeePicker — searchable employee selector with workload indicator.
 *
 * Props:
 *   value        — single mode: User | null. Multi mode: User[].
 *   onChange     — single: (user|null) => void. Multi: (User[]) => void.
 *   multi        — boolean. When true, selected users render as chips.
 *   placeholder  — string (optional)
 *   filterRoles  — string[] to restrict visible roles (optional)
 *   disabled     — boolean
 */
const EmployeePicker = ({
  value,
  onChange,
  multi = false,
  placeholder = 'Select employee...',
  filterRoles,
  disabled = false,
}) => {
  const { users, isLoading } = useAssignableUsers();
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef        = useRef(null);

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

  const filtered = users.filter((u) => {
    if (filterRoles && filterRoles.length && !filterRoles.includes(u.role)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  const selectedArr = multi ? (Array.isArray(value) ? value : []) : [];
  const isSelected = (user) =>
    multi
      ? selectedArr.some((u) => String(u._id) === String(user._id))
      : value?._id === user._id;

  const handleSelect = (user) => {
    if (multi) {
      if (isSelected(user)) {
        onChange(selectedArr.filter((u) => String(u._id) !== String(user._id)));
      } else {
        onChange([...selectedArr, user]);
      }
      setQuery('');
      // Keep dropdown open in multi mode so the user can pick more
    } else {
      onChange(user);
      setOpen(false);
      setQuery('');
    }
  };

  const handleRemoveChip = (e, user) => {
    e.stopPropagation();
    onChange(selectedArr.filter((u) => String(u._id) !== String(user._id)));
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(multi ? [] : null);
  };

  return (
    <div ref={wrapperRef} className="relative">
      {/* Trigger — div instead of button so child remove buttons stay valid HTML */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) setOpen((o) => !o); }}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed bg-[var(--bg)] border-[var(--border)]' : 'bg-[var(--bg)] border-[var(--border)] hover:border-[var(--primary)]/50 cursor-pointer'}
          ${open ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/20' : ''}
        `}
      >
        {multi ? (
          selectedArr.length > 0 ? (
            <div className="flex-1 flex flex-wrap items-center gap-1.5 min-h-[24px]">
              {selectedArr.map((u) => (
                <span
                  key={u._id}
                  className="inline-flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-full bg-[var(--primary)]/10 text-[11px] font-semibold text-[var(--primary)]"
                >
                  <Avatar name={u.name} />
                  <span className="truncate max-w-[120px]">{u.name}</span>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveChip(e, u)}
                    className="shrink-0 p-0.5 rounded hover:bg-[var(--primary)]/20"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              <ChevronDown size={14} className={`ml-auto text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>
          ) : (
            <>
              <User size={15} className="text-[var(--text-muted)] shrink-0" />
              <span className="flex-1 text-[var(--text-muted)]">{placeholder}</span>
              <ChevronDown size={14} className={`text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
            </>
          )
        ) : value ? (
          <>
            <Avatar name={value.name} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate" title={value.name}>{value.name}</p>
              <p className="text-[10px] text-[var(--text-muted)] truncate">{ROLE_LABELS[value.role] || value.role}</p>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="shrink-0 p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
            >
              <X size={13} />
            </button>
          </>
        ) : (
          <>
            <User size={15} className="text-[var(--text-muted)] shrink-0" />
            <span className="flex-1 text-[var(--text-muted)]">{placeholder}</span>
            <ChevronDown size={14} className={`text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 min-w-[300px] bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
              <Search size={13} className="text-[var(--text-muted)] shrink-0" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or role..."
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-56 overflow-y-auto">
            {isLoading ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">Loading employees...</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">No employees found</p>
            ) : (
              <>
                {/* Clear option — single mode shows when something selected; multi mode shows when any chips */}
                {((!multi && value) || (multi && selectedArr.length > 0)) && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg)] transition-colors border-b border-[var(--border)]"
                  >
                    <X size={13} /> Clear {multi ? 'all' : 'selection'}
                  </button>
                )}
                {filtered.map((user) => {
                  const selected = isSelected(user);
                  return (
                    <button
                      key={user._id}
                      type="button"
                      onClick={() => handleSelect(user)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg)] transition-colors text-left
                        ${selected ? 'bg-[var(--primary)]/5' : ''}
                      `}
                    >
                      <Avatar name={user.name} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug break-words">{user.name}</p>
                        <p className="text-[10px] text-[var(--text-muted)] truncate" title={user.email}>{user.email}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${ROLE_COLORS[user.role] || 'bg-[var(--border)] text-[var(--text-muted)]'}`}>
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                        <WorkloadDot count={user.activeTasks || 0} />
                      </div>
                      {multi && selected && (
                        <span className="ml-1 text-[var(--primary)] text-xs font-bold">✓</span>
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeePicker;
