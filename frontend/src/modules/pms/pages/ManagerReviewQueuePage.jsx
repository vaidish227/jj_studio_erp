import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck, RefreshCw, CheckCircle2, GitBranch,
  UserCheck, User, Calendar,
  AlertTriangle, ChevronRight,
} from 'lucide-react';
import { Button, Loader } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';
import useReviewQueue from '../hooks/useReviewQueue';
import TaskTypeIcon, { TASK_TYPE_CONFIG } from '../components/TaskTypeIcon';
import PriorityBadge from '../components/PriorityBadge';
import RequestRevisionModal from '../components/RequestRevisionModal';
import ReassignTaskModal from '../components/ReassignTaskModal';
import DrawingMosaic from '../components/DrawingMosaic';

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
  : '—';

const fmtTime = (d) => d
  ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—';

// ── Review Card ──────────────────────────────────────────────────────────────
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

  const drawings = task.drawings || [];
  const hasDrawings = drawings.length > 0;

  return (
    <div
      className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--primary)]/40
                 transition-all cursor-pointer group"
      onClick={() => navigate(`/tasks/${task._id}`)}
    >
      <div className={`flex flex-col ${hasDrawings ? 'lg:flex-row' : ''} gap-5`}>
        {/* ── Left column: content ── */}
        <div className="flex-1 min-w-0">
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
            {task.dueDate && (
              <div className="flex items-center gap-1">
                <span>Due {fmt(task.dueDate)}</span>
              </div>
            )}
          </div>

          {/* Submission notes */}
          {task.submissionNotes && (
            <div className="mb-3 px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic">
                "{task.submissionNotes}"
              </p>
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
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); onRevision(task); }}
              className="bg-[var(--warning)]/10 hover:bg-[var(--warning)]/20 text-[var(--warning)] border border-[var(--warning)]/30"
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

        {/* ── Right column: drawing mosaic ── */}
        {hasDrawings && (
          <div
            className="shrink-0 lg:border-l lg:border-[var(--border)] lg:pl-5 self-start"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-2">
              {drawings.length === 1 ? 'Drawing' : `${drawings.length} Drawings`}
            </p>
            <DrawingMosaic drawings={drawings} size={200} />
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Page ────────────────────────────────────────────────────────────────
const ManagerReviewQueuePage = () => {
  const [projectFilter, setProjectFilter] = useState('');
  const { tasks, isLoading, error, total, refresh } = useReviewQueue(
    projectFilter ? { projectId: projectFilter } : {}
  );

  const [revisionTask, setRevisionTask] = useState(null);
  const [reassignTask, setReassignTask] = useState(null);

  const handleApproved = () => refresh();
  const handleRevisionDone = () => { setRevisionTask(null); refresh(); };
  const handleReassignDone = () => { setReassignTask(null); refresh(); };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--warning)]/15 flex items-center justify-center">
            <ClipboardCheck size={20} className="text-[var(--warning)]" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[var(--text-primary)]">Review Queue</h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Tasks submitted by designers awaiting your review
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className="text-xs font-bold bg-[var(--warning)]/10 text-[var(--warning)] px-3 py-1.5 rounded-full">
              {total} pending
            </span>
          )}
          <button
            onClick={refresh}
            className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--bg)] text-[var(--text-muted)] transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <Loader label="Loading review queue…" />
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertTriangle size={28} className="text-[var(--error)] opacity-60" />
          <p className="text-sm text-[var(--text-muted)]">{error}</p>
          <button onClick={refresh} className="text-xs text-[var(--primary)] hover:underline font-semibold">Retry</button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--success)]/10 flex items-center justify-center mb-4">
            <CheckCircle2 size={26} className="text-[var(--success)]" />
          </div>
          <p className="text-sm font-bold text-[var(--text-primary)] mb-1">All caught up!</p>
          <p className="text-xs text-[var(--text-muted)]">
            No tasks are currently waiting for review.
          </p>
        </div>
      )}

      {/* Cards */}
      {!isLoading && tasks.length > 0 && (
        <div className="space-y-4">
          {tasks.map((task) => (
            <ReviewCard
              key={task._id}
              task={task}
              onApproved={handleApproved}
              onRevision={setRevisionTask}
              onReassign={setReassignTask}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <RequestRevisionModal
        task={revisionTask}
        isOpen={!!revisionTask}
        onClose={() => setRevisionTask(null)}
        onRevisionRequested={handleRevisionDone}
      />
      <ReassignTaskModal
        task={reassignTask}
        isOpen={!!reassignTask}
        onClose={() => setReassignTask(null)}
        onReassigned={handleReassignDone}
      />
    </div>
  );
};

export default ManagerReviewQueuePage;
