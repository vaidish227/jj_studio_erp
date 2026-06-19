import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, FolderOpen, ArrowUpRight } from 'lucide-react';
import DrawingCard from './DrawingCard';
import DrawingListRow from './DrawingListRow';

// Compact status roll-up shown on the group header so a project's drawing
// health is legible without expanding. Keys mirror Drawing.status values.
const STATUS_SUMMARY = [
  { key: 'draft',             label: 'Draft',     cls: 'text-[var(--text-muted)] bg-[var(--border)]' },
  { key: 'sent_for_approval', label: 'In Review', cls: 'text-[var(--warning)] bg-[var(--warning)]/10' },
  { key: 'approved',          label: 'Approved',  cls: 'text-[var(--success)] bg-[var(--success)]/10' },
  { key: 'released_to_site',  label: 'Released',  cls: 'text-[var(--primary)] bg-[var(--primary)]/10' },
  { key: 'rejected',          label: 'Rejected',  cls: 'text-[var(--error)] bg-[var(--error)]/10' },
];

/**
 * ProjectDrawingGroup — one collapsible section of the Drawing Library's
 * "By project" view. Header shows the project name, tracking id, a per-status
 * roll-up and a count; the body renders that project's drawings using the
 * page-level view mode (grid cards or the list table). The list view omits the
 * Project column (it's already the group heading) via DrawingListRow's
 * `hideProject` prop. Mirrors the TaskGroup pattern in TasksTab for consistency.
 */
const ProjectDrawingGroup = ({
  project,
  drawings,
  viewMode,
  defaultOpen = true,
  onSendForApproval,
  onApprove,
  onRelease,
  onRevise,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const navigate = useNavigate();

  const counts = drawings.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {});

  const projectName = project?.name || 'Unassigned';
  const trackingId  = project?.trackingId;

  return (
    <div className={`border border-[var(--border)] rounded-2xl bg-[var(--surface)] overflow-hidden
                     transition-colors hover:border-[var(--primary)]/30 ${open ? 'shadow-sm' : ''}`}>
      {/* Header */}
      <div className={`flex items-center gap-2 px-4 py-3 transition-colors
                       ${open ? 'border-b border-[var(--border)] bg-[var(--bg)]/40' : 'hover:bg-[var(--bg)]/40'}`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 flex-1 min-w-0 group select-none text-left"
        >
          {open
            ? <ChevronDown size={15} className="text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors shrink-0" />
            : <ChevronRight size={15} className="text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors shrink-0" />}
          <div className="w-6 h-6 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
            <FolderOpen size={13} className="text-[var(--primary)]" />
          </div>
          <h3 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors truncate">
            {projectName}
          </h3>
          {trackingId && (
            <span className="text-[10px] font-black text-[var(--text-muted)] bg-[var(--border)] px-1.5 py-0.5 rounded shrink-0">
              {trackingId}
            </span>
          )}
          <span className="text-[10px] font-bold text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 rounded-full shrink-0">
            {drawings.length}
          </span>
        </button>

        {/* Per-status roll-up */}
        <div className="hidden md:flex items-center gap-1.5">
          {STATUS_SUMMARY.filter((s) => counts[s.key]).map((s) => (
            <span
              key={s.key}
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.cls}`}
              title={s.label}
            >
              {counts[s.key]} {s.label}
            </span>
          ))}
        </div>

        {/* Jump to the project's own Drawings tab */}
        {project?._id && (
          <button
            type="button"
            onClick={() => navigate(`/projects/${project._id}?tab=drawings`)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--primary)] hover:underline shrink-0"
            title="Open project drawings"
          >
            Open <ArrowUpRight size={12} />
          </button>
        )}
      </div>

      {/* Body */}
      {open && (
        viewMode === 'list' ? (
          <div className="overflow-x-auto">
            {/* Column set mirrors DrawingLibraryPage's flat table minus Project. */}
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg)]/60 text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest">Drawing</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest hidden md:table-cell">Type</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest hidden xl:table-cell">Uploaded By</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest hidden md:table-cell">Date</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest">Status</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-black uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody>
                {drawings.map((d) => (
                  <DrawingListRow
                    key={d._id}
                    drawing={d}
                    hideProject
                    onSendForApproval={onSendForApproval}
                    onApprove={onApprove}
                    onRelease={onRelease}
                    onRevise={onRevise}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
            {drawings.map((d) => (
              <DrawingCard
                key={d._id}
                drawing={d}
                onSendForApproval={onSendForApproval}
                onApprove={onApprove}
                onRelease={onRelease}
                onRevise={onRevise}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default ProjectDrawingGroup;
