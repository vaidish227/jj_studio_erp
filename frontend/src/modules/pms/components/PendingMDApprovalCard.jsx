import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Inbox, CheckCircle2, RotateCcw, FileText, ClipboardCheck,
  Loader2, Eye, AlertCircle, MessageSquare,
} from 'lucide-react';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import RequestRevisionModal from './RequestRevisionModal';
import PreviewDrawingModal from './PreviewDrawingModal';

/**
 * PendingMDApprovalCard — per-project queue of designer submissions awaiting
 * MD sign-off. Visible only to MD/admin/manager. Used inside Project Detail →
 * Overview tab.
 *
 * Items:
 *   • Tasks in `pending_review`     → Approve / Request Revision
 *   • Drawings in `sent_for_approval` → Approve / Reject
 *
 * Empty state hides the entire card so it doesn't add noise when there's
 * nothing to action.
 */

const ageLabel = (ms) => {
  if (!ms || ms < 0) return 'just now';
  const hours = Math.floor(ms / 3600000);
  if (hours < 1)  return '< 1h';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const ageBadgeCls = (ms) => {
  const hours = Math.floor(ms / 3600000);
  if (hours < 24) return 'bg-[var(--success)]/15 text-[var(--success)]';
  if (hours < 72) return 'bg-[var(--warning)]/15 text-[var(--warning)]';
  return 'bg-[var(--error)]/15 text-[var(--error)]';
};

const Row = ({ children }) => (
  <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg)]/40 transition-colors">
    {children}
  </div>
);

