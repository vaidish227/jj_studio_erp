import React from 'react';
import { PenTool } from 'lucide-react';

const ESignReceivedPage = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="border-l-4 border-[var(--primary)] pl-4">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">eSign Received</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Proposals with digital signatures received.
          </p>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center">
        <PenTool size={48} className="text-[var(--text-muted)] opacity-20 mx-auto mb-4" />
        <p className="text-[var(--text-muted)]">No eSignatures received yet.</p>
      </div>
    </div>
  );
};

export default ESignReceivedPage;
