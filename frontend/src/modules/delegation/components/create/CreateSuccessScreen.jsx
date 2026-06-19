import { CheckCircle2, Eye, Plus, LayoutDashboard } from 'lucide-react';
import Button from '../../../../shared/components/Button/Button';
import { InitialsAvatar } from '../delegationVisuals';
import { PriorityChip } from '../DelegationStatusBadge';
import { fmtDateShort } from '../delegationFormat';

const Field = ({ label, children }) => (
  <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 text-left">
    <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
    <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{children}</div>
  </div>
);

/* Confirmation step shown after a successful create — instead of an immediate
   redirect — so the user can verify, jump in, or queue another. Surfaces the
   identifying details (title, id, department, priority, assignee, due) so the
   user can confirm at a glance they created the right thing. */
const CreateSuccessScreen = ({ delegation, assigneeName, departmentName, dueDate, onView, onCreateAnother, onDashboard }) => (
  <div className="max-w-xl mx-auto text-center py-6">
    <div
      className="w-16 h-16 rounded-3xl mx-auto flex items-center justify-center text-white shadow-lg"
      style={{ background: 'linear-gradient(135deg, var(--success), color-mix(in srgb, var(--success) 70%, black))' }}
    >
      <CheckCircle2 size={34} />
    </div>
    <h1 className="text-2xl font-extrabold text-[var(--text-primary)] mt-4">Delegation Created Successfully</h1>
    <p className="text-sm text-[var(--text-muted)] mt-1">
      Your delegation is live. An activity entry was logged and stakeholders were notified.
    </p>

    {delegation?.title && (
      <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-3 text-left mt-6">
        <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Title</div>
        <div className="mt-1 text-base font-extrabold text-[var(--text-primary)] break-words">{delegation.title}</div>
      </div>
    )}

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
      <Field label="Delegation ID">
        <span className="font-mono">{delegation?.trackingId || '—'}</span>
      </Field>
      <Field label="Priority">
        <PriorityChip priority={delegation?.priority || 'medium'} />
      </Field>
      <Field label="Assigned To">
        {assigneeName ? (
          <span className="inline-flex items-center gap-1.5">
            <InitialsAvatar name={assigneeName} size={20} />
            {assigneeName}
          </span>
        ) : (
          <span className="text-[var(--text-muted)]">Unassigned</span>
        )}
      </Field>
      <Field label="Due Date">{dueDate ? fmtDateShort(dueDate) : <span className="text-[var(--text-muted)]">Not set</span>}</Field>
      {departmentName && <Field label="Department">{departmentName}</Field>}
    </div>

    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-7">
      <Button variant="primary" size="md" onClick={onView}>
        <Eye size={16} /> View Delegation
      </Button>
      <Button variant="outline" size="md" onClick={onCreateAnother}>
        <Plus size={16} /> Create Another
      </Button>
      <Button variant="ghost" size="md" onClick={onDashboard}>
        <LayoutDashboard size={16} /> Back to Dashboard
      </Button>
    </div>
  </div>
);

export default CreateSuccessScreen;
