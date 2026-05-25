import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck, ClipboardCheck, CheckCircle2, XCircle, Clock,
  GitBranch, UserCheck, FileText, User, Calendar,
  ExternalLink, AlertTriangle, ChevronRight, RefreshCw,
} from 'lucide-react';
import { Button, Loader } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { useAuth } from '../../../shared/context/AuthContext';
import { pmsService } from '../../../shared/services/pmsService';
import useReviewQueue from '../hooks/useReviewQueue';
import TaskTypeIcon, { TASK_TYPE_CONFIG } from '../components/TaskTypeIcon';
import PriorityBadge from '../components/PriorityBadge';
import DrawingStatusBadge from '../components/DrawingStatusBadge';
import RequestRevisionModal from '../components/RequestRevisionModal';
import ReassignTaskModal from '../components/ReassignTaskModal';

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
  : '—';

const fmtTime = (d) => d
  ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—';

// ═══════════════════════════════════════════════════════════════════════════════
// REVIEW QUEUE TAB
// ═══════════════════════════════════════════════════════════════════════════════

const DrawingChip = ({ drawing }) => (
  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
    <FileText size={11} className="text-[var(--accent-blue)] shrink-0" />
    <span className="text-xs text-[var(--text-secondary)] truncate max-w-[120px]">{drawing.title}</span>
    <DrawingStatusBadge status={drawing.status} />
    {drawing.fileUrl && (
      <a href={drawing.fileUrl} target="_blank" rel="noreferrer"
        className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
        onClick={(e) => e.stopPropagation()}>
        <ExternalLink size={11} />
      </a>
    )}
  </div>
);

const ReviewCard = ({ task, onApproved, onRevision, onReassign }) => {
  const navigate  = useNavigate();
  const toast     = useToast();
  const [approving, setApproving] = useState(false);
  const cfg = TASK_TYPE_CONFIG[task.taskType] || {};

  const handleApprove = async (e) => {
    e.stopPropagation();
    setApproving(true);
    try {
      await pmsService.approveTask(task._id, {});
      toast.success(`Task "${task.title}" approved`);
      onApproved?.(task._id);
    } catch (err) {
      toast.error(err?.message || 'Failed to approve');
    } finally {
      setApproving(false);
    }
  };

  return (
    <div
      className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5
                 hover:border-[var(--primary)]/40 transition-all cursor-pointer group"
      onClick={() => navigate(`/tasks/${task._id}`)}
    >
      {/* Top row */}
      <div className="flex items-start gap-3 mb-3">
        <TaskTypeIcon taskType={task.taskType} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-0.5">
            {cfg.label || task.taskType}
          </p>
          <p className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors truncate">
            {task.title}
          </p>
          {task.projectId && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {task.projectId.name}
              <span className="ml-1 opacity-60">· {task.projectId.trackingId}</span>
            </p>
          )}
        </div>
        <PriorityBadge priority={task.priority} />
        <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors shrink-0 mt-0.5" />
      </div>

      {/* Meta */}
      <div className="flex items-center gap-4 flex-wrap mb-3 text-xs text-[var(--text-muted)]">
        {task.assignedTo && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[9px] font-black text-[var(--primary)] uppercase shrink-0">
              {task.assignedTo.name?.[0] || <User size={9} />}
            </div>
            <span>{task.assignedTo.name}</span>
            <span className="opacity-50">·</span>
            <span className="capitalize opacity-75">{task.assignedTo.role}</span>
          </div>
        )}
        {task.submittedAt && (
          <div className="flex items-center gap-1">
            <Calendar size={10} />
            <span>Submitted {fmtTime(task.submittedAt)}</span>
          </div>
        )}
        {task.dueDate && <span>Due {fmt(task.dueDate)}</span>}
      </div>

      {/* Submission notes */}
      {task.submissionNotes && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic">
            "{task.submissionNotes}"
          </p>
        </div>
      )}

      {/* Drawings */}
      {task.drawings?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {task.drawings.map((d) => <DrawingChip key={d._id} drawing={d} />)}
        </div>
      )}

      {/* Actions */}
      <div
        className="flex flex-wrap gap-2 pt-3 border-t border-[var(--border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          size="sm"
          onClick={handleApprove}
          disabled={approving}
          className="bg-[var(--success)] hover:bg-[var(--success)]/90 text-white"
        >
          <CheckCircle2 size={13} className="mr-1" />
          {approving ? 'Approving…' : 'Approve'}
        </Button>
        <Button
          size="sm"
          onClick={(e) => { e.stopPropagation(); onRevision(task); }}
          className="bg-[var(--warning)] hover:bg-[var(--warning)]/90 text-black"
        >
          <GitBranch size={13} className="mr-1" />
          Request Revision
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onReassign(task); }}
        >
          <UserCheck size={13} className="mr-1" />
          Reassign
        </Button>
      </div>
    </div>
  );
};

