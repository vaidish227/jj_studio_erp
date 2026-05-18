import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, Clock, RefreshCw, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Loader } from '../../../shared/components';
import { pmsService } from '../../../shared/services/pmsService';
import { useAuth } from '../../../shared/context/AuthContext';
import { useToast } from '../../../shared/notifications/ToastProvider';

const STATUS_CONFIG = {
  pending:               { label: 'Pending',               icon: Clock,        color: 'text-[var(--warning)]',     bg: 'bg-[var(--warning)]/10' },
  approved:              { label: 'Approved',              icon: CheckCircle2, color: 'text-[var(--success)]',     bg: 'bg-[var(--success)]/10' },
  rejected:              { label: 'Rejected',              icon: XCircle,      color: 'text-[var(--error)]',       bg: 'bg-[var(--error)]/10' },
  approved_with_changes: { label: 'Approved w/ Changes',   icon: CheckCircle2, color: 'text-[var(--accent-blue)]', bg: 'bg-[var(--accent-blue)]/10' },
};

const TARGET_LABELS = {
  drawing:   'Drawing',
  concept:   'Concept',
  material:  'Material',
  quotation: 'Quotation',
};

const APPROVER_LABELS = {
  client:             'Client',
  manager:            'Manager',
  principal_designer: 'Principal Designer',
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
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

const ApprovalDashboardPage = () => {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const [approvals, setApprovals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter,    setFilter]    = useState('pending');
  const [responding, setResponding] = useState(null);

  const fetchApprovals = useCallback(async () => {
    if (!user?._id) return;
    setIsLoading(true);
    try {
      const res = await pmsService.getPendingApprovals(user._id);
      setApprovals(res.approvals || []);
    } catch {
      toastError('Failed to load approvals');
    } finally {
      setIsLoading(false);
    }
  }, [user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  const handleRespond = async (id, data) => {
    try {
      await pmsService.respondToApproval(id, data);
      success('Response submitted');
      fetchApprovals();
    } catch (e) {
      toastError(e || 'Failed to respond');
    }
  };

  const displayed = filter === 'all'
    ? approvals
    : approvals.filter((a) => a.status === filter);

  const pendingCount = approvals.filter((a) => a.status === 'pending').length;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--text-primary)]">Approval Dashboard</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Review and respond to approval requests across all projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="text-xs font-bold bg-[var(--warning)]/10 text-[var(--warning)] px-3 py-1.5 rounded-full">
              {pendingCount} pending
            </span>
          )}
          <button onClick={fetchApprovals} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--bg)] transition-colors text-[var(--text-muted)]" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border)]">
        {['pending', 'approved', 'rejected', 'all'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors capitalize
              ${filter === f
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}>
            {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label || f}
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
                  <StatusBadge status={a.status} />
                  <p className="text-[10px] text-[var(--text-muted)]">{fmt(a.createdAt)}</p>
                </div>
              </div>

              {a.status === 'pending' && (
                <div className="pt-3 border-t border-[var(--border)]">
                  <Button size="sm" onClick={() => setResponding(a)}>
                    Respond
                  </Button>
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

export default ApprovalDashboardPage;
