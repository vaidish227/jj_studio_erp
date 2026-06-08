import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, User } from 'lucide-react';
import useAssignableUsers from '../../../modules/pms/hooks/useAssignableUsers';

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

const Avatar = ({ name }) => {
  const initials = (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="w-7 h-7 rounded-full bg-[var(--primary)]/10 flex items-center justify-center font-black text-[10px] text-[var(--primary)] shrink-0">
      {initials}
    </div>
  );
};

/**
 * MultiEmployeePicker — searchable, multi-select employee picker.
 *
 * Props:
 *   value        — array of selected user objects [{ _id, name, email, phone, role }, ...]
 *   onChange     — (User[]) => void
 *   placeholder  — string (optional)
 *   filterRoles  — string[] to restrict visible roles (optional)
 *   disabled     — boolean
 */
const MultiEmployeePicker = ({
  value = [],
  onChange,
  placeholder = 'Add team members...',
  filterRoles,
  disabled = false,
}) => {
  const { users, isLoading } = useAssignableUsers();
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef        = useRef(null);

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

  const selectedIds = new Set(value.map((u) => u._id));

  const filtered = users.filter((u) => {
    if (filterRoles && !filterRoles.includes(u.role)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return u.name.toLowerCase().includes(q)
      || (u.email || '').toLowerCase().includes(q)
      || (u.role || '').toLowerCase().includes(q);
  });

  const toggle = (user) => {
    if (selectedIds.has(user._id)) {
      onChange(value.filter((u) => u._id !== user._id));
    } else {
      onChange([...value, user]);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen((o) => !o); } }}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed bg-[var(--bg)] border-[var(--border)]' : 'bg-[var(--bg)] border-[var(--border)] hover:border-[var(--primary)]/50 cursor-pointer'}
          ${open ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/20' : ''}
        `}
      >
        <User size={15} className="text-[var(--text-muted)] shrink-0" />
        <span className="flex-1 text-[var(--text-muted)]">
          {value.length === 0 ? placeholder : `${value.length} selected — click to add more`}
        </span>
        <ChevronDown size={14} className={`text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
              <Search size={13} className="text-[var(--text-muted)] shrink-0" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email or role..."
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto">
            {isLoading ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">Loading employees...</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">No employees found</p>
            ) : (
              filtered.map((user) => {
                const isSelected = selectedIds.has(user._id);
                return (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() => toggle(user)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg)] transition-colors text-left
                      ${isSelected ? 'bg-[var(--primary)]/5' : ''}
                    `}
                  >
                    <Avatar name={user.name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{user.name}</p>
                      <p className="text-[10px] text-[var(--text-muted)] truncate">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${ROLE_COLORS[user.role] || 'bg-[var(--border)] text-[var(--text-muted)]'}`}>
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-[var(--primary)] bg-[var(--primary)]' : 'border-[var(--border)]'}`}>
                        {isSelected && <Check size={12} className="text-white" />}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiEmployeePicker;
