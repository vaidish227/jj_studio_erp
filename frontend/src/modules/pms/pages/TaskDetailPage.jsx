import React, { useState, useEffect } from 'react';
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
import RequestRevisionFlow from '../components/RequestRevisionFlow';
import ReassignTaskModal from '../components/ReassignTaskModal';
import UploadDrawingModal from '../components/UploadDrawingModal';
import KitchenRoutingPanel from '../components/KitchenRoutingPanel';
import DrawingFileLink from '../components/DrawingFileLink';
import AskAIButton from '../../ai/components/AskAIButton';
import { resolveEntry } from '../../ai/aiEntryPoints';
import { getLatestDrawingForTask, taskTypeToDrawingType } from '../utils/workItem';

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—';

const fmtTime = (d) => d
  ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—';

// ── Drawing mini-row ─────────────────────────────────────────────────────────
// Drawings arrive newest-version-first (backend sorts version desc), so the
// list itself is the revision history. Each row surfaces the rejection reason
// (revision instructions) or submission notes for that version.
const DrawingRow = ({ drawing }) => (
  <div className="py-2.5 border-b border-[var(--border)] last:border-0">
    <div className="flex items-center gap-3">
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
          <DrawingFileLink
            drawing={drawing}
            className="p-1 rounded-lg hover:bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
            title="Open file"
          >
            <ExternalLink size={13} />
          </DrawingFileLink>
        )}
      </div>
    </div>
    {drawing.status === 'rejected' && drawing.rejectionReason && (
      <p className="mt-1.5 ml-10 text-[11px] text-[var(--error)] bg-[var(--error)]/5 border border-[var(--error)]/20 rounded px-2 py-1 leading-snug">
        <span className="font-bold">Revision: </span>{drawing.rejectionReason}
      </p>
    )}
    {drawing.status === 'sent_for_approval' && drawing.submissionNotes && (
      <p className="mt-1.5 ml-10 text-[11px] text-[var(--text-secondary)] bg-[var(--warning)]/5 border border-[var(--warning)]/20 rounded px-2 py-1 leading-snug">
        <span className="font-bold">Notes: </span>{drawing.submissionNotes}
      </p>
    )}
  </div>
);

