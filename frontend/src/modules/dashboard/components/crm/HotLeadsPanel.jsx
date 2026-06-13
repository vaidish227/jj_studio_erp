import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, ChevronRight, Phone } from 'lucide-react';
import Card from '../../../../shared/components/Card/Card';
import Badge from '../../../../shared/components/Badge/Badge';

const PRIORITY_VARIANT = {
  high: 'error',
  medium: 'warning',
  low: 'default',
};

const STAGE_LABEL = {
  interested: 'Interested',
  proposal_sent: 'Proposal Sent',
};

const relativeTime = (date) => {
  if (!date) return '—';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-IN');
};

const initial = (name) =>
  (name || 'L')
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

const HotLeadsPanel = ({ leads = [] }) => {
  const navigate = useNavigate();

  return (
    <Card padding="p-5" className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--error)]/10 flex items-center justify-center">
            <Flame size={16} className="text-[var(--error)]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">Hot Leads</h3>
            <p className="text-[11px] text-[var(--text-muted)] font-medium">
              Interested + Proposal stage
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/crm/clients')}
          className="text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-hover)] flex items-center gap-0.5"
        >
          View All <ChevronRight size={14} />
        </button>
      </div>

      {/* List */}
      {leads.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-sm text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-xl">
          No hot leads right now.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {leads.map((lead) => (
            <button
              key={lead._id}
              onClick={() => navigate(`/crm/leads/${lead._id}`)}
              className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all text-left group"
            >
              {/* Avatar */}
              <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-active)] flex items-center justify-center text-white text-sm font-extrabold shadow-sm">
                {initial(lead.name)}
              </div>

              {/* Body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                    {lead.name}
                  </p>
                  <Badge
                    label={lead.priority || 'medium'}
                    variant={PRIORITY_VARIANT[lead.priority] || 'default'}
                  />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] mt-0.5">
                  <span className="font-semibold text-[var(--primary)]">
                    {STAGE_LABEL[lead.lifecycleStage] || lead.lifecycleStage}
                  </span>
                  <span>•</span>
                  <span>{lead.projectType || 'Interior'}</span>
                  {lead.city && (
                    <>
                      <span>•</span>
                      <span className="truncate">{lead.city}</span>
                    </>
                  )}
                </div>
                {lead.phone && (
                  <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] mt-0.5">
                    <Phone size={10} />
                    <span>{lead.phone}</span>
                  </div>
                )}
              </div>

              {/* Time */}
              <div className="shrink-0 text-right">
                <p className="text-[11px] font-semibold text-[var(--text-muted)]">
                  {relativeTime(lead.lastInteractionAt)}
                </p>
                <ChevronRight
                  size={14}
                  className="ml-auto text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors"
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
};

export default HotLeadsPanel;
