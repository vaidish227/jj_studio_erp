import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  RotateCcw,
  ArrowRight,
  Eye,
  CheckCircle2,
  Calendar,
  AlertCircle,
  LayoutGrid,
  List,
} from 'lucide-react';
import { Card, Button, Loader, StatusBadge, Pagination } from '../../../shared/components';

const PAGE_SIZE = 25;
import { crmService } from '../../../shared/services/crmService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { formatDateMedium } from '../../../shared/utils/dateUtils';
import useFilters from '../../../shared/filters/useFilters';
import AdvancedFilter from '../../../shared/filters/AdvancedFilter';
import InitiateProjectModal from '../components/InitiateProjectModal';

const ApprovedDashboard = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState([]);

  const {
    filters,
    hasActiveFilters,
    activeFilterCount,
    filterConfig,
    updateFilter,
    clearAllFilters,
    process
  } = useFilters('proposal', 'approved');

  const fetchProposals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await crmService.getProposals({ status: 'project_ready,project_started' });
      setProposals(res?.proposals || []);
    } catch (err) {
      toast.error('Failed to load project-ready proposals');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  // Apply reusable filter system
  const filteredProposals = process(proposals);

  // 25/page pagination — page resets to 1 when filters change.
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [filters]);
  const totalPages = Math.max(1, Math.ceil(filteredProposals.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paginatedProposals = filteredProposals.slice(pageStart, pageStart + PAGE_SIZE);

  const [modalProposal, setModalProposal] = useState(null);
  const [view, setView] = useState(() => {
    try { return localStorage.getItem('approvedDashboard.view') || 'grid'; }
    catch { return 'grid'; }
  });
  useEffect(() => {
    try { localStorage.setItem('approvedDashboard.view', view); } catch { /* ignore */ }
  }, [view]);

  const handleInitiateClick = (proposal) => {
    setModalProposal(proposal);
  };

  const handleInitiateSuccess = () => {
    setModalProposal(null);
    fetchProposals();
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="border-l-4 border-[var(--primary)] pl-4">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Approved & Ready</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Signed & Paid proposals ready for project initiation.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1 p-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
            <button
              type="button"
              onClick={() => setView('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${view === 'grid'
                  ? 'bg-[var(--primary)] text-black shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            >
              <LayoutGrid size={14} /> Grid
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${view === 'list'
                  ? 'bg-[var(--primary)] text-black shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            >
              <List size={14} /> List
            </button>
          </div>
          <Button variant="outline" onClick={fetchProposals} className="flex-1 sm:flex-none">
            <RotateCcw size={16} /> Refresh
          </Button>
        </div>
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

      {/* Grid */}
      {loading ? (
        <div className="py-20 text-center"><Loader label="Checking project readiness..." /></div>
      ) : filteredProposals.length === 0 ? (
        <div className="py-20 text-center bg-[var(--surface)] rounded-2xl border border-dashed border-[var(--border)]">
          <div className="w-14 h-14 rounded-full bg-[var(--bg)] flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={28} className="text-[var(--text-muted)] opacity-40" />
          </div>
          <p className="text-sm text-[var(--text-muted)]">No proposals are ready to start a project yet.</p>
        </div>
      ) : (
        <>
        {view === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedProposals.map((p) => (
              <Card key={p._id} padding="p-6" className="hover:border-[var(--primary)]/30 transition-all">
                <div className="flex justify-between items-start mb-5">
                  <div className="w-12 h-12 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] font-black text-xs">
                    {p.title?.substring(0, 2).toUpperCase() || 'PR'}
                  </div>
                  <StatusBadge status={p.status} />
                </div>

                <h3 className="text-base font-bold text-[var(--text-primary)] leading-tight">
                  {p.clientId?.name || p.leadId?.name}
                </h3>
                <p className="text-xs text-[var(--text-muted)] font-medium mt-0.5 mb-5">{p.title}</p>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-[var(--bg)] p-3 rounded-xl border border-[var(--border)]">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">eSign</p>
                    <div className="flex items-center gap-1.5 text-[var(--success)] text-[10px] font-bold">
                      <CheckCircle2 size={12} /> Received
                    </div>
                  </div>
                  <div className="bg-[var(--bg)] p-3 rounded-xl border border-[var(--border)]">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">Advance</p>
                    <div className="flex items-center gap-1.5 text-[var(--success)] text-[10px] font-bold">
                      <CheckCircle2 size={12} /> Received
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                    <Calendar size={13} />
                    <span className="text-[10px] font-medium">{formatDateMedium(p.createdAt)}</span>
                  </div>
                  {p.status === 'project_ready' ? (
                    <Button
                      variant="primary"
                      size="sm"
                      className="font-bold"
                      onClick={() => handleInitiateClick(p)}
                    >
                      <ArrowRight size={14} /> Initiate Project
                    </Button>
                  ) : (
                    <div className="text-[var(--success)] text-[10px] font-bold flex items-center gap-1.5">
                      <CheckCircle2 size={13} /> Started
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-[var(--border)] flex justify-between items-center">
                  <button
                    onClick={() => navigate(`/proposal/review/${p._id}`)}
                    className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors flex items-center gap-1.5"
                  >
                    <Eye size={13} /> Review
                  </button>
                  <span className="text-sm font-bold text-[var(--success)]">Payment Received</span>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border)] bg-[var(--bg)]/40">
              <div className="col-span-4">Client / Proposal</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">eSign · Advance</div>
              <div className="col-span-2">Created</div>
              <div className="col-span-2 text-right">Action</div>
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {paginatedProposals.map((p) => (
                <li
                  key={p._id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 px-5 py-4 items-center hover:bg-[var(--bg)]/40 transition-colors"
                >
                  <div className="md:col-span-4 flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] font-black text-[10px] shrink-0">
                      {p.title?.substring(0, 2).toUpperCase() || 'PR'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                        {p.clientId?.name || p.leadId?.name || '—'}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] truncate">{p.title || '—'}</p>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <StatusBadge status={p.status} />
                  </div>

                  <div className="md:col-span-2 flex items-center gap-2 text-[var(--success)] text-[11px] font-bold">
                    <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} /> eSign</span>
                    <span className="text-[var(--border)]">·</span>
                    <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} /> Paid</span>
                  </div>

                  <div className="md:col-span-2 flex items-center gap-1.5 text-[var(--text-muted)] text-xs">
                    <Calendar size={12} />
                    <span>{formatDateMedium(p.createdAt)}</span>
                  </div>

                  <div className="md:col-span-2 flex items-center justify-start md:justify-end gap-2">
                    <button
                      onClick={() => navigate(`/proposal/review/${p._id}`)}
                      className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors flex items-center gap-1.5"
                      title="Review proposal"
                    >
                      <Eye size={13} />
                    </button>
                    {p.status === 'project_ready' ? (
                      <Button
                        variant="primary"
                        size="sm"
                        className="font-bold"
                        onClick={() => handleInitiateClick(p)}
                      >
                        <ArrowRight size={14} /> Initiate
                      </Button>
                    ) : (
                      <div className="text-[var(--success)] text-[10px] font-bold flex items-center gap-1.5">
                        <CheckCircle2 size={13} /> Started
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 pt-4">
            <p className="text-xs text-[var(--text-muted)] font-medium">
              Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredProposals.length)} of {filteredProposals.length}
            </p>
            <Pagination currentPage={safePage} totalPages={totalPages} onChange={setCurrentPage} />
          </div>
        )}
        </>
      )}

      <InitiateProjectModal
        isOpen={!!modalProposal}
        proposal={modalProposal}
        onClose={() => setModalProposal(null)}
        onSuccess={handleInitiateSuccess}
      />
    </div>
  );
};

export default ApprovedDashboard;
