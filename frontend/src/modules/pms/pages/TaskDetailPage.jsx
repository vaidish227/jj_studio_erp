import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, CheckSquare, Calendar, User, AlertTriangle,
  Send, GitBranch, UserCheck, CheckCircle2, Clock,
  FileText, ExternalLink, RefreshCw, ChevronRight,
  RotateCcw, Play, Users,
} from 'lucide-react';
import { Button, Loader } from '../../../shared/components';
import { useAuth } from '../../../shared/context/AuthContext';
import { useToast } from '../../../shared/notifications/ToastProvider';
import PermissionGate from '../../../shared/components/PermissionGate/PermissionGate';
import useTaskDetail from '../hooks/useTaskDetail';
import { pmsService } from '../../../shared/services/pmsService';
import TaskStatusBadge from '../components/TaskStatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import TaskTypeIcon, { TASK_TYPE_CONFIG } from '../components/TaskTypeIcon';
import DrawingStatusBadge from '../components/DrawingStatusBadge';
import ChecklistPanel from '../components/ChecklistPanel';
import SubmitForReviewModal from '../components/SubmitForReviewModal';
import RequestRevisionModal from '../components/RequestRevisionModal';
import ReassignTaskModal from '../components/ReassignTaskModal';
import UploadDrawingModal from '../components/UploadDrawingModal';

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—';

const fmtTime = (d) => d
  ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—';

// ── Status colour map ────────────────────────────────────────────────────────
const STATUS_META = {
  not_started:           { color: 'var(--text-muted)',    bg: 'var(--border)',           label: 'Not Started' },
  in_progress:           { color: 'var(--accent-blue)',   bg: 'var(--accent-blue)',      label: 'In Progress' },
  pending_review:        { color: 'var(--warning)',       bg: 'var(--warning)',          label: 'Pending Review' },
  revision_requested:    { color: 'var(--error)',         bg: 'var(--error)',            label: 'Revision Requested' },
  pending_client_approval:{ color: 'var(--accent-blue)', bg: 'var(--accent-blue)',      label: 'Client Approval' },
  approved:              { color: 'var(--success)',       bg: 'var(--success)',          label: 'Approved' },
  released_to_site:      { color: 'var(--primary)',       bg: 'var(--primary)',          label: 'Released' },
  completed:             { color: 'var(--success)',       bg: 'var(--success)',          label: 'Completed' },
  on_hold:               { color: 'var(--warning)',       bg: 'var(--warning)',          label: 'On Hold' },
};

// ── Drawing mini-row ─────────────────────────────────────────────────────────
const DrawingRow = ({ drawing }) => (
  <div className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
    <div className="w-7 h-7 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center shrink-0">
      <FileText size={13} className="text-[var(--accent-blue)]" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{drawing.title}</p>
      <p className="text-xs text-[var(--text-muted)]">
        v{drawing.version} · {drawing.drawingType?.replace(/_/g, ' ')}
      </p>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      <DrawingStatusBadge status={drawing.status} />
      {drawing.fileUrl && (
        <a
          href={drawing.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="p-1 rounded-lg hover:bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
          title="Open file"
        >
          <ExternalLink size={13} />
        </a>
      )}
    </div>
  </div>
);

// ── Revision instructions banner ─────────────────────────────────────────────
const RevisionBanner = ({ task }) => {
  if (task.status !== 'revision_requested') return null;
  return (
    <div className="bg-[var(--error)]/5 border border-[var(--error)]/25 rounded-2xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <GitBranch size={14} className="text-[var(--error)]" />
        <p className="text-sm font-bold text-[var(--error)]">Revision Requested</p>
        {task.revisionDeadline && (
          <span className="ml-auto text-xs font-semibold text-[var(--error)] bg-[var(--error)]/10 px-2 py-0.5 rounded-full">
            Due {fmt(task.revisionDeadline)}
          </span>
        )}
      </div>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{task.revisionInstructions}</p>
    </div>
  );
};

// ── Submission notes panel ────────────────────────────────────────────────────
const SubmissionPanel = ({ task }) => {
  if (!task.submittedAt) return null;
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Send size={13} className="text-[var(--primary)]" />
        <p className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">Last Submission</p>
        <span className="ml-auto text-xs text-[var(--text-muted)]">{fmtTime(task.submittedAt)}</span>
      </div>
      {task.submissionNotes ? (
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{task.submissionNotes}</p>
      ) : (
        <p className="text-xs text-[var(--text-muted)] italic">No notes added</p>
      )}
    </div>
  );
};

