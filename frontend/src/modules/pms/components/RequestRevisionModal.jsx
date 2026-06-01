import React, { useState } from 'react';
import { GitBranch, X, UserCheck } from 'lucide-react';
import { Button } from '../../../shared/components';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import AIInlinePolish from '../../ai/components/AIInlinePolish';

const RequestRevisionModal = ({ task, isOpen, onClose, onRevisionRequested }) => {
  const toast = useToast();
  const [instructions, setInstructions] = useState('');
  const [deadline, setDeadline]         = useState('');
  const [saving, setSaving]             = useState(false);
  const [errors, setErrors]             = useState({});

  if (!isOpen || !task) return null;

  const validate = () => {
    const e = {};
    if (!instructions.trim() || instructions.trim().length < 5) {
      e.instructions = 'Instructions must be at least 5 characters';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { revisionInstructions: instructions.trim() };
      if (deadline) payload.revisionDeadline = deadline;
      const res = await pmsService.requestRevision(task._id, payload);
      toast.success('Revision request sent to designer');
      onRevisionRequested?.(res.task);
      onClose();
    } catch (e) {
      toast.error(e?.message || 'Failed to request revision');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setInstructions('');
    setDeadline('');
    setErrors({});
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--warning)]/15 flex items-center justify-center">
              <GitBranch size={16} className="text-[var(--warning)]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Request Revision</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate max-w-[220px]">{task.title}</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mt-0.5">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Revision instructions */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              Revision Instructions <span className="text-[var(--error)]">*</span>
            </label>
            <textarea
              value={instructions}
              onChange={(e) => { setInstructions(e.target.value); setErrors((p) => ({ ...p, instructions: '' })); }}
              rows={4}
              placeholder="Describe clearly what needs to be changed, fixed, or improved…"
              className={`w-full px-3 py-2.5 text-sm rounded-xl border bg-[var(--bg)]
                         text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                         focus:outline-none focus:ring-1 resize-none transition-colors
                         ${errors.instructions
                           ? 'border-[var(--error)] focus:ring-[var(--error)]'
                           : 'border-[var(--border)] focus:ring-[var(--warning)]'}`}
            />
            {errors.instructions && (
              <p className="text-[11px] text-[var(--error)]">{errors.instructions}</p>
            )}
            <AIInlinePolish
              value={instructions}
              onAccept={(t) => { setInstructions(t); setErrors((p) => ({ ...p, instructions: '' })); }}
              acceptLabel="Use this"
              emptyMessage="Write the instructions first, then let AI refine them."
              rows={4}
            />
          </div>

          {/* Revision deadline */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              Revision Deadline <span className="font-normal text-[var(--text-muted)]">(optional)</span>
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg)]
                         text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--warning)]"
            />
          </div>
        </div>

        <p className="text-[11px] text-[var(--text-muted)] mt-4 mb-5 leading-relaxed">
          The designer will be notified via email and WhatsApp. All submitted drawings will be marked as rejected with these instructions.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-[var(--warning)] hover:bg-[var(--warning)]/90 text-black"
          >
            <GitBranch size={14} className="mr-1.5" />
            {saving ? 'Sending…' : 'Request Revision'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RequestRevisionModal;
