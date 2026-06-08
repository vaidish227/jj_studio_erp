import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { Check, Plus, Trash2, Users, X } from 'lucide-react';
import { Modal, Button } from '../../../shared/components';
import EmployeePicker from './EmployeePicker';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

const FallbackIcon = LucideIcons.Users;

const ResponsibilityIcon = ({ name, size = 18, className }) => {
  const Comp = (name && LucideIcons[name]) || FallbackIcon;
  return <Comp size={size} strokeWidth={2} className={className} />;
};

// Tiny inline input rendered at the end of a person's chip strip. Click +
// → type a work item name → press Enter to add it for that person. Datalist
// autocompletes from already-saved responsibilities so system slugs still
// route correctly when the user happens to type one of their names.
const AddWorkInline = ({ onAdd, suggestions = [] }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const commit = () => {
    if (text.trim()) onAdd(text);
    setText('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-[var(--border)] text-[11px] font-semibold text-[var(--text-muted)] hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
      >
        <Plus size={11} /> Add work
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-[var(--primary)]/40 bg-[var(--primary)]/5">
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setText(''); setOpen(false); }
        }}
        onBlur={commit}
        list="responsibility-suggestions-person"
        placeholder="Type a work item..."
        className="text-[11px] bg-transparent border-none outline-none w-32 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
      />
      <datalist id="responsibility-suggestions-person">
        {suggestions.map((name) => <option key={name} value={name} />)}
      </datalist>
    </span>
  );
};

const PersonChip = ({ user }) => {
  const initials = (user.name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-9 h-9 rounded-full bg-[var(--primary)]/10 flex items-center justify-center font-black text-xs text-[var(--primary)] shrink-0">
        {initials}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{user.name}</p>
        <p className="text-[10px] text-[var(--text-muted)] truncate capitalize">{user.role || 'team member'}</p>
      </div>
    </div>
  );
};