const ReviewQueueTab = () => {
  const { tasks, isLoading, error, total, refresh } = useReviewQueue({});
  const [revisionTask, setRevisionTask] = useState(null);
  const [reassignTask, setReassignTask] = useState(null);

  return (
    <div className="space-y-4">
      {/* Sub-header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-[var(--text-muted)]">
          Tasks submitted by designers awaiting your review
        </p>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className="text-xs font-bold bg-[var(--warning)]/10 text-[var(--warning)] px-3 py-1 rounded-full">
              {total} pending
            </span>
          )}
          <button
            onClick={refresh}
            className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--bg)] text-[var(--text-muted)] transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-16"><Loader label="Loading review queue…" /></div>}

      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertTriangle size={26} className="text-[var(--error)] opacity-60" />
          <p className="text-sm text-[var(--text-muted)]">{error}</p>
          <button onClick={refresh} className="text-xs text-[var(--primary)] hover:underline font-semibold">Retry</button>
        </div>
      )}

      {!isLoading && !error && tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--success)]/10 flex items-center justify-center mb-4">
            <CheckCircle2 size={26} className="text-[var(--success)]" />
          </div>
          <p className="text-sm font-bold text-[var(--text-primary)] mb-1">All caught up!</p>
          <p className="text-xs text-[var(--text-muted)]">No tasks are currently waiting for review.</p>
        </div>
      )}

      {!isLoading && tasks.length > 0 && (
        <div className="space-y-4">
          {tasks.map((task) => (
            <ReviewCard
              key={task._id}
              task={task}
              onApproved={refresh}
              onRevision={setRevisionTask}
              onReassign={setReassignTask}
            />
          ))}
        </div>
      )}

      <RequestRevisionModal
        task={revisionTask}
        isOpen={!!revisionTask}
        onClose={() => setRevisionTask(null)}
        onRevisionRequested={() => { setRevisionTask(null); refresh(); }}
      />
      <ReassignTaskModal
        task={reassignTask}
        isOpen={!!reassignTask}
        onClose={() => setReassignTask(null)}
        onReassigned={() => { setReassignTask(null); refresh(); }}
      />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT APPROVALS TAB
// ═══════════════════════════════════════════════════════════════════════════════

const APPROVAL_STATUS_CFG = {
  pending:               { label: 'Pending',             icon: Clock,        color: 'text-[var(--warning)]',     bg: 'bg-[var(--warning)]/10' },
  approved:              { label: 'Approved',            icon: CheckCircle2, color: 'text-[var(--success)]',     bg: 'bg-[var(--success)]/10' },
  rejected:              { label: 'Rejected',            icon: XCircle,      color: 'text-[var(--error)]',       bg: 'bg-[var(--error)]/10' },
  approved_with_changes: { label: 'Approved w/ Changes', icon: CheckCircle2, color: 'text-[var(--accent-blue)]', bg: 'bg-[var(--accent-blue)]/10' },
};

const TARGET_LABELS = { drawing: 'Drawing', concept: 'Concept', material: 'Material', quotation: 'Quotation' };
const APPROVER_LABELS = { client: 'Client', manager: 'Manager', principal_designer: 'Principal Designer' };

const ApprovalStatusBadge = ({ status }) => {
  const cfg = APPROVAL_STATUS_CFG[status] || APPROVAL_STATUS_CFG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
};

const RespondModal = ({ approval, onClose, onRespond }) => {
  const [status,   setStatus]   = useState('approved');
  const [comments, setComments] = useState('');
  const [saving,   setSaving]   = useState(false);

  const submit = async () => {
    setSaving(true);
    try { await onRespond(approval._id, { status, comments }); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Respond to Approval Request</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Decision *</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]">
              <option value="approved">Approve</option>
              <option value="approved_with_changes">Approve with Changes</option>
              <option value="rejected">Reject</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Comments</label>
            <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3}
              placeholder="Add feedback or reason…"
              className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Submit'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ClientApprovalsTab = () => {
  const { user } = useAuth();
  const toast    = useToast();
  const [approvals,   setApprovals]   = useState([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [filter,      setFilter]      = useState('pending');
  const [responding,  setResponding]  = useState(null);

  const fetchApprovals = useCallback(async () => {
    if (!user?._id) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const res = await pmsService.getPendingApprovalsByUser(user._id);
      setApprovals(res.approvals || []);
    } catch {
      toast.error('Failed to load approvals');
    } finally {
      setIsLoading(false);
    }
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  const handleRespond = async (id, data) => {
    try {
      await pmsService.respondToApproval(id, data);
      toast.success('Response submitted');
      fetchApprovals();
    } catch (e) {
      toast.error(e || 'Failed to respond');
    }
  };

  const displayed     = filter === 'all' ? approvals : approvals.filter((a) => a.status === filter);
  const pendingCount  = approvals.filter((a) => a.status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* Sub-header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-[var(--text-muted)]">
          Review and respond to approval requests across all projects
        </p>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="text-xs font-bold bg-[var(--warning)]/10 text-[var(--warning)] px-3 py-1 rounded-full">
              {pendingCount} pending
            </span>
          )}
          <button
            onClick={fetchApprovals}
            className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--bg)] text-[var(--text-muted)] transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border)]">
        {['pending', 'approved', 'rejected', 'all'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors capitalize
              ${filter === f
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}>
            {f === 'all' ? 'All' : APPROVAL_STATUS_CFG[f]?.label || f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader label="Loading approvals…" /></div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--success)]/10 flex items-center justify-center mb-3">
            <CheckCircle2 size={22} className="text-[var(--success)]" />
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
            {filter === 'pending' ? 'No pending approvals' : 'No approvals found'}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {filter === 'pending' ? 'You\'re all caught up.' : 'Try changing the filter above.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((a) => (
            <div key={a._id} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                      {TARGET_LABELS[a.targetType] || a.targetType}
                    </span>
                    <span className="text-[var(--border)]">·</span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      Requested by {APPROVER_LABELS[a.approverType] || a.approverType}
                    </span>
                  </div>
                  {a.projectId && (
                    <Link to={`/projects/${a.projectId._id || a.projectId}`}
                      className="text-sm font-bold text-[var(--primary)] hover:underline flex items-center gap-1">
                      {a.projectId.name || 'View Project'} <ChevronRight size={12} />
                    </Link>
                  )}
                  {a.requestedBy && (
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">From: {a.requestedBy.name}</p>
                  )}
                  {a.comments && (
                    <p className="text-xs text-[var(--text-secondary)] mt-1.5 italic">"{a.comments}"</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <ApprovalStatusBadge status={a.status} />
                  <p className="text-[10px] text-[var(--text-muted)]">{fmt(a.createdAt)}</p>
                </div>
              </div>
              {a.status === 'pending' && (
                <div className="pt-3 border-t border-[var(--border)]">
                  <Button size="sm" onClick={() => setResponding(a)}>Respond</Button>
                </div>
              )}
              {a.status !== 'pending' && a.response?.comments && (
                <div className="pt-3 border-t border-[var(--border)]">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-0.5">Response</p>
                  <p className="text-xs text-[var(--text-secondary)]">{a.response.comments}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {responding && (
        <RespondModal
          approval={responding}
          onClose={() => setResponding(null)}
          onRespond={handleRespond}
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'review',    label: 'Review Queue',     icon: ClipboardCheck },
  { id: 'approvals', label: 'Client Approvals', icon: ShieldCheck },
];

const ReviewDesignPage = () => {
  const [activeTab, setActiveTab] = useState('review');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* ── Page Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
          <ShieldCheck size={20} className="text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Approval / Review Design</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Review designer submissions and manage approval requests
          </p>
        </div>
      </div>

      {/* ── Tab Pills ── */}
      <div className="flex items-center gap-1 p-1 bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all
              ${activeTab === id
                ? 'bg-[var(--primary)] text-black shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div>
        {activeTab === 'review'    && <ReviewQueueTab />}
        {activeTab === 'approvals' && <ClientApprovalsTab />}
      </div>
    </div>
  );
};

export default ReviewDesignPage;
