import React, { useState } from 'react';
import {
  Plus, MessageCircle, Users, Send, Trash2, RefreshCw,
  CheckCircle2, AlertCircle, Clock, Settings2, Phone, Link2,
} from 'lucide-react';
import { Button, Modal, Loader } from '../../../../shared/components';
import PermissionGate from '../../../../shared/components/PermissionGate/PermissionGate';
import { useToast } from '../../../../shared/notifications/ToastProvider';
import useWhatsAppGroups from '../../hooks/useWhatsAppGroups';
import ManageGroupMembersModal from '../ManageGroupMembersModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';

// ─── Config ───────────────────────────────────────────────────────────────────

const GROUP_TYPE_CONFIG = {
  main:       { label: 'Main Group',     color: 'text-[var(--primary)]',     bg: 'bg-[var(--primary)]/10',     dot: 'bg-[var(--primary)]' },
  drawing:    { label: 'Drawing Review', color: 'text-[var(--accent-blue)]', bg: 'bg-[var(--accent-blue)]/10', dot: 'bg-[var(--accent-blue)]' },
  supervision:{ label: 'Supervision',    color: 'text-[var(--accent-teal)]', bg: 'bg-[var(--accent-teal)]/10', dot: 'bg-[var(--accent-teal)]' },
  payment:    { label: 'Payment',        color: 'text-[var(--success)]',     bg: 'bg-[var(--success)]/10',     dot: 'bg-[var(--success)]' },
  custom:     { label: 'Custom',         color: 'text-[var(--text-muted)]',  bg: 'bg-[var(--border)]',         dot: 'bg-[var(--text-muted)]' },
};

