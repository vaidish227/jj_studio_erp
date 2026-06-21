import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Plus, Trash2, Paperclip, Download, Send, Check,
  CalendarDays, FileText, ListChecks, MessageSquare, History,
  Play, Eye, CheckCircle2, RotateCcw, X, Users, UserCheck, Flag, User,
  BarChart3, AlignLeft, Clock, CircleDot, ArrowLeftRight,
} from 'lucide-react';
import Modal from '../../../shared/components/Modal/Modal';
import Button from '../../../shared/components/Button/Button';
import { useAuth } from '../../../shared/context/AuthContext';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { useDelegationDetail } from '../hooks/useDelegationDetail';
import { delegationService } from '../services/delegationService';
import { DelegationStatusBadge, PriorityChip } from '../components/DelegationStatusBadge';
import { InitialsAvatar, ProgressRing } from '../components/delegationVisuals';
import {
  relativeTime, fmtDateTimeShort, dueDateInfo,
} from '../components/delegationFormat';
import { ALLOWED_TRANSITIONS, TRANSITION_LABEL } from '../constants/delegationStatus';

const TABS = [
  { key: 'Overview', icon: FileText },
  { key: 'Checklist', icon: ListChecks },
  { key: 'Comments', icon: MessageSquare },
  { key: 'Attachments', icon: Paperclip },
  { key: 'Activity', icon: History },
];

// Per-transition visual meta — drives header buttons + sidebar quick actions.
const TRANSITION_META = {
  assigned:    { icon: UserCheck,    quickLabel: 'Mark as Assigned',     color: 'var(--primary-active)' },
  in_progress: { icon: Play,         quickLabel: 'Mark as In Progress',  color: 'var(--success)' },
  review:      { icon: Eye,          quickLabel: 'Move to Review',       color: 'var(--accent-blue)' },
  completed:   { icon: CheckCircle2, quickLabel: 'Mark as Completed',    color: 'var(--success)' },
  reopened:    { icon: RotateCcw,    quickLabel: 'Reopen',               color: 'var(--error)' },
  cancelled:   { icon: X,            quickLabel: 'Cancel Delegation',    color: 'var(--error)' },
};

// Activity action → timeline icon + accent color.
const ACTIVITY_META = {
  created:           { icon: Plus,         color: 'var(--primary-active)' },
  assigned:          { icon: UserCheck,    color: 'var(--success)' },
  reassigned:        { icon: Users,        color: 'var(--accent-blue)' },
  status_changed:    { icon: CheckCircle2, color: 'var(--success)' },
  commented:         { icon: MessageSquare,color: 'var(--accent-blue)' },
  attachment_added:  { icon: Paperclip,    color: 'var(--warning)' },
  checklist_updated: { icon: ListChecks,   color: 'var(--primary-active)' },
  reopened:          { icon: RotateCcw,    color: 'var(--error)' },
  cancelled:         { icon: X,            color: 'var(--error)' },
};
const activityMeta = (a) => ACTIVITY_META[a?.action] || { icon: CircleDot, color: 'var(--text-muted)' };

const DUE_TONE = {
  overdue: 'var(--error)',
  soon: 'var(--warning)',
  normal: 'var(--text-secondary)',
};

const DelegationDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
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
  const checklist = delegation.checklist || [];
  const doneCount = checklist.filter((c) => c.isCompleted).length;
  // Progress is backend-authoritative (delegation.progressPercent). The fallback
  // recomputes from the checklist when the field is absent, and the final guard is
  // a safety net for historical records persisted before progress became
  // status-aware: a completed delegation with no checklist still showing 0 → 100%.
  const computedProgress = delegation.progressPercent ?? (checklist.length ? Math.round((doneCount / checklist.length) * 100) : 0);
  const progress = (delegation.status === 'completed' && checklist.length === 0 && !computedProgress) ? 100 : computedProgress;
  const due = dueDateInfo(delegation.dueDate, delegation.status);
  const canAct = canUpdate || canAssign || canReassign;
  const showReassign = (canAssign || canReassign) && delegation.status !== 'cancelled';

  // Header action buttons: forward transitions filled, cancel ghost, reassign outlined.
  const headerActions = canUpdate ? nextStatuses : [];

  // Sidebar quick actions = same allowed transitions + reassign (with reassign last).
  const quickActions = [
    ...headerActions.map((s) => ({ key: s, kind: 'status' })),
    ...(showReassign ? [{ key: 'reassign', kind: 'assign' }] : []),
  ];

  // Plain render helper (not a component) — reused in the header + details row.
  const renderDue = () =>
    !due ? (
      <span className="text-[var(--text-muted)]">—</span>
    ) : (
      <span className="font-semibold" style={{ color: DUE_TONE[due.tone] }}>
        {due.label}
        <span className="ml-1 text-xs font-bold">({due.relative})</span>
      </span>
    );

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <button onClick={() => navigate('/delegation/list')} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors">
        <ArrowLeft size={15} /> Back to Delegations
      </button>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {/* ─── MAIN COLUMN ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header card */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-[var(--text-muted)] bg-[var(--bg)] rounded px-1.5 py-0.5">{delegation.trackingId}</span>
                  <DelegationStatusBadge status={delegation.status} />
                  <PriorityChip priority={delegation.priority} />
                </div>
                <h1 className="text-2xl font-extrabold text-[var(--text-primary)] mt-2 leading-tight">{delegation.title}</h1>
                <div className="text-xs mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <InitialsAvatar name={delegation.assignedTo?.name} size={22} />
                    <span className="text-[var(--text-secondary)] font-semibold">{delegation.assignedTo?.name || 'Unassigned'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={14} className="text-[var(--text-muted)]" />
                    <span className="text-[var(--text-secondary)]">Due</span> {renderDue()}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-center shrink-0">
                <ProgressRing value={progress} size={76} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mt-1">Overall Progress</span>
              </div>
            </div>

            {/* Action buttons */}
            {canAct && (headerActions.length > 0 || showReassign) && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--border)]">
                {headerActions.filter((s) => s !== 'cancelled').map((s, i) => {
                  const M = TRANSITION_META[s] || {};
                  const Icon = M.icon;
                  return (
                    <Button key={s} size="sm" variant={i === 0 ? 'primary' : 'outline'} disabled={busy} onClick={() => changeStatus(s)}>
                      {Icon && <Icon size={15} />} {TRANSITION_LABEL[s] || s}
                    </Button>
                  );
                })}
                {showReassign && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setAssignOpen(true)}>
                    <ArrowLeftRight size={15} /> {delegation.assignedTo ? 'Reassign' : 'Assign'}
                  </Button>
                )}
                {headerActions.includes('cancelled') && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => changeStatus('cancelled')}>
                    <X size={15} /> Cancel
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Tabs card */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm">
            <div className="flex gap-1 border-b border-[var(--border)] px-2 overflow-x-auto overflow-y-hidden">
              {TABS.map(({ key, icon: Icon }) => {
                const count =
                  key === 'Checklist' && checklist.length ? `${doneCount}/${checklist.length}` :
                  key === 'Comments' && comments.length ? comments.length :
                  key === 'Attachments' && delegation.attachments?.length ? delegation.attachments.length : null;
                const active = tab === key;
                return (
                  <button key={key} onClick={() => setTab(key)}
                    className={`px-4 py-3 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap flex items-center gap-1.5 transition-colors ${active ? 'text-[var(--primary-active)] border-[var(--primary)]' : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]'}`}>
                    <Icon size={15} />
                    {key}
                    {count != null && (
                      <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${active ? 'bg-[var(--primary)]/15 text-[var(--primary-active)]' : 'bg-[var(--bg)] text-[var(--text-muted)]'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-5">
              {tab === 'Overview' && (
                <div className="space-y-6">
                  {/* Description */}
                  <section>
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
                      <AlignLeft size={14} /> Description
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                      {delegation.description || 'No description provided.'}
                    </p>
                  </section>

                  {/* Meta tiles — leading icon/avatar + label-over-value */}
                  <section className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      {
                        label: 'Created By',
                        lead: <InitialsAvatar name={delegation.createdBy?.name} size={32} />,
                        value: delegation.createdBy?.name || '—',
                      },
                      { label: 'Created On', icon: CalendarDays, value: fmtDateTimeShort(delegation.createdAt) },
                      { label: 'Last Updated', icon: Clock, value: fmtDateTimeShort(delegation.updatedAt) },
                    ].map((m) => (
                      <div key={m.label} className="bg-[var(--bg)] rounded-xl px-3.5 py-3 flex items-center gap-2.5">
                        {m.lead || (
                          <span className="w-8 h-8 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
                            <m.icon size={15} />
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{m.label}</div>
                          <div className="text-sm text-[var(--text-secondary)] font-semibold mt-0.5 truncate">{m.value}</div>
                        </div>
                      </div>
                    ))}
                  </section>

                  {/* Details list */}
                  <section>
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
                      <ListChecks size={14} /> Details
                    </h3>
                    <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                      {[
                        { icon: Flag, label: 'Priority', node: <PriorityChip priority={delegation.priority} /> },
                        { icon: User, label: 'Assigned To', node: (
                          <span className="inline-flex items-center gap-1.5">
                            <InitialsAvatar name={delegation.assignedTo?.name} size={20} />
                            <span className="font-semibold text-[var(--text-secondary)]">{delegation.assignedTo?.name || 'Unassigned'}</span>
                          </span>
                        ) },
                        { icon: BarChart3, label: 'Status', node: <DelegationStatusBadge status={delegation.status} /> },
                        { icon: CalendarDays, label: 'Due Date', node: renderDue() },
                        { icon: User, label: 'Created By', node: <span className="font-semibold text-[var(--text-secondary)]">{delegation.createdBy?.name || '—'}</span> },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between gap-3 px-1 py-3 text-sm">
                          <span className="inline-flex items-center gap-2.5 text-[var(--text-muted)] font-medium">
                            <row.icon size={16} /> {row.label}
                          </span>
                          <span className="text-right">{row.node}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {tab === 'Checklist' && (
                <div className="space-y-3">
                  {checklist.length > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-[var(--bg)] rounded-full overflow-hidden border border-[var(--border)]">
                        <div className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-500" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs font-bold text-[var(--text-muted)] tabular-nums">{doneCount}/{checklist.length}</span>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {checklist.map((c) => (
                      <div key={c._id} className="group flex items-center gap-3 text-sm rounded-xl px-2 py-2 hover:bg-[var(--bg)] transition-colors">
                        <button
                          type="button"
                          disabled={!canUpdate || busy}
                          onClick={() => toggleItem(c._id)}
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${c.isCompleted ? 'bg-[var(--primary)] border-[var(--primary)] text-black' : 'border-[var(--divider)] hover:border-[var(--primary)]'} ${!canUpdate ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          {c.isCompleted && <Check size={13} strokeWidth={3} />}
                        </button>
                        <span className={`flex-1 ${c.isCompleted ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'}`}>{c.item}</span>
                        {canUpdate && (
                          <button onClick={() => removeItem(c._id)} className="text-[var(--text-muted)] hover:text-[var(--error)] opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                        )}
                      </div>
                    ))}
                    {checklist.length === 0 && <p className="text-sm text-[var(--text-muted)] py-2">No checklist items yet.</p>}
                  </div>
                  {canUpdate && (
                    <div className="flex gap-2 pt-1">
                      <input className="flex-1 border border-[var(--border)] bg-[var(--surface)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                        value={newItem} onChange={(e) => setNewItem(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }} placeholder="Add checklist item…" />
                      <button onClick={addItem} disabled={busy} className="px-3.5 rounded-xl border border-[var(--border)] hover:bg-[var(--bg)] text-[var(--text-secondary)]"><Plus size={16} /></button>
                    </div>
                  )}
                </div>
              )}

              {tab === 'Comments' && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {comments.map((c) => {
                      const mine = c.authorId?._id && user?._id && c.authorId._id === user._id;
                      return (
                        <div key={c._id} className={`flex gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
                          <InitialsAvatar name={c.authorId?.name || ''} size={30} />
                          <div className={`max-w-[80%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                            <div className={`flex items-center gap-2 text-[11px] text-[var(--text-muted)] mb-1 ${mine ? 'flex-row-reverse' : ''}`}>
                              <b className="text-[var(--text-secondary)]">{mine ? 'You' : (c.authorId?.name || 'User')}</b>
                              <span>{relativeTime(c.createdAt)}</span>
                            </div>
                            <p className={`text-sm whitespace-pre-wrap rounded-2xl px-3.5 py-2 ${mine ? 'bg-[var(--primary)]/15 text-[var(--text-primary)] rounded-tr-sm' : 'bg-[var(--bg)] text-[var(--text-primary)] rounded-tl-sm'}`}>{c.body}</p>
                          </div>
                        </div>
                      );
                    })}
                    {comments.length === 0 && <p className="text-sm text-[var(--text-muted)] py-2">No comments yet. Start the conversation.</p>}
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-[var(--border)]">
                    <input className="flex-1 border border-[var(--border)] bg-[var(--surface)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                      value={comment} onChange={(e) => setComment(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addComment(); }} placeholder="Write a comment…" />
                    <button onClick={addComment} disabled={busy} className="px-3.5 rounded-xl bg-[var(--primary)] text-black hover:bg-[var(--primary-hover)] transition-colors"><Send size={16} /></button>
                  </div>
                </div>
              )}

              {tab === 'Attachments' && (
                <div className="space-y-2">
                  {(delegation.attachments || []).map((a) => (
                    <div key={a._id} className="group flex items-center gap-3 text-sm bg-[var(--bg)] rounded-xl px-3.5 py-2.5 hover:shadow-sm transition-shadow">
                      <span className="w-9 h-9 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--primary-active)] shrink-0">
                        <Paperclip size={15} />
                      </span>
                      <span className="flex-1 truncate text-[var(--text-secondary)] font-semibold">{a.name || a.fileName}</span>
                      <button onClick={() => downloadAtt(a._id)} className="text-[var(--text-muted)] hover:text-[var(--primary-active)] transition-colors"><Download size={16} /></button>
                      {canUpdate && <button onClick={() => removeAtt(a._id)} className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"><Trash2 size={14} /></button>}
                    </div>
                  ))}
                  {(!delegation.attachments || delegation.attachments.length === 0) && (
                    <p className="text-sm text-[var(--text-muted)] py-2">No attachments yet.</p>
                  )}
                  {canUpdate && (
                    <label className="mt-2 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-[var(--border)] rounded-2xl py-6 cursor-pointer hover:border-[var(--primary)]/50 hover:bg-[var(--bg)]/50 transition-colors">
                      <Paperclip size={20} className="text-[var(--text-muted)]" />
                      <span className="text-sm font-semibold text-[var(--text-secondary)]">Click to upload a file</span>
                      <span className="text-[11px] text-[var(--text-muted)]">PDF, image, or document — up to 20 MB.</span>
                      <input ref={fileRef} type="file" onChange={uploadFile} className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv" />
                    </label>
                  )}
                </div>
              )}

              {tab === 'Activity' && (
                <ul className="relative space-y-4">
                  {activity.length > 0 && <span className="absolute left-[15px] top-2 bottom-2 w-px bg-[var(--border)]" aria-hidden />}
                  {activity.map((a) => {
                    const M = activityMeta(a);
                    return (
                      <li key={a._id} className="relative flex gap-3">
                        <span
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative z-10 ring-4 ring-[var(--surface)] text-white"
                          style={{ background: M.color }}
                        >
                          <M.icon size={15} />
                        </span>
                        <div className="min-w-0 flex-1 pt-1">
                          <p className="text-sm text-[var(--text-secondary)] leading-snug">{a.description}</p>
                          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                            by <b className="text-[var(--text-secondary)]">{a.actorId?.name || 'User'}</b> · {fmtDateTimeShort(a.createdAt)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  {activity.length === 0 && <p className="text-[var(--text-muted)] text-sm">No activity yet.</p>}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* ─── SIDEBAR ─────────────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-6">
          {/* Quick Actions */}
          {canAct && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-extrabold text-[var(--text-primary)] mb-3">Quick Actions</h3>
              {quickActions.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">No actions available for this status.</p>
              ) : (
                <div className="space-y-1.5">
                  {quickActions.map((qa) => {
                    if (qa.kind === 'assign') {
                      return (
                        <button key="reassign" disabled={busy} onClick={() => setAssignOpen(true)}
                          className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg)] transition-colors disabled:opacity-50">
                          <Users size={18} className="shrink-0" style={{ color: 'var(--primary-active)' }} />
                          {delegation.assignedTo ? 'Reassign' : 'Assign'}
                        </button>
                      );
                    }
                    const M = TRANSITION_META[qa.key] || {};
                    const Icon = M.icon || CircleDot;
                    return (
                      <button key={qa.key} disabled={busy} onClick={() => changeStatus(qa.key)}
                        className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg)] transition-colors disabled:opacity-50">
                        <Icon size={18} className="shrink-0" style={{ color: M.color }} />
                        {M.quickLabel || qa.key}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Delegation Summary */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-extrabold text-[var(--text-primary)] mb-3">Delegation Summary</h3>
            <div className="space-y-3 text-sm">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-[var(--text-muted)] font-medium"><ListChecks size={15} /> Checklist Progress</span>
                  <span className="font-bold text-[var(--text-secondary)] tabular-nums">{doneCount} of {checklist.length}</span>
                </div>
                <div className="h-1.5 mt-2 bg-[var(--bg)] rounded-full overflow-hidden border border-[var(--border)]">
                  <div className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
              {[
                { icon: MessageSquare, label: 'Comments', value: comments.length },
                { icon: Paperclip, label: 'Attachments', value: delegation.attachments?.length || 0 },
                { icon: History, label: 'Total Activity', value: activity.length },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-[var(--text-muted)] font-medium"><s.icon size={15} /> {s.label}</span>
                  <span className="font-bold text-[var(--text-secondary)] tabular-nums">{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline (latest 5) */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-extrabold text-[var(--text-primary)] mb-3">Timeline <span className="text-[var(--text-muted)] font-medium text-xs">(Latest Activity)</span></h3>
            {activity.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No activity yet.</p>
            ) : (
              <ul className="relative space-y-4">
                <span className="absolute left-[13px] top-2 bottom-2 w-px bg-[var(--border)]" aria-hidden />
                {activity.slice(0, 5).map((a) => {
                  const M = activityMeta(a);
                  return (
                    <li key={a._id} className="relative flex gap-3">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 relative z-10 ring-4 ring-[var(--surface)] text-white"
                        style={{ background: M.color }}
                      >
                        <M.icon size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[var(--text-secondary)] leading-snug">{a.description}</p>
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">by {a.actorId?.name || 'User'} · {fmtDateTimeShort(a.createdAt)}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {/* Assign / Reassign modal */}
      <Modal isOpen={assignOpen} onClose={() => setAssignOpen(false)} title={delegation.assignedTo ? 'Reassign delegation' : 'Assign delegation'}>
        <div className="space-y-3">
          <select className="w-full border border-[var(--border)] bg-[var(--surface)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
            <option value="">Select assignee…</option>
            {assignees.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
          </select>
          {delegation.assignedTo && (
            <input className="w-full border border-[var(--border)] bg-[var(--surface)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
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
