import React from 'react';
import { FileText, Plus } from 'lucide-react';
import Button from '../../../shared/components/Button/Button';

const ProposalTemplatesPage = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="border-l-4 border-[var(--primary)] pl-4">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Quotation Templates</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Manage and create templates for your proposals.
          </p>
        </div>
        <Button variant="primary">
          <Plus size={18} />
          Create Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Placeholder for templates */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center col-span-full">
          <FileText size={48} className="text-[var(--text-muted)] opacity-20 mx-auto mb-4" />
          <p className="text-[var(--text-muted)]">No templates found. Start by creating one.</p>
        </div>
      </div>
    </div>
  );
};

export default ProposalTemplatesPage;
