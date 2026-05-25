import React, { useState } from 'react';
import { Plus, MapPin } from 'lucide-react';
import { Button, FormField } from '../../../../shared/components';
import PermissionGate from '../../../../shared/components/PermissionGate/PermissionGate';
import { pmsService } from '../../../../shared/services/pmsService';
import { useToast } from '../../../../shared/notifications/ToastProvider';

const fmt = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—';

const SiteLogsTab = ({ project, siteLogs, onLogAdded }) => {
  const toast = useToast();
  const [showForm, setShowForm]     = useState(false);
  const [note, setNote]             = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!note.trim()) return;
    setSubmitting(true);
    try {
      await pmsService.createSiteLog({ projectId: project._id, note: note.trim() });
      toast.success('Site log added');
      setNote('');
      setShowForm(false);
      onLogAdded?.();
    } catch {
      toast.error('Failed to add site log');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">
          {siteLogs.length} entr{siteLogs.length !== 1 ? 'ies' : 'y'}
        </p>
        <PermissionGate permission="site_logs.create">
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus size={14} className="mr-1" />
            Add Entry
          </Button>
        </PermissionGate>
      </div>

      {/* Inline add form */}
      {showForm && (
        <div className="bg-[var(--surface)] border border-[var(--primary)]/30 rounded-xl p-4 space-y-3">
          <FormField label="Site Note">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Describe what was observed or done at the site today..."
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]
                         text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                         focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30
                         focus:border-[var(--primary)] resize-none transition-colors"
            />
          </FormField>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => { setShowForm(false); setNote(''); }} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} isLoading={submitting} disabled={!note.trim()}>
              Save
            </Button>
          </div>
        </div>
      )}

      {siteLogs.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <MapPin size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No site logs yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...siteLogs].reverse().map((log) => (
            <div
              key={log._id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4"
            >
              <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                {log.note}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-muted)]">
                <span>{log.loggedBy?.name || '—'}</span>
                <span className="ml-auto">{fmt(log.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SiteLogsTab;