const SYNC_CONFIG = {
  unsynced: { label: 'Not synced', icon: Clock,         color: 'text-[var(--text-muted)]' },
  synced:   { label: 'Synced',     icon: CheckCircle2,  color: 'text-[var(--success)]' },
  partial:  { label: 'Partial',    icon: AlertCircle,   color: 'text-[var(--warning)]' },
  failed:   { label: 'Sync failed',icon: AlertCircle,   color: 'text-[var(--error)]' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const GroupTypeBadge = ({ type }) => {
  const cfg = GROUP_TYPE_CONFIG[type] || GROUP_TYPE_CONFIG.custom;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const SyncBadge = ({ syncStatus }) => {
  const cfg = SYNC_CONFIG[syncStatus] || SYNC_CONFIG.unsynced;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${cfg.color}`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
};

const MemberChips = ({ members, max = 4 }) => {
  if (!members || members.length === 0) return (
    <span className="text-[10px] text-[var(--text-muted)] italic">No members</span>
  );
  const visible  = members.slice(0, max);
  const overflow = members.length - max;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map((m, i) => {
        const initials = (m.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
        return (
          <div
            key={m.phone || i}
            title={`${m.name || ''}${m.phone ? ` · ${m.phone}` : ' (no phone)'}`}
            className="w-6 h-6 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[8px] font-black text-[var(--primary)] border border-white"
          >
            {initials}
          </div>
        );
      })}
      {overflow > 0 && (
        <div className="w-6 h-6 rounded-full bg-[var(--border)] flex items-center justify-center text-[8px] font-black text-[var(--text-muted)] border border-white">
          +{overflow}
        </div>
      )}
    </div>
  );
};

// ─── Create Group Modal ───────────────────────────────────────────────────────

const EMPTY_GROUP = { groupType: 'main', groupName: '', providerGroupId: '', notes: '' };

const CreateGroupModal = ({ isOpen, onClose, onSave }) => {
  const [form, setForm]     = useState(EMPTY_GROUP);
  const [saving, setSaving] = useState(false);

  const handle = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.groupName.trim()) return;
    setSaving(true);
    try { await onSave(form); setForm(EMPTY_GROUP); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create WhatsApp Group">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Group Type</label>
          <div className="grid grid-cols-5 gap-1.5">
            {Object.entries(GROUP_TYPE_CONFIG).map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => handle('groupType', k)}
                className={`px-2 py-2 rounded-xl border text-[10px] font-bold transition-all text-center
                  ${form.groupType === k
                    ? `${v.bg} ${v.color} border-current`
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border)]'
                  }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Group Name *</label>
          <input
            value={form.groupName}
            onChange={(e) => handle('groupName', e.target.value)}
            placeholder="e.g. Sharma Project — Design Team"
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
            WhatsApp Group ID
            <span className="ml-1 text-[var(--text-muted)] font-normal">(optional)</span>
          </label>
          <input
            value={form.providerGroupId}
            onChange={(e) => handle('providerGroupId', e.target.value)}
            placeholder="Paste existing WA group ID to link it"
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]"
          />
          <p className="text-[10px] text-[var(--text-muted)] mt-1">
            Leave blank — you can sync with WhatsApp after adding members.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => handle('notes', e.target.value)}
            rows={2}
            placeholder="Purpose or description…"
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!form.groupName.trim() || saving}>
            {saving ? 'Creating…' : 'Create Group'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Send Update Modal ────────────────────────────────────────────────────────

const SendUpdateModal = ({ isOpen, onClose, onSend, groupName }) => {
  const [message, setMessage]   = useState('');
  const [sending, setSending]   = useState(false);

  const submit = async () => {
    if (!message.trim()) return;
    setSending(true);
    try { await onSend({ message }); onClose(); setMessage(''); }
    finally { setSending(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Send Update — ${groupName}`}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Message *</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Type your update message here…"
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] resize-none"
          />
          <p className="text-[10px] text-[var(--text-muted)] mt-1">
            Sends individually to each member's phone number.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!message.trim() || sending}>
            <Send size={13} /> {sending ? 'Sending…' : 'Send to All'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Link Manually Modal ──────────────────────────────────────────────────────

const LinkManuallyModal = ({ isOpen, onClose, onSave, groupName }) => {
  const [groupId, setGroupId] = useState('');
  const [saving, setSaving]   = useState(false);

  const submit = async () => {
    const trimmed = groupId.trim();
    if (!trimmed) return;
    setSaving(true);
    try { await onSave(trimmed); onClose(); setGroupId(''); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Link WhatsApp Group — ${groupName}`}>
      <div className="space-y-4">
        {/* Why sync failed */}
        <div className="rounded-xl bg-[var(--warning)]/10 border border-[var(--warning)]/20 px-4 py-3">
          <p className="text-xs font-semibold text-[var(--warning)] mb-1.5">Why did auto-sync fail?</p>
          <ul className="text-[11px] text-[var(--text-muted)] space-y-0.5 list-disc list-inside leading-relaxed">
            <li>Maytapi phone is not connected to WhatsApp</li>
            <li>Your plan doesn't include group creation</li>
            <li>Phone numbers aren't registered WhatsApp users</li>
            <li>Maytapi account is inactive or quota exceeded</li>
          </ul>
        </div>

        {/* Manual input */}
        <div>
          <p className="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">
            Create the group on your phone, then paste the WhatsApp Group ID below.
            The ERP will save it so you can add members via Maytapi later.
          </p>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
            WhatsApp Group ID *
          </label>
          <input
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            placeholder="e.g. 120363xxxxxxxxxx@g.us"
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] font-mono"
          />
          <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
            Find it in Maytapi dashboard → Groups, or copy from a group info screen.
            Format: <span className="font-mono">XXXXXXXXXX@g.us</span>
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!groupId.trim() || saving}>
            <Link2 size={13} /> {saving ? 'Saving…' : 'Link Group'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Group Card ───────────────────────────────────────────────────────────────

const GroupCard = ({ group, onManageMembers, onSend, onSync, onDelete, onLinkManually }) => {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try { await onSync(group._id); }
    finally { setSyncing(false); }
  };

  const syncFailed = group.syncStatus === 'failed' && !group.providerGroupId;

  return (
    <div className={`bg-[var(--surface)] border rounded-2xl overflow-hidden transition-shadow hover:shadow-md ${group.isActive ? 'border-[var(--border)]' : 'border-[var(--border)] opacity-60'}`}>
      {/* Coloured top bar */}
      <div className={`h-1 w-full ${GROUP_TYPE_CONFIG[group.groupType]?.dot ? `bg-[var(--primary)]` : 'bg-[var(--border)]'}`}
        style={{ backgroundColor: group.groupType === 'main' ? 'var(--primary)' : group.groupType === 'drawing' ? 'var(--accent-blue)' : group.groupType === 'supervision' ? 'var(--accent-teal)' : group.groupType === 'payment' ? 'var(--success)' : 'var(--border)' }}
      />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <GroupTypeBadge type={group.groupType} />
            <p className="text-sm font-bold text-[var(--text-primary)] mt-1.5 leading-tight">{group.groupName}</p>
            {group.providerGroupId && (
              <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 truncate">
                WA: {group.providerGroupId}
              </p>
            )}
          </div>

          <PermissionGate permission="pms.whatsapp.manage">
            <button
              onClick={() => onDelete(group._id)}
              className="p-1.5 rounded-lg hover:bg-[var(--error)]/10 text-[var(--text-muted)] hover:text-[var(--error)] transition-colors shrink-0"
              title="Delete group"
            >
              <Trash2 size={13} />
            </button>
          </PermissionGate>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mb-3 flex-wrap">
          <span className="flex items-center gap-1"><Users size={11} /> {group.members?.length || 0} members</span>
          <SyncBadge syncStatus={group.syncStatus} />
          {group.lastMessageAt && <span>Last msg: {fmt(group.lastMessageAt)}</span>}
        </div>

        {/* Member chips */}
        <div className="mb-3">
          <MemberChips members={group.members} />
        </div>

        {/* Members without phones warning */}
        {group.members?.some((m) => !m.phone) && (
          <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/20">
            <Phone size={11} className="text-[var(--warning)]" />
            <p className="text-[10px] text-[var(--warning)] font-medium">
              {group.members.filter((m) => !m.phone).length} member(s) missing phone — can't receive messages
            </p>
          </div>
        )}

        {group.notes && (
          <p className="text-[11px] text-[var(--text-muted)] mb-3 italic leading-relaxed">{group.notes}</p>
        )}

        {/* Sync errors — richer display for failed status */}
        {group.syncErrors?.length > 0 && group.syncStatus !== 'synced' && (
          <div className="mb-3 px-2.5 py-2 rounded-lg bg-[var(--error)]/10 border border-[var(--error)]/20">
            {syncFailed ? (
              <>
                <p className="text-[10px] text-[var(--error)] font-semibold">WhatsApp sync failed</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5 leading-relaxed">{group.syncErrors[0]}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  Use "Link Manually" if Maytapi group creation isn't supported on your plan.
                </p>
              </>
            ) : (
              <p className="text-[10px] text-[var(--error)] font-medium">{group.syncErrors[0]}</p>
            )}
          </div>
        )}

        {/* Actions */}
        <PermissionGate permission="pms.whatsapp.manage">
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => onManageMembers(group)}
              >
                <Settings2 size={12} /> Members
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => onSend(group)}
                disabled={!group.members?.length}
              >
                <Send size={12} /> Send
              </Button>
            </div>

            {/* Sync failed: show Retry + Link Manually side-by-side */}
            {syncFailed && (
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-[var(--warning)] border-[var(--warning)]/30 hover:bg-[var(--warning)]/10"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Retrying…' : 'Retry Sync'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-[var(--accent-blue)] border-[var(--accent-blue)]/30 hover:bg-[var(--accent-blue)]/10"
                  onClick={() => onLinkManually(group)}
                >
                  <Link2 size={12} /> Link Manually
                </Button>
              </div>
            )}

            {/* Not yet synced, no provider ID, not failed */}
            {!group.providerGroupId && !syncFailed && (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-[var(--accent-teal)] border-[var(--accent-teal)]/30 hover:bg-[var(--accent-teal)]/10"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Creating in WhatsApp…' : 'Create Group in WhatsApp'}
              </Button>
            )}

            {/* Has providerGroupId but not yet fully synced */}
            {group.providerGroupId && group.syncStatus !== 'synced' && (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-[var(--warning)] border-[var(--warning)]/30 hover:bg-[var(--warning)]/10"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Syncing…' : 'Re-sync Members'}
              </Button>
            )}
          </div>
        </PermissionGate>
      </div>
    </div>
  );
};

