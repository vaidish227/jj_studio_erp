import React, { useState, useRef, useEffect } from 'react';
import { Search, X, UserPlus, Phone, AlertCircle, Check, Loader2 } from 'lucide-react';
import { Modal, Button } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import useAssignableUsers from '../hooks/useAssignableUsers';

const ROLE_COLORS = {
  admin:      'bg-[var(--error)]/10 text-[var(--error)]',
  md:         'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]',
  manager:    'bg-[var(--accent-teal)]/10 text-[var(--accent-teal)]',
  designer:   'bg-[var(--primary)]/10 text-[var(--primary)]',
  supervisor: 'bg-[var(--warning)]/10 text-[var(--warning)]',
  sales:      'bg-[var(--accent-green)]/10 text-[var(--accent-green)]',
};

const ROLE_LABELS = {
  admin: 'Admin', md: 'MD', manager: 'Manager',
  designer: 'Designer', supervisor: 'Supervisor', sales: 'Sales',
};

const Avatar = ({ name, size = 'sm' }) => {
  const initials = (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const sz = size === 'sm' ? 'w-8 h-8 text-[11px]' : 'w-9 h-9 text-xs';
  return (
    <div className={`${sz} rounded-full bg-[var(--primary)]/10 flex items-center justify-center font-black text-[var(--primary)] shrink-0`}>
      {initials}
    </div>
  );
};

const PhoneChip = ({ phone }) => {
  if (!phone) return (
    <span className="flex items-center gap-1 text-[10px] text-[var(--warning)] font-medium">
      <AlertCircle size={10} /> No phone
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
      <Phone size={10} /> {phone}
    </span>
  );
};

/**
 * ManageGroupMembersModal
 *
 * Props:
 *   isOpen      — boolean
 *   onClose     — () => void
 *   group       — WhatsAppProjectGroup document (with members[] array)
 *   onAddMember — async (memberData) => void
 *   onRemove    — async (phone) => void
 */
const ManageGroupMembersModal = ({ isOpen, onClose, group, onAddMember, onRemove }) => {
  const { success, error: toastError, warning } = useToast();
  const { users, isLoading: usersLoading }       = useAssignableUsers();
  const [query, setQuery]           = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [removing, setRemoving]     = useState(null);
  const [adding, setAdding]         = useState(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (isOpen) { setQuery(''); setRoleFilter('all'); }
  }, [isOpen]);

  if (!group) return null;

  const currentPhones = new Set((group.members || []).map((m) => m.phone));

  const filtered = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q) ||
      (u.phone || '').includes(q)
    );
  });

  const handleAdd = async (user) => {
    if (!user.phone) {
      warning(`${user.name} has no phone number set. Update their profile first.`);
      return;
    }
    if (currentPhones.has(user.phone)) return;
    setAdding(user._id);
    try {
      await onAddMember({
        userId:     user._id,
        phone:      user.phone,
        name:       user.name,
        role:       user.role,
        memberType: 'team_member',
      });
      success(`${user.name} added to group`);
    } catch (e) {
      toastError(e?.response?.data?.message || e.message || 'Failed to add member');
    } finally {
      setAdding(null);
    }
  };

  const handleRemove = async (member) => {
    setRemoving(member.phone);
    try {
      await onRemove(member.phone);
      success(`${member.name || member.phone} removed from group`);
    } catch (e) {
      toastError(e?.response?.data?.message || e.message || 'Failed to remove member');
    } finally {
      setRemoving(null);
    }
  };

  const uniqueRoles = [...new Set(users.map((u) => u.role))].sort();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Manage Members — ${group.groupName}`}>
      <div className="flex flex-col gap-0 -mt-1" style={{ minHeight: '480px', maxHeight: '70vh' }}>

        {/* ── Current Members ── */}
        <div className="mb-4">
          <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            Current Members ({group.members?.length || 0})
          </p>
          {(!group.members || group.members.length === 0) ? (
            <p className="text-xs text-[var(--text-muted)] italic py-2">No members yet — add from the team below.</p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
              {group.members.map((m) => (
                <div
                  key={m.phone || m.name}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--border)]"
                >
                  <Avatar name={m.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{m.name || '—'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <PhoneChip phone={m.phone} />
                      {m.role && (
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${ROLE_COLORS[m.role] || 'bg-[var(--border)] text-[var(--text-muted)]'}`}>
                          {ROLE_LABELS[m.role] || m.role}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(m)}
                    disabled={removing === m.phone}
                    className="p-1.5 rounded-lg hover:bg-[var(--error)]/10 text-[var(--text-muted)] hover:text-[var(--error)] transition-colors disabled:opacity-40"
                    title="Remove member"
                  >
                    {removing === m.phone
                      ? <Loader2 size={13} className="animate-spin" />
                      : <X size={13} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--border)] my-2" />

        {/* ── Add from Team ── */}
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Add from Team</p>

          {/* Search + filter row */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)]">
              <Search size={13} className="text-[var(--text-muted)] shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, role, phone…"
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              <option value="all">All roles</option>
              {uniqueRoles.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
              ))}
            </select>
          </div>

          {/* User list */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1">
            {usersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-6">No team members found</p>
            ) : (
              filtered.map((user) => {
                const isAdded   = currentPhones.has(user.phone);
                const isAdding  = adding === user._id;
                const noPhone   = !user.phone;

                return (
                  <div
                    key={user._id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors
                      ${isAdded
                        ? 'border-[var(--success)]/30 bg-[var(--success)]/5 opacity-70'
                        : 'border-[var(--border)] bg-[var(--bg)] hover:border-[var(--primary)]/30 hover:bg-[var(--primary)]/5'
                      }`}
                  >
                    <Avatar name={user.name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{user.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <PhoneChip phone={user.phone} />
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${ROLE_COLORS[user.role] || 'bg-[var(--border)] text-[var(--text-muted)]'}`}>
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                      </div>
                    </div>

                    {isAdded ? (
                      <span className="flex items-center gap-1 text-[10px] text-[var(--success)] font-bold shrink-0">
                        <Check size={12} /> Added
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAdd(user)}
                        disabled={isAdding || noPhone}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0
                          ${noPhone
                            ? 'opacity-40 cursor-not-allowed bg-[var(--border)] text-[var(--text-muted)]'
                            : 'bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20'
                          }`}
                        title={noPhone ? 'User has no phone number' : 'Add to group'}
                      >
                        {isAdding
                          ? <Loader2 size={12} className="animate-spin" />
                          : <UserPlus size={12} />}
                        Add
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="pt-3 flex justify-end border-t border-[var(--border)] mt-3">
          <Button variant="ghost" onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
};

export default ManageGroupMembersModal;
