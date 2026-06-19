import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ModalShell, PRIORITY_OPTIONS } from './sheetCells';
import DatePicker from '../../../../shared/components/DatePicker/DatePicker';
import EmployeePicker from '../EmployeePicker';

/**
 * SubtaskModal — create or edit a subtask. Presentational + form only; the
 * parent owns the API call (onSubmit) so it can pick createSubtask vs
 * updateSubtask, toast, and refresh. Reused by the Master Sheet grid and the
 * Task Detail page.
 *
 * Props:
 *   open, mode ('create'|'edit'), subtask (edit prefill), parentTitle,
 *   teamUserIds, busy, onClose, onSubmit(payload)
 */
const SubtaskModal = ({ open, mode = 'create', subtask, parentTitle, teamUserIds, busy, onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [designer, setDesigner] = useState(null);
  const [priority, setPriority] = useState('medium');
  const [start, setStart] = useState('');
  const [duration, setDuration] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(subtask?.title || '');
    setDesigner(subtask?.assignedTo || null);
    setPriority(subtask?.priority || 'medium');
    setStart(subtask?.planning?.plannedStartDate ? new Date(subtask.planning.plannedStartDate).toISOString().slice(0, 10) : '');
    setDuration(subtask?.durationDays != null ? String(subtask.durationDays) : '');
  }, [open, subtask]);

  if (!open) return null;

  const previewDue = () => {
    if (!start || duration === '' || Number.isNaN(Number(duration))) return null;
    const d = new Date(start);
    d.setDate(d.getDate() + Number(duration));
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  const canSubmit = !!title.trim() && !busy;

  const submit = () => {
    if (!canSubmit) return;
    const payload = {
      title: title.trim(),
      assignedTo: designer?._id || null,
      priority,
    };
    if (start) payload.plannedStartDate = start;
    if (duration !== '' && !Number.isNaN(Number(duration))) payload.durationDays = Number(duration);
    onSubmit(payload);
  };

  const due = previewDue();

  return (
    <ModalShell
      title={mode === 'create' ? 'Add Subtask' : 'Edit Subtask'}
      subtitle={parentTitle ? `Under: ${parentTitle}` : undefined}
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={busy}
            className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg)] disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] rounded-lg hover:opacity-90 disabled:opacity-50">
            {busy && <Loader2 size={12} className="animate-spin" />} {mode === 'create' ? 'Add Subtask' : 'Save'}
          </button>
        </>
      )}
    >
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Kitchen plan — detailing"
            autoFocus
            className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Assignee</label>
          <EmployeePicker
            value={designer}
            onChange={setDesigner}
            placeholder="Assign a designer…"
            restrictToIds={teamUserIds}
            filterRoles={teamUserIds ? undefined : ['designer', 'supervisor']}
            emptyHint="No team members — build the project team first"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Start</label>
            <DatePicker name="plannedStartDate" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Duration (days)</label>
            <input
              type="number" min="0" max="365"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 3"
              className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]"
            />
            {due && <p className="text-[10px] text-[var(--text-muted)] mt-1">Due → {due}</p>}
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-md focus:outline-none focus:border-[var(--primary)]"
          >
            {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
    </ModalShell>
  );
};

export default SubtaskModal;
