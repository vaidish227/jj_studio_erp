import React, { useEffect, useState, useCallback } from 'react';
import { Users, Loader2, FilePlus, FileText, Phone, Mail, ArrowRight, MapPin, CalendarDays, Building2, CheckSquare, Square, X, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { crmService } from '../../../shared/services/crmService';
import Button from '../../../shared/components/Button/Button';
import StatusBadge from '../../../shared/components/StatusBadge/StatusBadge';
import Avatar from '../../../shared/components/Avatar/Avatar';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { Loader, Pagination, ConfirmationModal } from '../../../shared/components';
import useFilters from '../../../shared/filters/useFilters';
import AdvancedFilter from '../../../shared/filters/AdvancedFilter';

const PAGE_SIZE = 25;

const ProposalClientsPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  // Map of leadId -> { id, status } for the lead's most recent proposal. Lets us
  // route a click to the proposal review page when the lead already has a proposal
  // (instead of always starting a fresh draft) and decide whether a "Send for
  // Approval" action applies (only draft proposals can be submitted).
  const [proposalByLead, setProposalByLead] = useState({});

  const {
    filters,
    hasActiveFilters,
    activeFilterCount,
    filterConfig,
    updateFilter,
    clearAllFilters,
    process
  } = useFilters('proposal', 'clients');

  const fetchInterestedLeads = useCallback(async () => {
    setLoading(true);
    try {
      // Pull leads who are ready for a proposal (interested) or already have one in progress
      const response = await crmService.getLeads({
        lifecycleStage: 'interested,proposal_sent,advance_received,project_moved',
        limit: 100,
      });
      setLeads(response.leads || []);
    } catch (err) {
      toast.error('Failed to fetch clients from CRM.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Build a leadId -> proposalId map so existing proposals open in the review
  // page rather than re-routing through the create flow. Proposals come back
  // sorted newest-first, so the first one seen per lead is the most recent.
  const fetchExistingProposals = useCallback(async () => {
    try {
      const response = await crmService.getProposals();
      const map = {};
      (response.proposals || []).forEach((p) => {
        const leadId = p.leadId?._id || p.leadId;
        if (leadId && !map[leadId]) map[leadId] = { id: p._id, status: p.status };
      });
      setProposalByLead(map);
    } catch (err) {
      // Non-fatal: without the map we simply fall back to the create flow.
    }
  }, []);

  useEffect(() => {
    fetchInterestedLeads();
    fetchExistingProposals();
  }, [fetchInterestedLeads, fetchExistingProposals]);

  // Route a client to its existing proposal (review page) when one exists,
  // otherwise start a new draft.
  const goToLead = useCallback((leadId) => {
    const proposalId = proposalByLead[leadId]?.id;
    navigate(proposalId ? `/proposal/review/${proposalId}` : `/proposal/create?leadId=${leadId}`);
  }, [navigate, proposalByLead]);

  // Apply reusable filter system
  const filteredLeads = process(leads);

  // 25/page pagination — page resets to 1 when filters change.
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [filters]);
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paginatedLeads = filteredLeads.slice(pageStart, pageStart + PAGE_SIZE);

  // Multi-select state — chosen client IDs that will be sent in bulk to
  // CreateProposalPage via ?leadIds=id1,id2,...
  const [selectedIds, setSelectedIds] = useState([]);
  const toggleSelect = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const clearSelection = () => setSelectedIds([]);
  // "Select all on this page" — toggles between empty and the full visible page.
  const pageIds = paginatedLeads.map((l) => l._id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const togglePageSelection = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleDraftSelected = () => {
    if (selectedIds.length === 0) return;
    // Single = use the same single-leadId URL the existing buttons use.
    // Multiple = use leadIds (comma-separated) which CreateProposalPage now reads.
    const url = selectedIds.length === 1
      ? `/proposal/create?leadId=${selectedIds[0]}`
      : `/proposal/create?leadIds=${selectedIds.join(',')}`;
    navigate(url);
  };

  // --- Send for Manager Approval ---------------------------------------------
  // Only draft proposals can be submitted (draft -> pending_approval). We track
  // the target proposal _id(s) in the confirm modal so one handler serves both
  // the single per-card button and the bulk action.
  const [sendConfirm, setSendConfirm] = useState({ open: false, proposalIds: [] });
  const [sending, setSending] = useState(false);

  // Proposal ids for the currently-selected leads that are still in draft.
  const sendableProposalIds = selectedIds
    .map((leadId) => (proposalByLead[leadId]?.status === 'draft' ? proposalByLead[leadId].id : null))
    .filter(Boolean);

  const openSendForLead = (leadId) => {
    const pid = proposalByLead[leadId]?.id;
    if (pid) setSendConfirm({ open: true, proposalIds: [pid] });
  };

  const openSendForSelected = () => {
    if (sendableProposalIds.length > 0) setSendConfirm({ open: true, proposalIds: sendableProposalIds });
  };

  const runSendForApproval = async () => {
    const ids = sendConfirm.proposalIds;
    setSendConfirm({ open: false, proposalIds: [] });
    if (ids.length === 0) return;
    try {
      setSending(true);
      // allSettled so one failed row doesn't swallow the rest of the batch.
      const results = await Promise.allSettled(
        ids.map((id) => crmService.updateProposalStatus(id, { status: 'pending_approval' }))
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      const ok = results.length - failed;
      if (failed > 0) {
        toast.error(`${ok} sent for approval, ${failed} failed. Retry the failed ones individually.`);
      } else {
        toast.success(`${ok} proposal${ok === 1 ? '' : 's'} sent for manager approval.`);
      }
      clearSelection();
      fetchExistingProposals(); // refresh statuses so the buttons reflect the new state
    } catch (err) {
      toast.error('Failed to send for approval.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Draft Proposals</h1>
          <p className="text-[var(--text-muted)] font-medium flex items-center gap-2">
            CRM Leads synced with Proposal Module
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
          </p>
        </div>
        <Button variant="outline" onClick={() => { fetchInterestedLeads(); fetchExistingProposals(); }}>Refresh Data</Button>
      </div>

      {/* Advanced Filter System */}
      <AdvancedFilter
        filters={filters}
        filterConfig={filterConfig}
        updateFilter={updateFilter}
        clearAllFilters={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        showSearch={true}
        compact={false}
      />

      {/* Bulk Action Bar — sticky-feeling primary bar that appears when ≥1 client is ticked. */}
      {selectedIds.length > 0 && (
        <div className="bg-[var(--primary)] text-black p-4 rounded-2xl flex items-center justify-between shadow-lg animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-black/10 flex items-center justify-center font-black">
              {selectedIds.length}
            </div>
            <p className="font-bold uppercase tracking-wider text-sm">
              {selectedIds.length === 1 ? 'Client Selected' : 'Clients Selected'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/20 border-black/10 hover:bg-white/30 text-black font-bold"
              onClick={handleDraftSelected}
            >
              <FilePlus size={16} className="mr-2" />
              Draft {selectedIds.length === 1 ? 'Proposal' : `${selectedIds.length} Proposals`}
            </Button>
            {sendableProposalIds.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="bg-black/85 border-black/10 hover:bg-black text-[var(--primary)] font-bold"
                onClick={openSendForSelected}
                disabled={sending}
              >
                <Send size={16} className="mr-2" />
                Send {sendableProposalIds.length === 1 ? 'for Approval' : `${sendableProposalIds.length} for Approval`}
              </Button>
            )}
            <div className="w-px h-6 bg-black/10 mx-1" />
            <button onClick={clearSelection} className="p-2 hover:bg-black/10 rounded-lg transition-colors" title="Clear selection">
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <Loader label="Syncing with CRM..." />
      ) : filteredLeads.length > 0 ? (
        <div className="space-y-4">
          {/* Select-all-on-page header */}
          <div className="flex items-center justify-between px-2">
            <button
              type="button"
              onClick={togglePageSelection}
              className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
            >
              {allOnPageSelected ? (
                <CheckSquare size={16} className="text-[var(--primary)]" />
              ) : (
                <Square size={16} />
              )}
              {allOnPageSelected ? 'Deselect this page' : `Select all ${paginatedLeads.length} on this page`}
            </button>
            <span className="text-xs text-[var(--text-muted)] font-medium">
              {filteredLeads.length} client{filteredLeads.length === 1 ? '' : 's'} matching filters
            </span>
          </div>

          {paginatedLeads.map((lead) => {
            const isSelected = selectedIds.includes(lead._id);
            const proposal = proposalByLead[lead._id];
            const canSendForApproval = proposal?.status === 'draft';
            return (
            <div
              key={lead._id}
              className={`bg-[var(--surface)] border rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-md hover:shadow-black/5 transition-all duration-200 group cursor-pointer
                ${isSelected ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border)]'}
              `}
              onClick={() => goToLead(lead._id)}
            >
              {/* Checkbox — selection only; doesn't navigate */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleSelect(lead._id); }}
                className={`shrink-0 transition-colors ${isSelected ? 'text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-[var(--primary)]'}`}
                aria-label={isSelected ? 'Deselect client' : 'Select client'}
              >
                {isSelected ? <CheckSquare size={22} /> : <Square size={22} />}
              </button>

              {/* Avatar - matches LeadCard */}
              <Avatar
                name={lead.name}
                size="lg"
                className="bg-[var(--primary)]/20 text-[var(--primary)] font-bold shrink-0"
              />

              {/* Name / Phone / City - matches LeadCard */}
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">{lead.name}</p>
                <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                  <Phone size={13} className="shrink-0" />
                  <span>{lead.phone}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                  <MapPin size={13} className="shrink-0" />
                  <span>{lead.city || 'No location'}</span>
                </div>
              </div>

              {/* Project box - matches LeadCard */}
              <div className="flex items-center gap-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2.5 sm:w-56 shrink-0">
                <Building2 size={18} className="text-[var(--text-muted)] shrink-0" />
                <span className="text-sm text-[var(--text-secondary)] leading-snug line-clamp-2">{lead.projectType}</span>
              </div>

              {/* Date + Status - matches LeadCard */}
              <div className="flex flex-col items-start sm:items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                  <CalendarDays size={14} className="shrink-0" />
                  <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                </div>
                <StatusBadge value={lead.lifecycleStage} type="lifecycle" />
              </div>

              {/* Action Buttons - User wants these smaller */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="primary"
                  className="h-8 px-3 text-[9px] font-black uppercase tracking-widest"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToLead(lead._id);
                  }}
                >
                  {proposal ? <FileText size={12} /> : <FilePlus size={12} />}
                  {proposal ? 'View Proposal' : 'Draft Proposal'}
                </Button>
                {/* Send draft for approval — compact icon button so rows stay
                    aligned whether or not the action is available. */}
                {canSendForApproval && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="aspect-square !p-0 w-8 h-8 flex items-center justify-center border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-black"
                    onClick={(e) => {
                      e.stopPropagation();
                      openSendForLead(lead._id);
                    }}
                    disabled={sending}
                    title="Send this draft proposal to the manager for approval"
                    aria-label="Send for approval"
                  >
                    <Send size={14} />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="aspect-square !p-0 w-8 h-8 flex items-center justify-center hover:bg-[var(--primary)] hover:text-black border-[var(--border)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToLead(lead._id);
                  }}
                >
                  <ArrowRight size={14} className="text-[var(--text-primary)] group-hover:text-black transition-colors" />
                </Button>
              </div>
            </div>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-xs text-[var(--text-muted)] font-medium">
                Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredLeads.length)} of {filteredLeads.length}
              </p>
              <Pagination currentPage={safePage} totalPages={totalPages} onChange={setCurrentPage} />
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-3xl p-16 text-center">
          <div className="w-20 h-20 bg-[var(--bg)] rounded-full flex items-center justify-center mx-auto mb-6">
            <Users size={32} className="text-[var(--text-muted)] opacity-60" />
          </div>
          <h2 className="text-xl font-black text-[var(--text-primary)]">No Interested Leads Found</h2>
          <p className="text-[var(--text-muted)] max-w-sm mx-auto mt-2 font-medium">
            Leads marked as "Interested" in the CRM will automatically appear here for proposal generation.
          </p>
          <Button
            variant="outline"
            className="mt-8"
            onClick={() => navigate('/crm/leads')}
          >
            Go to CRM Pipeline
          </Button>
        </div>
      )}

      <ConfirmationModal
        isOpen={sendConfirm.open}
        onClose={() => setSendConfirm({ open: false, proposalIds: [] })}
        onConfirm={runSendForApproval}
        title="Send for Manager Approval"
        message={
          sendConfirm.proposalIds.length === 1
            ? 'Send this draft proposal to the manager for approval?'
            : `Send ${sendConfirm.proposalIds.length} draft proposals to the manager for approval?`
        }
        confirmLabel="Send for Approval"
        variant="primary"
        isLoading={sending}
      />
    </div>
  );
};

export default ProposalClientsPage;
