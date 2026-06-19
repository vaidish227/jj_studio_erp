import { Check, AlertTriangle, Circle, ListChecks, Paperclip } from 'lucide-react';
import { InitialsAvatar, DeptChip } from '../delegationVisuals';
import { PriorityChip } from '../DelegationStatusBadge';
import { fmtDateShort } from '../delegationFormat';

const Row = ({ label, children }) => (
  <div className="flex items-start justify-between gap-3 py-2 border-b border-[var(--divider)] last:border-0">
    <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)] pt-0.5 shrink-0">{label}</span>
    <span className="text-sm text-[var(--text-primary)] text-right min-w-0">{children}</span>
  </div>
);

const CHECK_ICON = {
  ok: { Icon: Check, cls: 'text-[var(--success)]' },
  warn: { Icon: AlertTriangle, cls: 'text-[var(--warning)]' },
  info: { Icon: Circle, cls: 'text-[var(--text-muted)]' },
};

/* Sticky right-rail summary that mirrors the form in real time, plus a live
   readiness checklist. Pure presentational — all values are derived by the
   page and passed down. */
const ReviewSummaryPanel = ({
  title,
  assigneeName,
  department,
  priority,
  dueDate,
  checklistCount = 0,
  attachmentCount = 0,
  checks = [],
}) => (
  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
    <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--bg)]">
      <h3 className="text-sm font-extrabold text-[var(--text-primary)]">Review Summary</h3>
      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Updates live as you fill the form.</p>
    </div>

    <div className="px-5 py-2">
      <Row label="Title">
        {title ? <span className="font-semibold break-words">{title}</span> : <span className="text-[var(--text-muted)]">Untitled delegation</span>}
      </Row>
      <Row label="Assignee">
        {assigneeName ? (
          <span className="inline-flex items-center gap-1.5">
            <InitialsAvatar name={assigneeName} size={20} />
            <span className="font-semibold">{assigneeName}</span>
          </span>
        ) : (
          <span className="text-[var(--text-muted)]">Unassigned</span>
        )}
      </Row>
      {department && (
        <Row label="Department"><DeptChip name={department.name} color={department.color} /></Row>
      )}
      <Row label="Priority"><PriorityChip priority={priority} /></Row>
      <Row label="Due date">
        {dueDate ? <span className="font-semibold">{fmtDateShort(dueDate)}</span> : <span className="text-[var(--text-muted)]">Not set</span>}
      </Row>
      <Row label="Checklist">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <ListChecks size={14} className="text-[var(--text-muted)]" />
          {checklistCount} item{checklistCount === 1 ? '' : 's'}
        </span>
      </Row>
      <Row label="Files">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Paperclip size={14} className="text-[var(--text-muted)]" />
          {attachmentCount} file{attachmentCount === 1 ? '' : 's'}
        </span>
      </Row>
    </div>

    {checks.length > 0 && (
      <div className="px-5 py-3 border-t border-[var(--border)] bg-[var(--bg)]/60 space-y-1.5">
        {checks.map((c) => {
          const { Icon, cls } = CHECK_ICON[c.state] || CHECK_ICON.info;
          return (
            <div key={c.key} className="flex items-center gap-2 text-xs">
              <Icon size={14} className={`${cls} shrink-0`} />
              <span className={c.state === 'warn' ? 'text-[var(--warning)] font-medium' : 'text-[var(--text-secondary)]'}>
                {c.label}
              </span>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

export default ReviewSummaryPanel;