const ManageTeamModal = ({ isOpen, onClose, project, onSaved }) => {
  const toast = useToast();
  const [responsibilities, setResponsibilities] = useState([]);
  const [loadingResps, setLoadingResps] = useState(false);
  const [rows, setRows] = useState([]); // [{ responsibilityId?, customName?, users: [User] }]
  const [saving, setSaving] = useState(false);

  const [pendingPersons, setPendingPersons] = useState([]); // User[] picked but no chips ticked yet
  const [showAddPersonPicker, setShowAddPersonPicker] = useState(false);

  // Reset transient state whenever the modal closes.
  useEffect(() => {
    if (!isOpen) {
      setPendingPersons([]);
      setShowAddPersonPicker(false);
    }
  }, [isOpen]);

  // Seed both the responsibility list (from already-populated assignments) and
  // rows from the project as soon as the modal opens — guarantees the row
  // labels render even if the master list API call is slow or fails.
  useEffect(() => {
    if (!isOpen || !project) return;
    const populatedResps = [];
    const seen = new Set();
    const seeded = (project.assignments || []).map((a) => {
      const respObj =
        a.responsibilityId && typeof a.responsibilityId === 'object'
          ? a.responsibilityId
          : null;
      const respId = (respObj && respObj._id) || a.responsibilityId || '';
      if (respObj && respObj._id && !seen.has(String(respObj._id))) {
        seen.add(String(respObj._id));
        populatedResps.push(respObj);
      }
      return {
        responsibilityId: respId,
        customName: a.customName || '',
        users: Array.isArray(a.users) ? a.users.filter(Boolean) : [],
      };
    });
    setRows(seeded);
    // Merge — never wipe out the master list that effect-2 may have loaded.
    setResponsibilities((prev) => {
      const byId = new Map(prev.map((r) => [String(r._id), r]));
      for (const r of populatedResps) {
        if (!byId.has(String(r._id))) byId.set(String(r._id), r);
      }
      return Array.from(byId.values());
    });
  }, [isOpen, project]);

  // Fetch the full master list (active rows) so the dropdown can offer
  // unused responsibilities. Toast is intentionally NOT in deps — useToast()
  // returns a fresh object every render, which would loop the effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    let errored = false;
    (async () => {
      setLoadingResps(true);
      try {
        const data = await pmsService.listResponsibilities({ activeOnly: 'true' });
        if (cancelled) return;
        // Merge: keep any already-seeded ones, replace with master copy.
        // apiClient's response interceptor already unwraps response.data, so
        // `data` here is the JSON body directly — destructuring { data } from
        // it would yield undefined and throw on access (was the source of
        // the spurious "Could not refresh responsibilities" toast).
        const master = data?.responsibilities || [];
        setResponsibilities((prev) => {
          const byId = new Map(prev.map((r) => [String(r._id), r]));
          for (const r of master) byId.set(String(r._id), r);
          return Array.from(byId.values());
        });
      } catch (e) {
        errored = true;
      } finally {
        if (!cancelled) setLoadingResps(false);
        if (errored && !cancelled) {
          toast.error('Could not refresh responsibilities. Existing rows still editable.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const respById = useMemo(() => {
    const m = new Map();
    for (const r of responsibilities) m.set(String(r._id), r);
    return m;
  }, [responsibilities]);

  // Case-insensitive name → master responsibility lookup. Used when the
  // user types a work item: if the name matches a saved responsibility
  // (e.g. "Lead Designer"), the row links to its responsibilityId so
  // backend notification routing keeps working.
  const respByLowerName = useMemo(() => {
    const m = new Map();
    for (const r of responsibilities) m.set(r.name.trim().toLowerCase(), r);
    return m;
  }, [responsibilities]);

  // ─── By Person view derivations + edits ──────────────────────────────────

  // Build a stable key for any work item (master responsibility OR custom).
  // Used so a chip in By Person view maps to exactly one row.
  const rowKey = (row) => {
    if (row.responsibilityId) return `r:${row.responsibilityId}`;
    if (row.customName) return `c:${row.customName.trim().toLowerCase()}`;
    return null;
  };

  // Unique work items in this project (from rows) — drives the chip set
  // in By Person view. Only items actually in use appear; nothing global
  // or hardcoded slips in.
  const projectWorkItems = useMemo(() => {
    const seen = new Set();
    const items = [];
    for (const row of rows) {
      const key = rowKey(row);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (row.responsibilityId) {
        const resp = respById.get(String(row.responsibilityId));
        items.push({
          key,
          kind: 'master',
          responsibilityId: row.responsibilityId,
          name: resp?.name || 'Saved responsibility',
          icon: resp?.icon,
          color: resp?.color,
        });
      } else {
        items.push({
          key,
          kind: 'custom',
          customName: row.customName,
          name: row.customName,
          icon: 'Layers',
          color: 'text-[var(--text-muted)]',
        });
      }
    }
    return items;
  }, [rows, respById]);

  // For each user, the set of work-item keys they own.
  const peopleFromRows = useMemo(() => {
    const byUserId = new Map();
    for (const row of rows) {
      const key = rowKey(row);
      if (!key) continue;
      for (const user of row.users || []) {
        if (!user?._id) continue;
        const id = String(user._id);
        if (!byUserId.has(id)) byUserId.set(id, { user, itemKeys: new Set() });
        byUserId.get(id).itemKeys.add(key);
      }
    }
    return Array.from(byUserId.values());
  }, [rows]);

  // Display list = real assignees + pending persons not already real.
  const peopleDisplay = useMemo(() => {
    const realIds = new Set(peopleFromRows.map((p) => String(p.user._id)));
    const pendingNew = pendingPersons.filter((u) => !realIds.has(String(u._id)));
    return [
      ...peopleFromRows,
      ...pendingNew.map((user) => ({ user, itemKeys: new Set() })),
    ];
  }, [peopleFromRows, pendingPersons]);

  const allAssignedUserIds = useMemo(() => {
    const s = new Set();
    for (const row of rows) for (const u of row.users || []) if (u?._id) s.add(String(u._id));
    for (const u of pendingPersons) if (u?._id) s.add(String(u._id));
    return s;
  }, [rows, pendingPersons]);

  // Toggle a work item on/off for a given user — writes back to canonical rows.
  // Works for both saved responsibilities and per-project custom items.
  const togglePersonWorkItem = (user, item) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => rowKey(r) === item.key);
      if (idx === -1) {
        // Row didn't exist (user is creating from scratch via a chip click).
        const newRow = item.kind === 'master'
          ? { responsibilityId: item.responsibilityId, customName: '', users: [user] }
          : { responsibilityId: '', customName: item.customName, users: [user] };
        return [...prev, newRow];
      }
      const row = prev[idx];
      const hasUser = (row.users || []).some((u) => String(u._id) === String(user._id));
      const nextUsers = hasUser
        ? row.users.filter((u) => String(u._id) !== String(user._id))
        : [...(row.users || []), user];
      return prev.map((r, i) => (i === idx ? { ...r, users: nextUsers } : r));
    });
    setPendingPersons((prev) => prev.filter((u) => String(u._id) !== String(user._id)));
  };

  // Create a brand-new work item from inside the By Person view and assign
  // the typed name to the given user in one click. If the typed name matches
  // an existing saved responsibility (case-insensitive), it links via
  // responsibilityId; otherwise it becomes a custom row.
  const addWorkItemForPerson = (user, rawName) => {
    const name = (rawName || '').trim();
    if (!name) return;
    const match = respByLowerName.get(name.toLowerCase());
    setRows((prev) => {
      const existingIdx = match
        ? prev.findIndex((r) => String(r.responsibilityId) === String(match._id))
        : prev.findIndex(
            (r) => r.customName && r.customName.trim().toLowerCase() === name.toLowerCase()
          );
      if (existingIdx !== -1) {
        const row = prev[existingIdx];
        const has = (row.users || []).some((u) => String(u._id) === String(user._id));
        if (has) return prev; // already assigned — no-op
        return prev.map((r, i) =>
          i === existingIdx ? { ...r, users: [...(r.users || []), user] } : r
        );
      }
      return match
        ? [...prev, { responsibilityId: match._id, customName: '', users: [user] }]
        : [...prev, { responsibilityId: '', customName: name, users: [user] }];
    });
    setPendingPersons((prev) => prev.filter((u) => String(u._id) !== String(user._id)));
  };

  const removePersonFromAllRows = (userId) => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        users: (r.users || []).filter((u) => String(u._id) !== String(userId)),
      }))
    );
    setPendingPersons((prev) => prev.filter((u) => String(u._id) !== String(userId)));
  };

  const handleAddPerson = (user) => {
    if (!user) return;
    if (allAssignedUserIds.has(String(user._id))) {
      toast.info(`${user.name} is already on the team`);
      setShowAddPersonPicker(false);
      return;
    }
    setPendingPersons((prev) => [...prev, user]);
    setShowAddPersonPicker(false);
  };

  const handleSave = async () => {
    // Drop empty rows (no label OR no users). A row needs either a
    // responsibilityId (picked a saved one) or a customName (typed inline)
    // PLUS at least one assignee.
    const payload = rows
      .filter((r) => (r.responsibilityId || (r.customName || '').trim()) && r.users.length > 0)
      .map((r) => {
        const entry = { userIds: r.users.map((u) => u._id) };
        if (r.responsibilityId) entry.responsibilityId = r.responsibilityId;
        else entry.customName = r.customName.trim();
        return entry;
      });

    if (payload.length === 0) {
      toast.error('Add at least one work item with assignees before saving');
      return;
    }

    setSaving(true);
    try {
      await pmsService.updateTeam(project._id, { assignments: payload });
      toast.success('Team saved successfully');
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to save team');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Project Team"
      className="max-w-2xl"
    >
      {/* Header — person count */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Users size={15} />
          <span>
            <span className="font-bold text-[var(--text-primary)]">{peopleDisplay.length}</span>
            {' '}{peopleDisplay.length === 1 ? 'person' : 'people'} on this project
          </span>
        </div>
      </div>

      {/* ─── By Person view (the only view) ──────────────────────────── */}
      {(
        peopleDisplay.length === 0 && !showAddPersonPicker ? (
          <div className="text-center py-8 border border-dashed border-[var(--border)] rounded-xl">
            <Users size={28} className="mx-auto text-[var(--text-muted)] mb-2" />
            <p className="text-sm text-[var(--text-muted)]">No people assigned yet</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Add a person and tick the responsibilities they own on this project.
            </p>
            <button
              type="button"
              onClick={() => setShowAddPersonPicker(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary)] text-white hover:opacity-90"
            >
              <Plus size={13} /> Add Person
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {peopleDisplay.map(({ user, itemKeys }) => {
              const isPending = itemKeys.size === 0;
              return (
                <div
                  key={user._id}
                  className="p-3 border border-[var(--border)] rounded-xl bg-[var(--bg)]"
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <PersonChip user={user} />
                    <button
                      type="button"
                      onClick={() => removePersonFromAllRows(user._id)}
                      className="shrink-0 p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
                      title="Remove person from project"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {isPending && (
                    <p className="text-[11px] text-[var(--text-muted)] mb-2">
                      Type a work item below (or pick an existing chip) to assign this person.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {projectWorkItems.length === 0 ? (
                      <p className="text-[11px] text-[var(--text-muted)]">
                        No work items on this project yet. Type one in the box below.
                      </p>
                    ) : (
                      projectWorkItems.map((item) => {
                        const isSelected = itemKeys.has(item.key);
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => togglePersonWorkItem(user, item)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                              isSelected
                                ? `bg-[var(--primary)]/10 border-[var(--primary)]/40 ${item.color || 'text-[var(--primary)]'}`
                                : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]/40 hover:text-[var(--text-primary)]'
                            }`}
                          >
                            <ResponsibilityIcon name={item.icon} size={11} />
                            {item.name}
                            {isSelected && <Check size={11} />}
                          </button>
                        );
                      })
                    )}
                    <AddWorkInline
                      onAdd={(name) => addWorkItemForPerson(user, name)}
                      suggestions={responsibilities.map((r) => r.name)}
                    />
                  </div>
                </div>
              );
            })}

            {/* Add Person trigger / inline picker */}
            {showAddPersonPicker ? (
              <div className="p-3 border border-dashed border-[var(--primary)]/40 rounded-xl bg-[var(--primary)]/5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">Pick a person to add</p>
                  <button
                    type="button"
                    onClick={() => setShowAddPersonPicker(false)}
                    className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    title="Cancel"
                  >
                    <X size={13} />
                  </button>
                </div>
                <EmployeePicker
                  value={null}
                  onChange={handleAddPerson}
                  placeholder="Search employees..."
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddPersonPicker(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[var(--border)] text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--primary)] hover:border-[var(--primary)]/40 transition-colors"
              >
                <Plus size={14} /> Add Person
              </button>
            )}
          </div>
        )
      )}

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 pt-5 mt-5 border-t border-[var(--border)]">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} isLoading={saving}>
          <Check size={14} className="mr-1.5" /> Save Team
        </Button>
      </div>
    </Modal>
  );
};

export default ManageTeamModal;
