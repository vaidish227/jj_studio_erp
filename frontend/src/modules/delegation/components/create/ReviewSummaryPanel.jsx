import { Check, AlertTriangle, User, CalendarDays, ListChecks, Paperclip } from 'lucide-react';
import Button from '../../../../shared/components/Button/Button';
import { InitialsAvatar, ProgressBar } from '../delegationVisuals';
import { PriorityChip } from '../DelegationStatusBadge';
import { fmtDateShort } from '../delegationFormat';

// One preview tile — soft grouped surface, icon + label + value. Grouping by
// tile (rather than horizontal rules) is what makes the panel read as a live
// preview instead of a report table.
const PreviewCell = ({ icon: Icon, label, children, className = '' }) => (
  <div className={`rounded-xl bg-[var(--bg)] border border-[var(--divider)] px-3 py-2.5 min-w-0 ${className}`}>
    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
      <Icon size={12} className="shrink-0" />
      {label}
    </div>
    <div className="mt-1 text-sm font-semibold text-[var(--text-primary)] truncate">{children}</div>
  </div>
);

const StatusRow = ({ done, label }) => (
  <div className="flex items-center gap-2 text-xs">
    {done ? (
      <Check size={14} className="text-[var(--success)] shrink-0" />
    ) : (
      <AlertTriangle size={14} className="text-[var(--warning)] shrink-0" />
    )}
    <span className={done ? 'text-[var(--text-secondary)]' : 'text-[var(--warning)] font-medium'}>{label}</span>
  </div>
);

const SectionLabel = ({ children }) => (
  <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{children}</div>
);

/* Live "creation companion" rail. Pure presentational — derives completion,
   setup status and health from the form values passed down; no functional or
   validation changes vs. the original panel. */