// ── Main Page ────────────────────────────────────────────────────────────────
const TaskDetailPage = () => {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { user, hasPermission } = useAuth();
  const toast     = useToast();
  const { task, drawings, isLoading, error, refresh } = useTaskDetail(id);

  const [showSubmit,   setShowSubmit]   = useState(false);
  const [showRevision, setShowRevision] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [showUpload,   setShowUpload]   = useState(false);
  const [actioning,    setActioning]    = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertTriangle size={32} className="text-[var(--error)] opacity-60" />
        <p className="text-sm text-[var(--text-muted)]">{error || 'Task not found'}</p>
        <button onClick={() => navigate(-1)} className="text-xs text-[var(--primary)] hover:underline font-semibold">Go back</button>
      </div>
    );
  }

  const isMyTask         = String(task.assignedTo?._id || task.assignedTo) === String(user?._id);
  const canSubmit        = isMyTask && hasPermission('tasks.submit') && ['in_progress', 'revision_requested'].includes(task.status);
  const canStartTask     = isMyTask && task.status === 'not_started';
  const canStartRevision = isMyTask && task.status === 'revision_requested';
  const canApprove       = hasPermission('tasks.approve') && task.status === 'pending_review';
  const canSendToClient  = hasPermission('tasks.approve') && task.status === 'approved';
  const canMarkCompleted = hasPermission('tasks.approve') && task.status === 'pending_client_approval';
  const canReassign      = hasPermission('tasks.reassign');
  const cfg              = TASK_TYPE_CONFIG[task.taskType] || {};
  const isOverdue        = task.dueDate && new Date(task.dueDate) < new Date() && !['approved', 'completed', 'released_to_site'].includes(task.status);

  const handleStartTask = async () => {
    setActioning(true);
    try {
      const res = await pmsService.updateTask(task._id, { status: 'in_progress' });
      toast.success('Task started');
      refresh();
    } catch (e) {
      toast.error(e?.message || 'Failed to start task');
    } finally {
      setActioning(false);
    }
  };

  const handleStartRevision = async () => {
    setActioning(true);
    try {
      await pmsService.updateTask(task._id, { status: 'in_progress' });
      toast.success('Revision started');
      refresh();
    } catch (e) {
      toast.error(e?.message || 'Failed to start revision');
    } finally {
      setActioning(false);
    }
  };

  const handleApprove = async () => {
    setActioning(true);
    try {
      await pmsService.approveTask(task._id, {});
      toast.success('Task approved');
      refresh();
    } catch (e) {
      toast.error(e?.message || 'Failed to approve task');
    } finally {
      setActioning(false);
    }
  };

  const handleSendToClient = async () => {
    setActioning(true);
    try {
      await pmsService.updateTask(task._id, { status: 'pending_client_approval' });
      toast.success('Task sent for client approval');
      refresh();
    } catch (e) {
      toast.error(e?.message || 'Failed to update task');
    } finally {
      setActioning(false);
    }
  };

  const handleMarkCompleted = async () => {
    setActioning(true);
    try {
      await pmsService.updateTask(task._id, { status: 'completed' });
      toast.success('Task marked as completed');
      refresh();
    } catch (e) {
      toast.error(e?.message || 'Failed to update task');
    } finally {
      setActioning(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">

      {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 hover:text-[var(--primary)] transition-colors font-semibold">
          <ArrowLeft size={13} /> Back
        </button>
        <ChevronRight size={11} />
        {task.projectId && (
          <>
            <Link to={`/projects/${task.projectId._id || task.projectId}`}
              className="hover:text-[var(--primary)] transition-colors truncate max-w-[160px]">
              {task.projectId.name || task.projectId.trackingId}
            </Link>
            <ChevronRight size={11} />
          </>
        )}
        <span className="text-[var(--text-secondary)] truncate max-w-[200px]">{task.title}</span>
      </div>

      {/* ── Header card ─────────────────────────────────────────────────────── */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <TaskTypeIcon taskType={task.taskType} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                {cfg.label || task.taskType}
              </span>
              {task.projectId && (
                <>
                  <span className="text-[var(--border)]">·</span>
                  <Link
                    to={`/projects/${task.projectId._id || task.projectId}`}
                    className="text-[10px] text-[var(--primary)] hover:underline font-semibold"
                  >
                    {task.projectId.trackingId}
                  </Link>
                </>
              )}
            </div>
            <h1 className="text-lg font-extrabold text-[var(--text-primary)] leading-snug">{task.title}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <TaskStatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              {task.assignedTo && (
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                  <User size={11} />
                  <span>{task.assignedTo.name}</span>
                </div>
              )}
              {task.dueDate && (
                <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-[var(--error)] font-semibold' : 'text-[var(--text-muted)]'}`}>
                  <Calendar size={11} />
                  <span>{isOverdue ? 'Overdue · ' : ''}{fmt(task.dueDate)}</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={refresh}
            className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--bg)] text-[var(--text-muted)] transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* ── Action bar ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-[var(--border)]">
          {/* Designer actions */}
          {canStartTask && (
            <Button size="sm" onClick={handleStartTask} disabled={actioning}>
              <Play size={13} className="mr-1" />
              Start Task
            </Button>
          )}
          {canStartRevision && (
            <Button size="sm" onClick={handleStartRevision} disabled={actioning}
              className="bg-[var(--warning)] hover:bg-[var(--warning)]/90 text-black">
              <RotateCcw size={13} className="mr-1" />
              Start Revision
            </Button>
          )}
          {canSubmit && (
            <Button size="sm" onClick={() => setShowSubmit(true)} disabled={actioning}>
              <Send size={13} className="mr-1" />
              Submit for Review
            </Button>
          )}
          {(isMyTask || hasPermission('drawings.upload')) && !['approved', 'completed', 'released_to_site'].includes(task.status) && (
            <Button size="sm" variant="ghost" onClick={() => setShowUpload(true)}>
              <FileText size={13} className="mr-1" />
              Upload Drawing
            </Button>
          )}

          {/* Manager actions */}
          {canApprove && (
            <Button size="sm" onClick={handleApprove} disabled={actioning}
              className="bg-[var(--success)] hover:bg-[var(--success)]/90 text-white">
              <CheckCircle2 size={13} className="mr-1" />
              {actioning ? 'Approving…' : 'Approve'}
            </Button>
          )}
          {canApprove && (
            <Button size="sm" onClick={() => setShowRevision(true)} disabled={actioning}
              className="bg-[var(--warning)] hover:bg-[var(--warning)]/90 text-black">
              <GitBranch size={13} className="mr-1" />
              Request Revision
            </Button>
          )}
          {canSendToClient && (
            <Button size="sm" onClick={handleSendToClient} disabled={actioning}
              className="bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white">
              <Users size={13} className="mr-1" />
              {actioning ? 'Updating…' : 'Send for Client Approval'}
            </Button>
          )}
          {canMarkCompleted && (
            <Button size="sm" onClick={handleMarkCompleted} disabled={actioning}
              className="bg-[var(--success)] hover:bg-[var(--success)]/90 text-white">
              <CheckCircle2 size={13} className="mr-1" />
              {actioning ? 'Updating…' : 'Mark as Completed'}
            </Button>
          )}
          {canReassign && !['approved', 'completed', 'released_to_site'].includes(task.status) && (
            <Button size="sm" variant="ghost" onClick={() => setShowReassign(true)}>
              <UserCheck size={13} className="mr-1" />
              Reassign
            </Button>
          )}
        </div>
      </div>

      {/* ── Revision instructions banner ─────────────────────────────────── */}
      <RevisionBanner task={task} />

      {/* ── Submission panel ─────────────────────────────────────────────── */}
      <SubmissionPanel task={task} />

      {/* ── Two-column body ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Left: Notes + Checklist */}
        <div className="space-y-4">
          {task.notes && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
              <p className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)] mb-2">Notes</p>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{task.notes}</p>
            </div>
          )}

          {(task.checklist?.length > 0) && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
              <p className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)] mb-3">
                Checklist
                <span className="ml-2 font-normal text-[var(--text-muted)]">
                  {task.checklist.filter((c) => c.isCompleted).length}/{task.checklist.length}
                </span>
              </p>
              <ChecklistPanel
                taskId={task._id}
                checklist={task.checklist}
                onUpdated={refresh}
                disabled={!isMyTask && !hasPermission('tasks.update')}
              />
            </div>
          )}
        </div>

        {/* Right: Drawings + Timeline */}
        <div className="space-y-4">
          {/* Drawings */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">
                Drawings
                {drawings.length > 0 && (
                  <span className="ml-2 font-normal text-[var(--text-muted)]">{drawings.length}</span>
                )}
              </p>
            </div>
            {drawings.length === 0 ? (
              <div className="text-center py-6 text-[var(--text-muted)]">
                <FileText size={22} className="mx-auto mb-2 opacity-20" />
                <p className="text-xs">No drawings uploaded yet.</p>
              </div>
            ) : (
              drawings.map((d) => <DrawingRow key={d._id} drawing={d} />)
            )}
          </div>

          {/* Task metadata */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
            <p className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)] mb-3">Details</p>
            <div className="space-y-2">
              {[
                { label: 'Status',    value: STATUS_META[task.status]?.label || task.status },
                { label: 'Priority',  value: task.priority || '—' },
                { label: 'Start',     value: fmt(task.startDate) },
                { label: 'Due',       value: fmt(task.dueDate) },
                { label: 'Submitted', value: fmtTime(task.submittedAt) },
                { label: 'Approved',  value: task.approvedAt ? `${fmtTime(task.approvedAt)} by ${task.approvedBy?.name || '—'}` : '—' },
                { label: 'Reassigned from', value: task.reassignedFrom?.name || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start gap-2 text-xs">
                  <span className="w-28 shrink-0 text-[var(--text-muted)] font-semibold">{label}</span>
                  <span className="text-[var(--text-secondary)] capitalize">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <SubmitForReviewModal
        task={task}
        isOpen={showSubmit}
        onClose={() => setShowSubmit(false)}
        onSubmitted={refresh}
      />
      <RequestRevisionModal
        task={task}
        isOpen={showRevision}
        onClose={() => setShowRevision(false)}
        onRevisionRequested={refresh}
      />
      <ReassignTaskModal
        task={task}
        isOpen={showReassign}
        onClose={() => setShowReassign(false)}
        onReassigned={refresh}
      />
      {showUpload && (
        <UploadDrawingModal
          isOpen={showUpload}
          onClose={() => setShowUpload(false)}
          projectId={task.projectId?._id || task.projectId}
          taskId={task._id}
          onUploaded={refresh}
        />
      )}
    </div>
  );
};

export default TaskDetailPage;
