import React, { useEffect, useState } from 'react';
import { FileText, Loader2, ExternalLink, Mail, CheckCircle2, XCircle, Clock, Send, Eye, Edit3, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';
import StatusBadge from '../../../shared/components/StatusBadge/StatusBadge';
import { crmService } from '../../../shared/services/crmService';
import { formatDateShort } from '../../../shared/utils/dateUtils';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { Loader, Pagination } from '../../../shared/components';
import useFilters from '../../../shared/filters/useFilters';
import AdvancedFilter from '../../../shared/filters/AdvancedFilter';
import { filterByMilestone, MILESTONE_LABELS } from '../utils/milestoneFilter';

const PAGE_SIZE = 25;

const ProposalListPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [proposals, setProposals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const milestone = searchParams.get('milestone'); // pending_approval | approved | rejected | sent | esign | advance

  const fetchProposals = async () => {
    setIsLoading(true);
    try {
      const response = await crmService.getProposals();
      setProposals(response.proposals || []);
    } catch (err) {
      toast.error('Failed to fetch proposals');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const {
    filters,
    hasActiveFilters,
    activeFilterCount,
    filterConfig,
    updateFilter,
    clearAllFilters,
    process
  } = useFilters('proposal', 'proposals');

  // Apply ?milestone= first (from dashboard card clicks), then the saved
  // AdvancedFilter system on top so search/date/etc still work.
  const milestoneScoped = filterByMilestone(proposals, milestone);
  const filteredProposals = process(milestoneScoped);

  // 25/page pagination — page resets to 1 when filters or milestone change.
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [filters, milestone]);
  const totalPages = Math.max(1, Math.ceil(filteredProposals.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paginated = filteredProposals.slice(pageStart, pageStart + PAGE_SIZE);

  const clearMilestone = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('milestone');
    setSearchParams(next, { replace: true });
  };

  // Count real line items from the dynamic content structure
  // (content.sections[].structure.rows, excluding group-header rows).
  const countLineItems = (proposal) =>
    (proposal.content?.sections || []).reduce(
      (total, section) =>
        total + (section.structure?.rows || []).filter((row) => !row.isGroupHeader).length,
      0
    );

  const handleSendEmail = async (id) => {
    try {
      await crmService.sendProposal(id);
      toast.success('Proposal sent successfully');
      fetchProposals(); // Refresh to show 'sent' status
    } catch (err) {
      toast.error('Failed to send proposal email');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="border-l-4 border-[var(--accent-teal)] pl-4">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Proposal Management</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {isLoading ? 'Fetching proposals...' : `${filteredProposals.length} proposals found`}
          </p>
        </div>
      </div>

      {milestone && MILESTONE_LABELS[milestone] && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--primary)]/5 border border-[var(--primary)]/20">
          <span className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Showing</span>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold">
            {MILESTONE_LABELS[milestone]}
            <button
              onClick={clearMilestone}
              className="rounded-full hover:bg-[var(--primary)]/20 p-0.5"
              title="Clear this filter"
            >
              <X size={12} />
            </button>
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            ({filteredProposals.length} of {proposals.length})
          </span>
        </div>
      )}

      <AdvancedFilter
        filters={filters}
        filterConfig={filterConfig}
        updateFilter={updateFilter}
        clearAllFilters={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
      />

      {isLoading ? (
        <Loader label="Fetching proposals..." />
      ) : filteredProposals.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {paginated.map((proposal) => (
            <Card 
              key={proposal._id} 
              className="hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate(`/proposal/review/${proposal._id}`)}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[var(--accent-teal)]/10 text-[var(--accent-teal)] flex items-center justify-center shrink-0">
                    <FileText size={24} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <p className="text-base font-bold text-[var(--text-primary)]">
                        {proposal.clientId?.name || proposal.leadId?.name || 'Unknown Client'}
                      </p>
                      <span className="text-xs text-[var(--text-muted)]">#{String(proposal._id || '').slice(-6).toUpperCase()}</span>
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">
                      Created on {formatDateShort(proposal.createdAt)}
                    </p>
                    <div className="flex items-center gap-4 text-xs font-medium mt-2">
                      <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                        Items: {countLineItems(proposal)}
                      </span>
                      <span className="flex items-center gap-1 text-[var(--primary)]">
                        Total: ₹{Number(proposal.finalAmount || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <div className="flex flex-col items-end gap-2 mr-4">
                    <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Status</span>
                    <StatusBadge status={proposal.status} />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/proposal/review/${proposal._id}`)}
                      className="font-bold"
                    >
                      <Eye size={14} className="mr-2" />
                      Review
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/crm/leads/${proposal.leadId?._id || proposal.leadId}`)}
                      className="font-bold"
                    >
                      <ExternalLink size={14} className="mr-2" />
                      View Lead
                    </Button>
                    {(proposal.status === 'draft' || proposal.status === 'rejected') && (
                      <Button 
                        variant="primary" 
                        size="sm"
                        onClick={() => navigate(`/proposal/create?id=${proposal._id}`)}
                        className="font-bold"
                      >
                        <Edit3 size={14} className="mr-2" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-xs text-[var(--text-muted)] font-medium">
                Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredProposals.length)} of {filteredProposals.length}
              </p>
              <Pagination currentPage={safePage} totalPages={totalPages} onChange={setCurrentPage} />
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-24 bg-[var(--surface)] rounded-2xl border border-dashed border-[var(--border)]">
          <FileText size={48} className="text-[var(--text-muted)] opacity-60 mx-auto mb-4" />
          <p className="text-[var(--text-muted)] text-sm">
            No proposals found.
          </p>
        </div>
      )}
    </div>
  );
};

export default ProposalListPage;