const ReviewSummaryPanel = ({
  title,
  description,
  assigneeName,
  priority,
  dueDate,
  checklistCount = 0,
  attachmentCount = 0,
  canAssign = false,
  titleValid = false,
  duePast = false,
  saving = false,
  busyLabel = '',
  canSubmit = false,
  onSubmit,
  onCancel,
}) => {
  const hasAssignee = !!assigneeName;
  const hasDue = !!dueDate && !duePast;

  // ── Completion (dynamic) ──────────────────────────────────────────────────
  const fields = [
    { key: 'title', done: titleValid },
    { key: 'description', done: !!description },
    { key: 'priority', done: true },
    { key: 'dueDate', done: !!dueDate },
    { key: 'checklist', done: checklistCount > 0 },
    { key: 'attachments', done: attachmentCount > 0 },
    ...(canAssign ? [{ key: 'assignee', done: hasAssignee }] : []),
  ];
  const total = fields.length;
  const completed = fields.filter((f) => f.done).length;
  const percent = Math.round((completed / total) * 100);

  // ── Setup status (friendly) ───────────────────────────────────────────────
  const statusItems = [
    { key: 'title', label: titleValid ? 'Title Added' : 'Title Missing', done: titleValid },
    { key: 'priority', label: 'Priority Selected', done: true },
    ...(canAssign
      ? [{ key: 'assignee', label: hasAssignee ? 'Assignee Assigned' : 'Assignee Missing', done: hasAssignee }]
      : []),
    { key: 'due', label: hasDue ? 'Due Date Set' : 'Due Date Missing', done: hasDue },
  ];

  // ── Health (from existing validation state) ───────────────────────────────
  const health = !titleValid
    ? { tone: 'var(--error)', title: 'Missing Required Fields', subtitle: 'Add a title to continue.' }
    : !dueDate
      ? { tone: 'var(--warning)', title: 'Missing Due Date', subtitle: 'Required fields are set — a due date is recommended.' }
      : duePast
        ? { tone: 'var(--warning)', title: 'Due Date In The Past', subtitle: 'Double-check the timeline before creating.' }
        : { tone: 'var(--success)', title: 'Ready for Assignment', subtitle: 'All set — you can create this delegation.' };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--bg)] flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-[var(--text-primary)]">Delegation Preview</h3>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          <span className="relative flex w-2 h-2">
            <span className="absolute inline-flex w-full h-full rounded-full bg-[var(--success)] opacity-60 animate-ping" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-[var(--success)]" />
          </span>
          Live
        </span>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Title block */}
        <div className="rounded-xl bg-[var(--bg)] border border-[var(--divider)] px-3 py-2.5">
          <SectionLabel>Title</SectionLabel>
          <div className="mt-1 flex items-center justify-between gap-2">
            {title ? (
              <span className="font-bold text-sm text-[var(--text-primary)] break-words min-w-0">{title}</span>
            ) : (
              <span className="font-semibold text-sm text-[var(--text-muted)]">Untitled Delegation</span>
            )}
            <PriorityChip priority={priority} className="shrink-0" />
          </div>
        </div>

        {/* Preview grid */}
        <div className="grid grid-cols-2 gap-2">
          <PreviewCell icon={User} label="Assignee">
            {hasAssignee ? (
              <span className="inline-flex items-center gap-1.5">
                <InitialsAvatar name={assigneeName} size={18} />
                <span className="truncate">{assigneeName}</span>
              </span>
            ) : (
              <span className="text-[var(--text-muted)] font-normal">Unassigned</span>
            )}
          </PreviewCell>
          <PreviewCell icon={CalendarDays} label="Due date">
            {dueDate ? fmtDateShort(dueDate) : <span className="text-[var(--text-muted)] font-normal">Not set</span>}
          </PreviewCell>
          <PreviewCell icon={ListChecks} label="Checklist">
            {checklistCount} task{checklistCount === 1 ? '' : 's'}
          </PreviewCell>
          <PreviewCell icon={Paperclip} label="Attachments" className="col-span-2">
            {attachmentCount} file{attachmentCount === 1 ? '' : 's'}
          </PreviewCell>
        </div>

        {/* Completion */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <SectionLabel>Form Completion</SectionLabel>
            <span className="text-xs font-extrabold text-[var(--text-primary)] tabular-nums">{percent}%</span>
          </div>
          <ProgressBar value={percent} />
          <p className="text-[11px] text-[var(--text-muted)] mt-1.5">{completed} of {total} fields completed</p>
        </div>

        {/* Setup status */}
        <div>
          <SectionLabel>Setup Status</SectionLabel>
          <div className="mt-2 grid grid-cols-1 gap-1.5">
            {statusItems.map((s) => <StatusRow key={s.key} done={s.done} label={s.label} />)}
          </div>
        </div>
      </div>

      {/* Health band */}
      <div
        className="px-5 py-3 border-t border-[var(--border)]"
        style={{ background: `color-mix(in srgb, ${health.tone} 9%, transparent)` }}
      >
        <div className="flex items-start gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ background: health.tone }} />
          <div className="min-w-0">
            <div className="text-sm font-extrabold leading-tight" style={{ color: health.tone }}>{health.title}</div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{health.subtitle}</div>
          </div>
        </div>
      </div>

      {/* Sticky action footer */}
      <div className="px-5 py-4 border-t border-[var(--border)] bg-[var(--bg)]">
        <div className="flex items-center gap-1.5 text-[11px] mb-2.5">
          {saving ? (
            <>
              <span className="w-3 h-3 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-[var(--text-secondary)] font-medium">{busyLabel || 'Working…'}</span>
            </>
          ) : canSubmit ? (
            <>
              <Check size={13} className="text-[var(--success)]" />
              <span className="text-[var(--text-secondary)] font-medium">Ready to create</span>
            </>
          ) : (
            <>
              <AlertTriangle size={13} className="text-[var(--warning)]" />
              <span className="text-[var(--warning)] font-medium">Add a title to continue</span>
            </>
          )}
        </div>
        <Button variant="primary" size="md" fullWidth isLoading={saving} disabled={!canSubmit} onClick={onSubmit}>
          Create Delegation
        </Button>
        <Button variant="ghost" size="sm" fullWidth onClick={onCancel} disabled={saving} className="mt-2">
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default ReviewSummaryPanel;
