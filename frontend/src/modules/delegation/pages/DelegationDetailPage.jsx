import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Trash2, Paperclip, Download, Send } from 'lucide-react';
import Modal from '../../../shared/components/Modal/Modal';
import Button from '../../../shared/components/Button/Button';
import { useAuth } from '../../../shared/context/AuthContext';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { useDelegationDetail } from '../hooks/useDelegationDetail';
import { delegationService } from '../services/delegationService';
import { DelegationStatusBadge, PriorityChip } from '../components/DelegationStatusBadge';
import { ALLOWED_TRANSITIONS, TRANSITION_LABEL } from '../constants/delegationStatus';

const TABS = ['Overview', 'Checklist', 'Comments', 'Attachments', 'Activity'];
const fmt = (d) => (d ? new Date(d).toLocaleString() : '—');

const DelegationDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const { delegation, comments, activity, isLoading, error, refresh } = useDelegationDetail(id);

  const [tab, setTab] = useState('Overview');
  const [busy, setBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignees, setAssignees] = useState([]);
  const [assignTo, setAssignTo] = useState('');
  const [reason, setReason] = useState('');
  const [newItem, setNewItem] = useState('');
  const [comment, setComment] = useState('');
  const fileRef = useRef();

  const canUpdate = hasPermission('delegation.update');
  const canAssign = hasPermission('delegation.assign');
  const canReassign = hasPermission('delegation.reassign');

  useEffect(() => {
    if ((canAssign || canReassign) && assignOpen && assignees.length === 0) {
      delegationService.assignees().then((r) => setAssignees(r.users || [])).catch(() => {});
    }
  }, [assignOpen, canAssign, canReassign, assignees.length]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-[var(--text-muted)]"><Loader2 className="animate-spin mr-2" />Loading…</div>;
  }
  if (error || !delegation) {
    return <div className="p-6 text-center text-[var(--error)]">{error || 'Delegation not found'}</div>;
  }

  const run = async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); if (okMsg) toast.success(okMsg); await refresh(); }
    catch (err) { toast.error(err?.message || 'Action failed'); }
    finally { setBusy(false); }
  };

  const changeStatus = (status) =>
    run(() => delegationService.changeStatus(id, { status }), `Moved to ${status}`);

  const submitAssign = () => {
    if (!assignTo) return toast.error('Pick an assignee');
    const isReassign = !!delegation.assignedTo;
    const call = isReassign
      ? delegationService.reassign(id, { assignedTo: assignTo, reason: reason || 'Reassigned' })
      : delegationService.assign(id, { assignedTo: assignTo });
    run(() => call, isReassign ? 'Reassigned' : 'Assigned').then(() => {
      setAssignOpen(false); setAssignTo(''); setReason('');
    });
  };

  const addItem = () => {
    const v = newItem.trim(); if (!v) return;
    run(() => delegationService.updateChecklist(id, { op: 'add', item: v }), null).then(() => setNewItem(''));
  };
  const toggleItem = (itemId) => run(() => delegationService.updateChecklist(id, { op: 'toggle', itemId }), null);
  const removeItem = (itemId) => run(() => delegationService.updateChecklist(id, { op: 'remove', itemId }), null);

  const addComment = () => {
    const v = comment.trim(); if (!v) return;
    run(() => delegationService.addComment(id, { body: v }), 'Comment added').then(() => setComment(''));
  };

  const uploadFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    run(() => delegationService.addAttachment(id, fd), 'Attachment added').then(() => { if (fileRef.current) fileRef.current.value = ''; });
  };
  const downloadAtt = async (attId) => {
    try { const r = await delegationService.attachmentUrl(id, attId); if (r.url) window.open(r.url, '_blank'); }
    catch (err) { toast.error(err?.message || 'Could not get file'); }
  };
  const removeAtt = (attId) => run(() => delegationService.removeAttachment(id, attId), 'Attachment removed');

  const nextStatuses = ALLOWED_TRANSITIONS[delegation.status] || [];

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4">
      <button onClick={() => navigate('/delegation/list')} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1">
        <ArrowLeft size={15} /> Back to list
      </button>

      {/* Header */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-[var(--text-muted)]">{delegation.trackingId}</span>
              <DelegationStatusBadge status={delegation.status} />
              <PriorityChip priority={delegation.priority} />
            </div>
            <h1 className="text-xl font-extrabold text-[var(--text-primary)] mt-1.5">{delegation.title}</h1>
            <div className="text-xs text-[var(--text-muted)] mt-1 flex flex-wrap gap-x-3 gap-y-1">
              <span>👤 {delegation.assignedTo?.name || 'Unassigned'}</span>
              {delegation.departmentId?.name && <span>🏢 {delegation.departmentId.name}</span>}
              <span>📅 Due {delegation.dueDate ? new Date(delegation.dueDate).toLocaleDateString() : '—'}</span>
              <span>Progress {delegation.progressPercent || 0}%</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {(canUpdate || canAssign || canReassign) && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--border)]">
            {canUpdate && nextStatuses.map((s) => (
              <Button key={s} size="sm" variant={s === 'cancelled' ? 'ghost' : 'outline'} disabled={busy} onClick={() => changeStatus(s)}>
                {TRANSITION_LABEL[s] || s}
              </Button>
            ))}
            {(canAssign || canReassign) && delegation.status !== 'cancelled' && (
              <Button size="sm" variant="primary" disabled={busy} onClick={() => setAssignOpen(true)}>
                {delegation.assignedTo ? 'Reassign' : 'Assign'}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl">
        <div className="flex gap-1 border-b border-[var(--border)] px-2 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${tab === t ? 'text-[var(--primary-active)] border-[var(--primary)]' : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]'}`}>
              {t}
              {t === 'Checklist' && delegation.checklist?.length ? ` (${delegation.checklist.filter(c => c.isCompleted).length}/${delegation.checklist.length})` : ''}
              {t === 'Comments' && comments.length ? ` (${comments.length})` : ''}
              {t === 'Attachments' && delegation.attachments?.length ? ` (${delegation.attachments.length})` : ''}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'Overview' && (
            <div className="space-y-3 text-sm">
              <p className="text-[var(--text-secondary)] whitespace-pre-wrap">{delegation.description || 'No description.'}</p>
              <div className="grid sm:grid-cols-2 gap-3 text-xs text-[var(--text-muted)] pt-2">
                <div>Created by <b className="text-[var(--text-secondary)]">{delegation.createdBy?.name || '—'}</b></div>
                <div>Created {fmt(delegation.createdAt)}</div>
                {delegation.projectId?.name && <div>Project: <b className="text-[var(--text-secondary)]">{delegation.projectId.name}</b></div>}
                {delegation.startedAt && <div>Started {fmt(delegation.startedAt)}</div>}
                {delegation.completedAt && <div>Completed {fmt(delegation.completedAt)}</div>}
              </div>
            </div>
          )}

          {tab === 'Checklist' && (
            <div className="space-y-2">
              {(delegation.checklist || []).map((c) => (
                <div key={c._id} className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={c.isCompleted} disabled={!canUpdate || busy} onChange={() => toggleItem(c._id)} />
                  <span className={`flex-1 ${c.isCompleted ? 'line-through text-[var(--text-muted)]' : ''}`}>{c.item}</span>
                  {canUpdate && (
                    <button onClick={() => removeItem(c._id)} className="text-[var(--text-muted)] hover:text-[var(--error)]"><Trash2 size={14} /></button>
                  )}
                </div>
              ))}
              {(!delegation.checklist || delegation.checklist.length === 0) && (
                <p className="text-sm text-[var(--text-muted)]">No checklist items yet.</p>
              )}
              {canUpdate && (
                <div className="flex gap-2 pt-2">
                  <input className="flex-1 border border-[var(--border)] bg-[var(--surface)] rounded-lg px-3 py-2 text-sm"
                    value={newItem} onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }} placeholder="Add checklist item…" />
                  <button onClick={addItem} disabled={busy} className="px-3 rounded-lg border border-[var(--border)] hover:bg-[var(--bg)]"><Plus size={16} /></button>
                </div>
              )}
            </div>
          )}

          {tab === 'Comments' && (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c._id} className="bg-[var(--bg)] rounded-lg px-3 py-2">
                  <div className="text-xs text-[var(--text-muted)] flex justify-between">
                    <b className="text-[var(--text-secondary)]">{c.authorId?.name || 'User'}</b>
                    <span>{fmt(c.createdAt)}</span>
                  </div>
                  <p className="text-sm text-[var(--text-primary)] mt-1 whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
              {comments.length === 0 && <p className="text-sm text-[var(--text-muted)]">No comments yet.</p>}
              <div className="flex gap-2 pt-2">
                <input className="flex-1 border border-[var(--border)] bg-[var(--surface)] rounded-lg px-3 py-2 text-sm"
                  value={comment} onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addComment(); }} placeholder="Write a comment…" />
                <button onClick={addComment} disabled={busy} className="px-3 rounded-lg bg-[var(--primary)] text-black hover:bg-[var(--primary-hover)]"><Send size={16} /></button>
              </div>
            </div>
          )}

          {tab === 'Attachments' && (
            <div className="space-y-2">
              {(delegation.attachments || []).map((a) => (
                <div key={a._id} className="flex items-center gap-3 text-sm bg-[var(--bg)] rounded-lg px-3 py-2">
                  <Paperclip size={14} className="text-[var(--text-muted)]" />
                  <span className="flex-1 truncate">{a.name || a.fileName}</span>
                  <button onClick={() => downloadAtt(a._id)} className="text-[var(--text-muted)] hover:text-[var(--primary-active)]"><Download size={15} /></button>
                  {canUpdate && <button onClick={() => removeAtt(a._id)} className="text-[var(--text-muted)] hover:text-[var(--error)]"><Trash2 size={14} /></button>}
                </div>
              ))}
              {(!delegation.attachments || delegation.attachments.length === 0) && (
                <p className="text-sm text-[var(--text-muted)]">No attachments.</p>
              )}
              {canUpdate && (
                <div className="pt-2">
                  <input ref={fileRef} type="file" onChange={uploadFile} className="text-sm"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv" />
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">PDF, image, or document — up to 20 MB.</p>
                </div>
              )}
            </div>
          )}

          {tab === 'Activity' && (
            <div className="space-y-2 text-sm">
              {activity.map((a) => (
                <div key={a._id} className="flex gap-3 text-xs">
                  <span className="text-[var(--text-muted)] whitespace-nowrap">{fmt(a.createdAt)}</span>
                  <span className="text-[var(--text-secondary)]">
                    <b>{a.actorId?.name || 'User'}</b> — {a.description}
                  </span>
                </div>
              ))}
              {activity.length === 0 && <p className="text-[var(--text-muted)]">No activity yet.</p>}
            </div>
          )}
        </div>
      </div>

      {/* Assign / Reassign modal */}
      <Modal isOpen={assignOpen} onClose={() => setAssignOpen(false)} title={delegation.assignedTo ? 'Reassign delegation' : 'Assign delegation'}>
        <div className="space-y-3">
          <select className="w-full border border-[var(--border)] bg-[var(--surface)] rounded-xl px-3 py-2.5 text-sm" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
            <option value="">Select assignee…</option>
            {assignees.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
          </select>
          {delegation.assignedTo && (
            <input className="w-full border border-[var(--border)] bg-[var(--surface)] rounded-xl px-3 py-2.5 text-sm"
              value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for reassignment" />
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" disabled={busy} onClick={submitAssign}>{delegation.assignedTo ? 'Reassign' : 'Assign'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DelegationDetailPage;