const PendingMDApprovalCard = ({ projectId, projectName }) => {
  const navigate = useNavigate();
  const toast    = useToast();

  const [data, setData]       = useState({ tasks: [], drawings: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId]   = useState(null);
  const [revisionTask, setRevisionTask] = useState(null);
  const [previewDrawing, setPreviewDrawing] = useState(null);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await pmsService.getProjectPendingApproval(projectId);
      setData(res || { tasks: [], drawings: [], total: 0 });
    } catch (e) {
      // Silent — card just disappears on error
      setData({ tasks: [], drawings: [], total: 0 });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApproveTask = async (task) => {
    setBusyId(`task-${task._id}`);
    try {
      await pmsService.approveTask(task._id);
      toast.success(`Approved: ${task.title}`);
      fetchData();
    } catch (e) {
      toast.error(e?.message || 'Failed to approve task');
    } finally {
      setBusyId(null);
    }
  };

  const handleApproveDrawing = async (drawing) => {
    setBusyId(`drawing-${drawing._id}`);
    try {
      await pmsService.approveDrawing(drawing._id, {});
      toast.success(`Approved: ${drawing.title}`);
      fetchData();
    } catch (e) {
      toast.error(e?.message || 'Failed to approve drawing');
    } finally {
      setBusyId(null);
    }
  };

  // Hide card while loading the first time AND when empty
  if (loading) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 flex items-center justify-center text-[var(--text-muted)]">
        <Loader2 size={16} className="animate-spin mr-2" />
        <span className="text-xs">Loading pending approvals…</span>
      </div>
    );
  }
  if (data.total === 0) return null;

  return (
    <>
      <div className="bg-[var(--surface)] border border-[var(--primary)]/30 rounded-2xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border)] bg-gradient-to-r from-[var(--primary)]/8 via-[var(--primary)]/4 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[var(--primary)]/15 text-[var(--primary)] flex items-center justify-center">
              <Inbox size={16} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-primary)]">
                Pending MD Approval
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Designer submissions for {projectName || 'this project'} awaiting your sign-off
              </p>
            </div>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-[var(--warning)]/12 text-[var(--warning)] border border-[var(--warning)]/25">
            <AlertCircle size={10} /> {data.total} Pending
          </span>
        </div>

        {/* Tasks section */}
        {data.tasks.length > 0 && (
          <div>
            <div className="px-5 py-2 bg-[var(--bg)]/40 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              Tasks ({data.tasks.length})
            </div>
            {data.tasks.map((t) => (
              <Row key={`task-${t._id}`}>
                <div className="shrink-0 w-9 h-9 rounded-lg bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] flex items-center justify-center">
                  <ClipboardCheck size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--text-primary)] truncate">{t.title}</p>
                  <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                    {t.taskType?.replace(/_/g, ' ')} · by <span className="font-semibold text-[var(--text-secondary)]">{t.submitterName}</span>
                    {t.submissionNotes ? (
                      <span className="ml-1 inline-flex items-center gap-0.5">
                        · <MessageSquare size={10} className="inline" /> notes
                      </span>
                    ) : null}
                  </p>
                </div>
                <span className={`shrink-0 text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${ageBadgeCls(t.ageMs)}`}>
                  {ageLabel(t.ageMs)}
                </span>
                <button
                  type="button"
                  onClick={() => navigate(`/tasks/${t._id}`)}
                  className="shrink-0 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--bg)] transition-colors"
                  title="Open task detail"
                >
                  <Eye size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setRevisionTask(t)}
                  disabled={busyId === `task-${t._id}`}
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold text-[var(--warning)] border border-[var(--warning)]/30 hover:bg-[var(--warning)]/10 transition-colors disabled:opacity-50"
                  title="Request revision"
                >
                  <RotateCcw size={11} /> Revise
                </button>
                <button
                  type="button"
                  onClick={() => handleApproveTask(t)}
                  disabled={busyId === `task-${t._id}`}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black bg-[var(--success)] text-white hover:bg-[var(--success)]/90 transition-colors disabled:opacity-50"
                  title="Approve task"
                >
                  {busyId === `task-${t._id}`
                    ? <Loader2 size={11} className="animate-spin" />
                    : <CheckCircle2 size={11} />} Approve
                </button>
              </Row>
            ))}
          </div>
        )}

        {/* Drawings section */}
        {data.drawings.length > 0 && (
          <div>
            <div className="px-5 py-2 bg-[var(--bg)]/40 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              Drawings ({data.drawings.length})
            </div>
            {data.drawings.map((d) => (
              <Row key={`drawing-${d._id}`}>
                <div className="shrink-0 w-9 h-9 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                  <FileText size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                    {d.title} <span className="text-[10px] text-[var(--text-muted)] font-normal">v{d.version}</span>
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                    {d.drawingType?.replace(/_/g, ' ')}
                    {d.zoneName ? ` · ${d.zoneName}` : ''}
                    {' · by '}
                    <span className="font-semibold text-[var(--text-secondary)]">{d.submitterName}</span>
                  </p>
                </div>
                <span className={`shrink-0 text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${ageBadgeCls(d.ageMs)}`}>
                  {ageLabel(d.ageMs)}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewDrawing(d)}
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold text-[var(--accent-blue)] border border-[var(--accent-blue)]/30 hover:bg-[var(--accent-blue)]/10 transition-colors"
                  title="Preview drawing"
                >
                  <Eye size={11} /> Preview
                </button>
                <button
                  type="button"
                  onClick={() => handleApproveDrawing(d)}
                  disabled={busyId === `drawing-${d._id}`}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black bg-[var(--success)] text-white hover:bg-[var(--success)]/90 transition-colors disabled:opacity-50"
                  title="Approve drawing"
                >
                  {busyId === `drawing-${d._id}`
                    ? <Loader2 size={11} className="animate-spin" />
                    : <CheckCircle2 size={11} />} Approve
                </button>
              </Row>
            ))}
          </div>
        )}
      </div>

      <RequestRevisionModal
        task={revisionTask}
        isOpen={!!revisionTask}
        onClose={() => setRevisionTask(null)}
        onRevisionRequested={() => { setRevisionTask(null); fetchData(); }}
      />

      {previewDrawing && (
        <PreviewDrawingModal
          drawing={previewDrawing}
          isOpen={!!previewDrawing}
          onClose={() => setPreviewDrawing(null)}
        />
      )}
    </>
  );
};

export default PendingMDApprovalCard;
