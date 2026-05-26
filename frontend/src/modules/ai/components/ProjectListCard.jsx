import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const STATUS_LABEL = {
  design_phase:     'Design',
  execution_phase:  'Execution',
  handover:         'Handover',
  completed:        'Completed',
  on_hold:          'On hold',
  cancelled:        'Cancelled',
};

const ProjectListCard = ({ items }) => {
  const navigate = useNavigate();
  if (!items?.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((p) => (
        <button
          type="button"
          key={p.id}
          onClick={() => p.url && navigate(p.url)}
          className="text-left bg-white border border-[var(--border,#e5e5e5)] rounded-lg px-3 py-2 hover:border-[var(--primary,#D4B76C)] transition-colors group"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-mono text-[var(--text-muted,#A0A0A0)]">{p.trackingId}</div>
              <div className="text-sm font-medium text-[var(--text,#2E2E2E)] truncate">{p.name}</div>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-[var(--text-muted,#A0A0A0)]">
                <span className="px-1.5 py-0.5 rounded bg-[var(--bg,#F8F7F3)] text-[var(--text,#2E2E2E)]">
                  {STATUS_LABEL[p.status] || p.status}
                </span>
                {p.projectType && <span>{p.projectType}</span>}
                {p.area && <span>{p.area} sqft</span>}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted,#A0A0A0)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        </button>
      ))}
    </div>
  );
};

export default ProjectListCard;