// ─── Main Tab ─────────────────────────────────────────────────────────────────

const WhatsAppTab = ({ project }) => {
  const { success, error: toastError } = useToast();
  const { groups, isLoading, error, createGroup, updateGroup, deleteGroup, addMember, removeMember, syncGroup, sendUpdate } =
    useWhatsAppGroups(project._id);

  const [showCreate, setShowCreate]           = useState(false);
  const [sendingGroup, setSendingGroup]       = useState(null);
  const [managingGroup, setManagingGroup]     = useState(null);
  const [linkingGroup, setLinkingGroup]       = useState(null);

  // Keep managingGroup in sync after member changes (pick fresh data from groups array)
  const freshManagingGroup = managingGroup
    ? (groups.find((g) => g._id === managingGroup._id) || managingGroup)
    : null;

  const handleCreate = async (data) => {
    try { await createGroup(data); success('WhatsApp group created'); }
    catch (e) { toastError(e?.response?.data?.message || e.message || 'Failed to create group'); }
  };

  const handleSend = async (data) => {
    try {
      const res = await sendUpdate(sendingGroup._id, data);
      const delivered = res?.data?.delivered ?? res?.delivered ?? 0;
      success(`Update sent to ${delivered} member${delivered !== 1 ? 's' : ''}`);
    } catch (e) { toastError(e?.response?.data?.message || e.message || 'Failed to send'); }
  };

  const handleDelete = async (id) => {
    try { await deleteGroup(id); success('Group removed'); }
    catch (e) { toastError(e?.response?.data?.message || e.message || 'Failed to remove group'); }
  };

  const handleSync = async (groupId) => {
    try {
      const res = await syncGroup(groupId);
      const d = res?.data ?? res;
      success(d.syncStatus === 'synced'
        ? `Group synced — ${d.syncedMembers} members added`
        : `Partial sync — ${d.errors?.length || 0} error(s). Check member phone numbers.`);
    } catch (e) { toastError(e?.response?.data?.message || e.message || 'Sync failed'); }
  };

  const handleAddMember = async (memberData) => {
    await addMember(managingGroup._id, memberData);
  };

  const handleRemoveMember = async (phone) => {
    await removeMember(managingGroup._id, phone);
  };

  const handleSaveLink = async (providerGroupId) => {
    try {
      await updateGroup(linkingGroup._id, { providerGroupId });
      success('Group linked — click "Re-sync Members" to add members to WhatsApp.');
    } catch (e) { toastError(e?.response?.data?.message || e.message || 'Failed to save group ID'); }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader label="Loading groups…" /></div>;

  const standardTypes = ['main', 'drawing', 'supervision', 'payment'];
  const missingStandard = standardTypes.filter(
    (t) => !groups.some((g) => g.groupType === t)
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            WhatsApp Groups
            <span className="ml-2 text-[var(--text-muted)] font-normal text-xs">({groups.length})</span>
          </h3>
          {missingStandard.length > 0 && (
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Missing: {missingStandard.map((t) => GROUP_TYPE_CONFIG[t].label).join(', ')}
            </p>
          )}
        </div>
        <PermissionGate permission="pms.whatsapp.manage">
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Add Group
          </Button>
        </PermissionGate>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--error)]/10 border border-[var(--error)]/20">
          <AlertCircle size={13} className="text-[var(--error)]" />
          <p className="text-xs text-[var(--error)]">{error}</p>
        </div>
      )}

      {/* Kickstart reminder */}
      {!project.kickstartCompleted && (
        <div className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-4 py-3">
          <p className="text-xs font-semibold text-[var(--warning)]">Kickstart incomplete</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Create all 4 standard groups (Main, Drawing, Supervision, Payment) to complete kickstart.
          </p>
        </div>
      )}

      {/* Empty state */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--accent-teal)]/10 flex items-center justify-center mb-4">
            <MessageCircle size={26} className="text-[var(--accent-teal)]" />
          </div>
          <p className="text-sm font-bold text-[var(--text-primary)] mb-1">No WhatsApp groups yet</p>
          <p className="text-xs text-[var(--text-muted)] mb-5 max-w-xs leading-relaxed">
            Create the 4 standard project groups — Main, Drawing Review, Supervision, and Payment — to coordinate the team via WhatsApp.
          </p>
          <PermissionGate permission="pms.whatsapp.manage">
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={14} /> Add First Group
            </Button>
          </PermissionGate>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groups.map((g) => (
            <GroupCard
              key={g._id}
              group={g}
              onManageMembers={setManagingGroup}
              onSend={setSendingGroup}
              onSync={handleSync}
              onDelete={handleDelete}
              onLinkManually={setLinkingGroup}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateGroupModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={handleCreate}
      />

      {sendingGroup && (
        <SendUpdateModal
          isOpen={!!sendingGroup}
          onClose={() => setSendingGroup(null)}
          onSend={handleSend}
          groupName={sendingGroup.groupName}
        />
      )}

      <ManageGroupMembersModal
        isOpen={!!managingGroup}
        onClose={() => setManagingGroup(null)}
        group={freshManagingGroup}
        onAddMember={handleAddMember}
        onRemove={handleRemoveMember}
      />

      {linkingGroup && (
        <LinkManuallyModal
          isOpen={!!linkingGroup}
          onClose={() => setLinkingGroup(null)}
          onSave={handleSaveLink}
          groupName={linkingGroup.groupName}
        />
      )}
    </div>
  );
};

export default WhatsAppTab;
