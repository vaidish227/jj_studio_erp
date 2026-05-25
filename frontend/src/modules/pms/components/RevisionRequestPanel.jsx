import React, { useState } from 'react';
import { GitBranch, Plus, Check, Loader2, X, AlertTriangle } from 'lucide-react';
import { useToast } from '../../../shared/notifications/ToastProvider';
import PermissionGate from '../../../shared/components/PermissionGate/PermissionGate';
import useRevisionRequests from '../hooks/useRevisionRequests';

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';

const STATUS_STYLES = {
  pending:      { label: 'Pending',     color: 'var(--warning)' },
  resubmitted:  { label: 'Resubmitted', color: 'var(--accent-blue)' },
  resolved:     { label: 'Resolved',    color: 'var(--accent-green)' },
};

const EMPTY_FORM = { revisionNotes: '', specificItems: '', deadline: '' };

const RevisionRequestPanel = ({ drawingId }) => {
  const toast = useToast();
  const { requests, isLoading, isSubmitting, error, create, resolve } = useRevisionRequests(drawingId);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.revisionNotes.trim()) {
      toast.error('Revision notes are required');
      return;
    }

    const specificItems = form.specificItems
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const result = await create({
      revisionNotes: form.revisionNotes.trim(),
      specificItems,
      deadline: form.deadline || undefined,
    });

    if (result.ok) {
      toast.success('Revision request created — designer notified');
      setShowForm(false);
      setForm(EMPTY_FORM);
    } else {
      toast.error(result.message);
    }
  };

  const handleResolve = async (id) => {
    const result = await resolve(id);
    if (result.ok) {
      toast.success('Revision request marked as resolved');
    } else {
      toast.error(result.message);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-[var(--border)]">
        <GitBranch size={13} className="text-[var(--error)]" />
        <span className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">
          Revision Requests
        </span>
        {pendingCount > 0 && (
          <span className="text-[9px] font-black bg-[var(--error)]/10 text-[var(--error)] px-1.5 py-0.5 rounded-full">
            {pendingCount} pending
          </span>
        )}
        <PermissionGate permission="drawings.approve">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="ml-auto flex items-center gap-1 text-xs text-[var(--primary)] hover:underline font-semibold"
          >
            {showForm ? <X size={11} /> : <Plus size={11} />}
            {showForm ? 'Cancel' : 'Request'}
          </button>
        </PermissionGate>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="space-y-2 p-3 rounded-xl bg-[var(--error)]/5 border border-[var(--error)]/20">
          <p className="text-xs font-bold text-[var(--error)]">New Revision Request</p>
          <textarea
            value={form.revisionNotes}
            onChange={(e) => setForm((f) => ({ ...f, revisionNotes: e.target.value }))}
            placeholder="Describe what needs to be revised…"
            rows={3}
            required
            className="w-full text-sm border border-[var(--border)] rounded-lg px-3 py-2
                       bg-[var(--surface)] text-[var(--text-primary)] resize-none
                       placeholder:text-[var(--text-muted)] focus:outline-none
                       focus:border-[var(--error)] transition-colors"
          />
          <textarea
            value={form.specificItems}
            onChange={(e) => setForm((f) => ({ ...f, specificItems: e.target.value }))}
            placeholder="Specific items (one per line, optional)"
            rows={2}
            className="w-full text-sm border border-[var(--border)] rounded-lg px-3 py-2
                       bg-[var(--surface)] text-[var(--text-primary)] resize-none
                       placeholder:text-[var(--text-muted)] focus:outline-none
                       focus:border-[var(--border)] transition-colors"
          />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
              className="flex-1 text-sm border border-[var(--border)] rounded-lg px-3 py-1.5
                         bg-[var(--surface)] text-[var(--text-secondary)] focus:outline-none
                         focus:border-[var(--error)] transition-colors"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--error)]
                         text-white text-xs font-bold disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {isSubmitting && <Loader2 size={12} className="animate-spin" />}
              Send Request
            </button>
          </div>
        </form>
      )}

      {/* Request list */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" />
        </div>
      ) : error ? (
        <p className="text-xs text-[var(--error)] text-center py-3">{error}</p>
      ) : requests.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] text-center py-4">No revision requests for this drawing.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {requests.map((r) => {
            const st = STATUS_STYLES[r.status] || STATUS_STYLES.pending;
            return (
              <div
                key={r._id}
                className="rounded-xl border p-3 space-y-1.5"
                style={{
                  borderColor: `color-mix(in srgb, ${st.color} 25%, transparent)`,
                  background:  `color-mix(in srgb, ${st.color} 5%, transparent)`,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        {r.requestedBy?.name || 'Reviewer'}
                      </span>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{
                          color:      st.color,
                          background: `color-mix(in srgb, ${st.color} 15%, transparent)`,
                        }}
                      >
                        {st.label}
                      </span>
                      {r.deadline && (
                        <span className="text-[9px] text-[var(--text-muted)] ml-auto shrink-0">
                          Due {fmt(r.deadline)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 leading-snug">{r.revisionNotes}</p>
                  </div>
                </div>

                {r.specificItems?.length > 0 && (
                  <ul className="space-y-0.5 pl-3">
                    {r.specificItems.map((item, i) => (
                      <li key={i} className="text-xs text-[var(--text-muted)] list-disc">{item}</li>
                    ))}
                  </ul>
                )}

                {r.status === 'pending' && (
                  <PermissionGate permission="design.comment">
                    <button
                      type="button"
                      onClick={() => handleResolve(r._id)}
                      disabled={isSubmitting}
                      className="flex items-center gap-1 text-[10px] font-bold text-[var(--accent-green)]
                                 hover:underline disabled:opacity-50 mt-1"
                    >
                      <Check size={10} /> Mark Resolved
                    </button>
                  </PermissionGate>
                )}

                {r.status === 'resolved' && r.resolvedAt && (
                  <p className="text-[9px] text-[var(--text-muted)]">
                    Resolved {fmt(r.resolvedAt)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RevisionRequestPanel;
