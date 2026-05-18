import React, { useState } from 'react';
import { Plus, MessageCircle, Users, Send, Trash2, MoreHorizontal } from 'lucide-react';
import { Button, Modal, Loader } from '../../../../shared/components';
import PermissionGate from '../../../../shared/components/PermissionGate/PermissionGate';
import { useToast } from '../../../../shared/notifications/ToastProvider';
import useWhatsAppGroups from '../../hooks/useWhatsAppGroups';

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const GROUP_TYPE_CONFIG = {
  main:       { label: 'Main Group',       color: 'text-[var(--primary)]',     bg: 'bg-[var(--primary)]/10' },
  drawing:    { label: 'Drawing Review',   color: 'text-[var(--accent-blue)]', bg: 'bg-[var(--accent-blue)]/10' },
  supervision:{ label: 'Supervision',      color: 'text-[var(--accent-teal)]', bg: 'bg-[var(--accent-teal)]/10' },
  payment:    { label: 'Payment',          color: 'text-[var(--success)]',     bg: 'bg-[var(--success)]/10' },
  custom:     { label: 'Custom',           color: 'text-[var(--text-muted)]',  bg: 'bg-[var(--border)]' },
};

const GroupTypeBadge = ({ type }) => {
  const cfg = GROUP_TYPE_CONFIG[type] || GROUP_TYPE_CONFIG.custom;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>;
};

const EMPTY_GROUP = { groupType: 'main', groupName: '', providerGroupId: '', notes: '' };

const CreateGroupModal = ({ isOpen, onClose, onSave }) => {
  const [form, setForm]   = useState(EMPTY_GROUP);
  const [saving, setSaving] = useState(false);

  const handle = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.groupName.trim()) return;
    setSaving(true);
    try { await onSave(form); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create WhatsApp Group">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Group Type</label>
          <select value={form.groupType} onChange={(e) => handle('groupType', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]">
            {Object.entries(GROUP_TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Group Name *</label>
          <input value={form.groupName} onChange={(e) => handle('groupName', e.target.value)} placeholder="e.g. JJ Studio - Sharma Project"
            className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Provider Group ID</label>
          <input value={form.providerGroupId} onChange={(e) => handle('providerGroupId', e.target.value)} placeholder="WA group ID from provider (optional)"
            className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]" />
          <p className="text-[10px] text-[var(--text-muted)] mt-1">If the group already exists in WhatsApp, enter its provider-assigned ID.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Notes</label>
          <textarea value={form.notes} onChange={(e) => handle('notes', e.target.value)} rows={2} placeholder="Purpose or members description…"
            className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!form.groupName.trim() || saving}>{saving ? 'Creating…' : 'Create Group'}</Button>
        </div>
      </div>
    </Modal>
  );
};

const SendUpdateModal = ({ isOpen, onClose, onSend, groupName }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

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
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Message *</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
            placeholder="Type your update message here…"
            className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!message.trim() || sending}><Send size={14} /> {sending ? 'Sending…' : 'Send'}</Button>
        </div>
      </div>
    </Modal>
  );
};

const WhatsAppTab = ({ project }) => {
  const { success, error: toastError } = useToast();
  const { groups, isLoading, error, createGroup, deleteGroup, sendUpdate } = useWhatsAppGroups(project._id);
  const [showCreate, setShowCreate]   = useState(false);
  const [sendingGroup, setSendingGroup] = useState(null);

  const handleCreate = async (data) => {
    try { await createGroup(data); success('WhatsApp group created'); }
    catch (e) { toastError(e || 'Failed to create group'); }
  };

  const handleSend = async (data) => {
    try {
      const res = await sendUpdate(sendingGroup._id, data);
      const delivered = res.results?.filter((r) => r.success).length || 0;
      success(`Update sent to ${delivered} member${delivered !== 1 ? 's' : ''}`);
    } catch (e) { toastError(e || 'Failed to send update'); }
  };

  const handleDelete = async (id) => {
    try { await deleteGroup(id); success('Group removed'); }
    catch (e) { toastError(e || 'Failed to remove group'); }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader label="Loading groups…" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          WhatsApp Groups <span className="text-[var(--text-muted)] font-normal">({groups.length})</span>
        </h3>
        <PermissionGate permission="pms.whatsapp.manage">
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Add Group</Button>
        </PermissionGate>
      </div>

      {error && <p className="text-xs text-[var(--error)]">{error}</p>}

      {/* Kickstart reminder */}
      {!project.kickstartCompleted && (
        <div className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-4 py-3">
          <p className="text-xs font-semibold text-[var(--warning)]">Kickstart incomplete</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Complete the kickstart checklist to track all 4 required groups.</p>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent-teal)]/10 flex items-center justify-center mb-3">
            <MessageCircle size={22} className="text-[var(--accent-teal)]" />
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">No WhatsApp groups yet</p>
          <p className="text-xs text-[var(--text-muted)] mb-4 max-w-xs">
            Add the 4 standard project groups: Main, Drawing, Supervision, and Payment.
          </p>
          <PermissionGate permission="pms.whatsapp.manage">
            <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Add First Group</Button>
          </PermissionGate>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groups.map((g) => (
            <div key={g._id} className={`bg-[var(--surface)] border rounded-2xl p-4 transition-colors ${g.isActive ? 'border-[var(--border)]' : 'border-[var(--border)] opacity-60'}`}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <GroupTypeBadge type={g.groupType} />
                  <p className="text-sm font-bold text-[var(--text-primary)] mt-1.5 truncate">{g.groupName}</p>
                  {g.providerGroupId && (
                    <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">ID: {g.providerGroupId}</p>
                  )}
                </div>
                <PermissionGate permission="pms.whatsapp.manage">
                  <button onClick={() => handleDelete(g._id)} className="p-1.5 rounded-lg hover:bg-[var(--error)]/10 text-[var(--text-muted)] hover:text-[var(--error)] transition-colors">
                    <Trash2 size={13} />
                  </button>
                </PermissionGate>
              </div>

              <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mb-3">
                <span className="flex items-center gap-1"><Users size={11} /> {g.members?.length || 0} members</span>
                {g.lastMessageAt && <span>Last: {fmt(g.lastMessageAt)}</span>}
                {g.messageCount > 0 && <span>{g.messageCount} msgs</span>}
              </div>

              {g.notes && <p className="text-xs text-[var(--text-muted)] mb-3 italic">{g.notes}</p>}

              <PermissionGate permission="pms.whatsapp.manage">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setSendingGroup(g)}
                >
                  <Send size={13} /> Send Update
                </Button>
              </PermissionGate>
            </div>
          ))}
        </div>
      )}

      <CreateGroupModal isOpen={showCreate} onClose={() => setShowCreate(false)} onSave={handleCreate} />
      {sendingGroup && (
        <SendUpdateModal
          isOpen={!!sendingGroup}
          onClose={() => setSendingGroup(null)}
          onSend={handleSend}
          groupName={sendingGroup.groupName}
        />
      )}
    </div>
  );
};

export default WhatsAppTab;
