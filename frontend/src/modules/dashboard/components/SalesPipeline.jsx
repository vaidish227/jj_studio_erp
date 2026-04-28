import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';

// ─── Single Lead Row ─────────────────────────────────────────────────────────
const LeadRow = ({ name, phone, project, daysAgo, onClick }) => (
  <button onClick={onClick} className="w-full flex items-start justify-between py-3 border-b border-[var(--border)] last:border-0 text-left">
    <div className="flex items-start gap-2">
      <span className="text-[var(--text-muted)] mt-1">⠿</span>
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">{name}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{phone}</p>
        <p className="text-xs font-medium text-[var(--primary)] mt-0.5">{project}</p>
      </div>
    </div>
    <span className="text-xs text-[var(--text-muted)] shrink-0 mt-0.5">{daysAgo}</span>
  </button>
);

// ─── Pipeline Column ─────────────────────────────────────────────────────────
const PipelineColumn = ({ title, count, leads, bgClass, onItemClick }) => (
  <div className={`flex-1 rounded-xl p-4 ${bgClass}`}>
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
      <span className="text-xs font-bold text-[var(--text-muted)] bg-[var(--border)] px-2 py-0.5 rounded-full">
        {count}
      </span>
    </div>
    <div>
      {leads.length ? leads.map((lead, i) => (
        <LeadRow key={i} {...lead} onClick={() => onItemClick?.(lead)} />
      )) : (
        <p className="text-sm text-[var(--text-muted)] py-4">No items to show.</p>
      )}
    </div>
  </div>
);

const getRelativeTime = (dateValue) => {
  if (!dateValue) return '—';
  const diffMs = Date.now() - new Date(dateValue).getTime();
  const diffHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)} day ago`;
};

const SalesPipeline = ({ pipeline }) => {
  const navigate = useNavigate();
  const newLeads = (pipeline?.newLeads || []).map((lead) => ({
    id: lead._id,
    name: lead.name,
    phone: lead.phone,
    project: lead.projectType || 'Interior Project',
    daysAgo: getRelativeTime(lead.createdAt),
  }));
  const meetingLeads = (pipeline?.meetings || []).map((meeting) => ({
    id: meeting.leadId?._id,
    name: meeting.leadId?.name,
    phone: meeting.leadId?.phone,
    project: meeting.leadId?.projectType || 'Meeting',
    daysAgo: meeting.date ? new Date(meeting.date).toLocaleDateString('en-IN') : '—',
  }));
  const proposalLeads = (pipeline?.proposals || []).map((lead) => ({
    id: lead._id,
    name: lead.name,
    phone: lead.phone,
    project: lead.projectType || 'Proposal',
    daysAgo: getRelativeTime(lead.updatedAt || lead.createdAt),
  }));

  return (
    <Card padding="p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-bold text-[var(--text-primary)]">Sales Pipeline</h2>
        <span className="text-xs text-[var(--text-muted)] font-medium bg-[var(--bg)] px-3 py-1 rounded-full">
          Live Flow
        </span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
        <div className="min-w-[280px] flex-1">
          <PipelineColumn
            title="New Leads"
            count={newLeads.length}
            leads={newLeads}
            bgClass="bg-[var(--bg)]"
            onItemClick={(lead) => navigate(`/crm/leads/${lead.id}`)}
          />
        </div>
        <div className="min-w-[280px] flex-1">
          <PipelineColumn
            title="Meetings"
            count={meetingLeads.length}
            leads={meetingLeads}
            bgClass="bg-[var(--bg)]"
            onItemClick={(lead) => navigate(`/crm/leads/${lead.id}`)}
          />
        </div>
        <div className="min-w-[280px] flex-1">
          <PipelineColumn
            title="Proposals"
            count={proposalLeads.length}
            leads={proposalLeads}
            bgClass="bg-[var(--bg)]"
            onItemClick={(lead) => navigate(`/crm/leads/${lead.id}`)}
          />
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-[var(--border)]">
        <Button variant="ghost" size="sm" className="text-[var(--primary)] hover:bg-[var(--primary)]/5" onClick={() => navigate('/crm/new-leads')}>
          View Detailed Pipeline
        </Button>
      </div>
    </Card>
  );
};

export default SalesPipeline;