// ── Consistent section header (icon chip + label + optional count) ───────────
const SectionHeader = ({ icon: Icon, title, count, accent = 'var(--primary)', children }) => (
  <div className="flex items-center gap-2 mb-3">
    <div
      className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
      style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)` }}
    >
      <Icon size={13} style={{ color: accent }} />
    </div>
    <p className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">{title}</p>
    {count != null && (
      <span className="text-xs font-bold text-[var(--text-muted)]">{count}</span>
    )}
    {children && <div className="ml-auto">{children}</div>}
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

  // Phase 2 — Kitchen routing children: load sibling tasks so the branch timeline
  // can render. Only fetches when the current task is kitchen_drawing.
  const [siblingTasks, setSiblingTasks] = useState([]);
  useEffect(() => {
    if (!task || task.taskType !== 'kitchen_drawing') {
      setSiblingTasks([]);
      return;
    }
    const projectId = task.projectId?._id || task.projectId;
    if (!projectId) return;
    pmsService.getTasksByProject(projectId)
      .then((res) => setSiblingTasks(res.tasks || []))
      .catch(() => setSiblingTasks([]));
  }, [task?.taskType, task?.projectId?._id || task?.projectId, task?.routing]);

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
  // A review needs something to review — block Submit when there are no
  // linked drawings. UI disables the button; backend rejects 400 as a
  // defense-in-depth backup.
  const hasDrawings      = (drawings?.length || 0) > 0;
  const latestDrawing    = getLatestDrawingForTask(drawings);
  const canSubmit        = isMyTask && hasPermission('tasks.submit') && ['in_progress', 'revision_requested'].includes(task.status);
  const submitBlockedReason = canSubmit && !hasDrawings
    ? 'Upload a drawing first — a review needs something to review.'
    : null;
  const canStartTask     = isMyTask && task.status === 'not_started';
  const canStartRevision = isMyTask && task.status === 'revision_requested';
  const canApprove       = hasPermission('tasks.approve') && task.status === 'pending_review';
  const canSendToClient  = hasPermission('tasks.approve') && task.status === 'approved';
  const canMarkCompleted = hasPermission('tasks.approve') && task.status === 'pending_client_approval';
  const canReassign      = hasPermission('tasks.reassign');
  const cfg              = TASK_TYPE_CONFIG[task.taskType] || {};
  const isOverdue        = task.dueDate && new Date(task.dueDate) < new Date() && !['approved', 'completed', 'released_to_site'].includes(task.status);
  const checklistTotal   = task.checklist?.length || 0;
  const checklistDone    = task.checklist?.filter((c) => c.isCompleted).length || 0;
  const checklistPct     = checklistTotal ? Math.round((checklistDone / checklistTotal) * 100) : 0;

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

        {/* ── Summary strip ───────────────────────────────────────────────── */}
        {(checklistTotal > 0 || drawings.length > 0 || task.submittedAt) && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-5 pt-4 border-t border-[var(--border)]">
            {checklistTotal > 0 && (
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Checklist</span>
                <div className="w-24 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: `${checklistPct}%` }} />
                </div>
                <span className="text-xs font-bold text-[var(--text-primary)]">{checklistDone}/{checklistTotal}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <FileText size={13} className="text-[var(--accent-blue)]" />
              <span className="font-bold text-[var(--text-primary)]">{drawings.length}</span>
              drawing{drawings.length !== 1 ? 's' : ''}
            </div>
            {task.submittedAt && (
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <Send size={12} className="text-[var(--accent-green)]" />
                Submitted {fmt(task.submittedAt)}
              </div>
            )}
          </div>
        )}

        {/* ── Action bar ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-[var(--border)]">
          <AskAIButton
            label="Ask AI"
            variant="soft"
            size="sm"
            actions={resolveEntry('taskDetail', {
              taskTitle: task.title,
              trackingId: task.projectId?.trackingId,
            }).actions}
          />
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
            <Button
              size="sm"
              onClick={() => setShowSubmit(true)}
              disabled={actioning || !hasDrawings}
              title={submitBlockedReason || undefined}
            >
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
            <Button size="sm" variant="ghost" onClick={() => setShowRevision(true)} disabled={actioning}
              className="bg-[var(--warning)]/10 hover:bg-[var(--warning)]/20 text-[var(--warning)] border border-[var(--warning)]/30">
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
        {submitBlockedReason && (
          <p className="text-[11px] text-[var(--warning)] mt-2 inline-flex items-center gap-1">
            <AlertTriangle size={11} /> {submitBlockedReason}
          </p>
        )}
      </div>

      {/* ── Blocked-by-dependency banner ─────────────────────────────────── */}
      {task.status === 'blocked' && (task.blockingTasks?.length > 0 || task.blockingGates?.length > 0) && (
        <div className="bg-[var(--error)]/5 border border-[var(--error)]/30 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--error)]/15 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-[var(--error)]" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-black uppercase tracking-widest text-[var(--error)] mb-1">
                This task is blocked
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                You can't start this task until the items below are complete. Once they are, your task will unlock automatically.
              </p>
              {task.blockingTasks?.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                    Waiting on tasks
                  </p>
                  <ul className="space-y-1">
                    {task.blockingTasks.map((bt) => (
                      <li key={bt._id} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--error)]/60" />
                        <Link
                          to={`/tasks/${bt._id}`}
                          className="font-semibold text-[var(--text-primary)] hover:text-[var(--primary)] hover:underline"
                        >
                          {bt.title}
                        </Link>
                        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">· {bt.status?.replace(/_/g, ' ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {task.blockingGates?.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                    Waiting on approvals
                  </p>
                  <ul className="space-y-1">
                    {task.blockingGates.map((g) => (
                      <li key={g._id} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)]/70" />
                        <span className="font-semibold text-[var(--text-primary)]">{g.label || g.key}</span>
                        {g.approverType && (
                          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">· approver: {g.approverType}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Revision instructions banner ─────────────────────────────────── */}
      <RevisionBanner task={task} />

      {/* ── Kitchen routing branch (Phase 2) ─────────────────────────────── */}
      {task.taskType === 'kitchen_drawing' && (
        <KitchenRoutingPanel task={task} childTasks={siblingTasks} onUpdated={refresh} />
      )}

      {/* ── Details — horizontal stat grid (full width) ──────────────────── */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
        <SectionHeader icon={Clock} title="Details" accent="var(--text-muted)" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { label: 'Status',   render: () => <TaskStatusBadge status={task.status} /> },
            { label: 'Priority', render: () => <PriorityBadge priority={task.priority} /> },
            { label: 'Start',    value: fmt(task.startDate) },
            {
              label: 'Due',
              value: fmt(task.dueDate),
              accent: isOverdue ? 'var(--error)' : undefined,
            },
            { label: 'Submitted', value: fmtTime(task.submittedAt) },
            {
              label: 'Approved',
              value: task.approvedAt ? fmtTime(task.approvedAt) : '—',
              sub: task.approvedAt && task.approvedBy?.name ? `by ${task.approvedBy.name}` : null,
            },
            { label: 'Reassigned from', value: task.reassignedFrom?.name || '—' },
            { label: 'Project Code', value: task.projectId?.trackingId || '—' },
            { label: 'Zone',  value: task.planning?.zoneName || '—' },
            { label: 'Floor', value: task.planning?.floor || '—' },
            { label: 'Area',  value: task.planning?.area || '—' },
            {
              label: 'Latest Drawing',
              render: () => latestDrawing
                ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-sm font-bold text-[var(--text-primary)]">v{latestDrawing.version}</span>
                    <DrawingStatusBadge status={latestDrawing.status} />
                  </span>
                )
                : <span className="text-sm italic text-[var(--text-muted)]">—</span>,
            },
            ...(task.submittedAt ? [{
              label: 'Last Submission',
              render: () => task.submissionNotes
                ? <p className="text-sm font-medium text-[var(--text-primary)] leading-snug line-clamp-2" title={task.submissionNotes}>{task.submissionNotes}</p>
                : <p className="text-sm italic text-[var(--text-muted)]">No notes added</p>,
            }] : []),
          ].map(({ label, value, render, sub, accent }) => (
            <div key={label} className="rounded-xl bg-[var(--bg)]/60 border border-[var(--border)] px-3.5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{label}</p>
              {render ? (
                render()
              ) : (
                <p
                  className="text-sm font-bold capitalize truncate"
                  style={{ color: accent || 'var(--text-primary)' }}
                  title={typeof value === 'string' ? value : undefined}
                >
                  {value}
                </p>
              )}
              {sub && <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate" title={sub}>{sub}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Notes (full width) ───────────────────────────────────────────── */}
      {task.notes && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
          <SectionHeader icon={FileText} title="Notes" accent="var(--text-muted)" />
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{task.notes}</p>
        </div>
      )}

      {/* ── Checklist + Drawings ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* Checklist */}
        {(task.checklist?.length > 0) ? (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
            <SectionHeader
              icon={CheckSquare}
              title="Checklist"
              count={`${checklistDone}/${checklistTotal}`}
            />
            <ChecklistPanel
              taskId={task._id}
              checklist={task.checklist}
              onUpdated={refresh}
              disabled={!isMyTask && !hasPermission('tasks.update')}
            />
          </div>
        ) : <div className="hidden lg:block" />}

        {/* Drawings */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
          <SectionHeader
            icon={FileText}
            title="Drawings"
            count={drawings.length > 0 ? drawings.length : null}
            accent="var(--accent-blue)"
          />
          {drawings.length === 0 ? (
            <div className="text-center py-6 text-[var(--text-muted)]">
              <FileText size={22} className="mx-auto mb-2 opacity-20" />
              <p className="text-xs">No drawings uploaded yet.</p>
            </div>
          ) : (
            drawings.map((d) => <DrawingRow key={d._id} drawing={d} />)
          )}
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <SubmitForReviewModal
        task={task}
        isOpen={showSubmit}
        onClose={() => setShowSubmit(false)}
        onSubmitted={refresh}
        drawingCount={drawings?.length || 0}
      />
      <RequestRevisionFlow
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
          prefill={{
            title:       task.title,
            zoneName:    task.planning?.zoneName,
            floor:       task.planning?.floor,
            area:        task.planning?.area,
            drawingType: latestDrawing?.drawingType || taskTypeToDrawingType(task.taskType),
          }}
          onUploaded={refresh}
        />
      )}
    </div>
  );
};

export default TaskDetailPage;
