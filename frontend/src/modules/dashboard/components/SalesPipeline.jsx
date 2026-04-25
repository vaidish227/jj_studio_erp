import React from 'react';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';

// ─── Single Lead Row ─────────────────────────────────────────────────────────
const LeadRow = ({ name, phone, project, daysAgo }) => (
  <div className="flex items-start justify-between py-3 border-b border-[var(--border)] last:border-0">
    <div className="flex items-start gap-2">
      <span className="text-[var(--text-muted)] mt-1">⠿</span>
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">{name}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{phone}</p>
        <p className="text-xs font-medium text-[var(--primary)] mt-0.5">{project}</p>
      </div>
    </div>
    <span className="text-xs text-[var(--text-muted)] shrink-0 mt-0.5">{daysAgo}</span>
  </div>
);

// ─── Pipeline Column ─────────────────────────────────────────────────────────
const PipelineColumn = ({ title, count, leads, bgClass }) => (
  <div className={`flex-1 rounded-xl p-4 ${bgClass}`}>
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
      <span className="text-xs font-bold text-[var(--text-muted)] bg-[var(--border)] px-2 py-0.5 rounded-full">
        {count}
      </span>
    </div>
    <div>
      {leads.map((lead, i) => (
        <LeadRow key={i} {...lead} />
      ))}
    </div>
  </div>
);

// ─── Sales Pipeline ───────────────────────────────────────────────────────────
const newLeads = [
  { name: 'Raj Patel',    phone: '+91 98765 43210', project: 'Living Room Renovation', daysAgo: '2 days ago' },
  { name: 'Sneha Sharma', phone: '+91 87654 32109', project: 'Kitchen Interior',       daysAgo: '3 days ago' },
];

const contactedLeads = [
  { name: 'Amit Kumar',  phone: '+91 76543 21098', project: 'Office Interior', daysAgo: '1 day ago' },
  { name: 'Priya Verma', phone: '+91 65432 10987', project: 'Bedroom Design',  daysAgo: '2 days ago' },
];

const SalesPipeline = () => {
  return (
    <Card padding="p-6">
      <h2 className="text-base font-bold text-[var(--text-primary)] mb-5">Sales Pipeline</h2>

      <div className="flex flex-col sm:flex-row gap-4">
        <PipelineColumn
          title="New"
          count={2}
          leads={newLeads}
          bgClass="bg-[var(--bg)]"
        />
        <PipelineColumn
          title="Contacted"
          count={4}
          leads={contactedLeads}
          bgClass="bg-[var(--bg)]"
        />
      </div>

      <div className="mt-5">
        <Button variant="outline" size="sm">
          View Full Pipeline
        </Button>
      </div>
    </Card>
  );
};

export default SalesPipeline;
