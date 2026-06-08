import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Phone, MapPin } from 'lucide-react';

const STATUS_BADGE = {
  new:           { label: 'New',          className: 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]' },
  contacted:     { label: 'Contacted',    className: 'bg-[var(--accent-teal)]/10 text-[var(--accent-teal)]' },
  meeting_done:  { label: 'Met',          className: 'bg-[var(--primary)]/10 text-[var(--primary)]' },
  proposal_sent: { label: 'Proposal',     className: 'bg-[var(--warning)]/10 text-[var(--warning)]' },
  converted:     { label: 'Converted',    className: 'bg-[var(--success)]/10 text-[var(--success)]' },
  lost:          { label: 'Lost',         className: 'bg-[var(--error)]/10 text-[var(--error)]' },
};

const fmtBudget = (n) => {
  if (!n || Number.isNaN(Number(n))) return null;
  const v = Number(n);
  if (v >= 10_000_000) return `${(v / 10_000_000).toFixed(1)}Cr`;
  if (v >= 100_000)    return `${(v / 100_000).toFixed(1)}L`;
  if (v >= 1_000)      return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
};

const LeadCard = ({ items, total, viewAllUrl }) => {
  const navigate = useNavigate();
  if (!items?.length) return null;
  const hasMore = typeof total === 'number' && total > items.length && !!viewAllUrl;
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((l) => {
        const badge = STATUS_BADGE[l.status] || { label: l.status, className: 'bg-[var(--bg)] text-[var(--text-muted)]' };
        const budget = fmtBudget(l.budget);
        return (
          <button
            type="button"
            key={l.id}
            onClick={() => l.url && navigate(l.url)}
            className="text-left bg-white border border-[var(--border,#e5e5e5)] rounded-lg px-3 py-2 hover:border-[var(--primary,#D4B76C)] transition-colors group"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium text-[var(--text,#2E2E2E)] truncate">{l.name}</div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted,#A0A0A0)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px]">
                  <span className={`px-1.5 py-0.5 rounded ${badge.className}`}>{badge.label}</span>
                  {l.projectType && (
                    <span className="text-[var(--text-muted,#A0A0A0)]">{l.projectType}</span>
                  )}
                  {l.city && (
                    <span className="inline-flex items-center gap-0.5 text-[var(--text-muted,#A0A0A0)]">
                      <MapPin className="w-3 h-3" /> {l.city}
                    </span>
                  )}
                  {l.phone && (
                    <span className="inline-flex items-center gap-0.5 text-[var(--text-muted,#A0A0A0)]">
                      <Phone className="w-3 h-3" /> {l.phone}
                    </span>
                  )}
                  {budget && (
                    <span className="text-[var(--text-muted,#A0A0A0)]">₹{budget}</span>
                  )}
                  {l.assignee?.name && (
                    <span className="text-[var(--text-muted,#A0A0A0)]">· {l.assignee.name}</span>
                  )}
                </div>
              </div>
            </div>
          </button>
        );
      })}
      {hasMore && (
        <button
          type="button"
          onClick={() => navigate(viewAllUrl)}
          className="text-left bg-[var(--bg,#F8F7F3)] border border-dashed border-[var(--border,#e5e5e5)] rounded-lg px-3 py-2 hover:border-[var(--primary,#D4B76C)] hover:bg-white transition-colors group inline-flex items-center justify-between gap-2"
        >
          <span className="text-xs font-medium text-[var(--primary,#D4B76C)]">
            View all {total} leads
          </span>
          <ChevronRight className="w-4 h-4 text-[var(--text-muted,#A0A0A0)] group-hover:text-[var(--primary,#D4B76C)] transition-colors" />
        </button>
      )}
    </div>
  );
};

export default LeadCard;
