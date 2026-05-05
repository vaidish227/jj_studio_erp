import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare,
  RotateCcw,
  Eye,
  Edit3,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
} from 'lucide-react';
import { Button, Loader, StatusBadge } from '../../../shared/components';
import { crmService } from '../../../shared/services/crmService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import ConfirmationModal from '../../../shared/components/ConfirmationModal/ConfirmationModal';
import { formatDateMedium, formatTimeOnly } from '../../../shared/utils/dateUtils';
import useFilters from '../../../shared/filters/useFilters';
import AdvancedFilter from '../../../shared/filters/AdvancedFilter';

const ApprovalDashboard = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState([]);

  // Read user role from localStorage (same pattern as ReviewPage)
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user')) || {}; } catch { return {}; }
  })();

  // Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    proposal: null,
    action: '',
    status: '',
    title: '',
    message: ''
  });

  const {
    filters,
    hasActiveFilters,
    activeFilterCount,
    filterConfig,
    updateFilter,
    clearAllFilters,
    process
  } = useFilters('proposal', 'approval');

  const fetchProposals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await crmService.getProposals();
      setProposals(res?.proposals || []);
    } catch (err) {
      toast.error('Failed to load proposals');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const handleAction = async (remarks) => {
    try {
      setLoading(true);
      await crmService.updateProposalStatus(confirmModal.proposal._id, {
        status: confirmModal.status,
        remarks
      });
      toast.success(`Proposal ${confirmModal.action}d successfully`);
      setConfirmModal({ ...confirmModal, isOpen: false });
      fetchProposals();
    } catch (err) {
      toast.error(`Failed to ${confirmModal.action} proposal`);
    } finally {
      setLoading(false);
    }
  };

  const openConfirmModal = (proposal, action, status, title, message) => {
    setConfirmModal({ isOpen: true, proposal, action, status, title, message });
  };

  // Apply reusable filter system
  const filteredProposals = process(proposals);

  const isFinal = (status) => ['sent', 'project_started', 'project_ready', 'esign_received', 'payment_received'].includes(status);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="border-l-4 border-[var(--primary)] pl-4">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Manager Approval</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {loading ? 'Fetching proposals...' : `${filteredProposals.length} proposal${filteredProposals.length !== 1 ? 's' : ''} found`}
          </p>
        </div>
        <Button variant="outline" onClick={fetchProposals} className="w-full sm:w-auto">
          <RotateCcw size={16} />
          Refresh
        </Button>
      </div>

      {/* ── Advanced Filter System ── */}
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

      {/* ── Table ── */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Client & Proposal</th>
                <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest text-right">Amount</th>
                <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest text-center">Submitted</th>
                <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-20 text-center">
                    <Loader label="Fetching proposals..." />
                  </td>
                </tr>
              ) : filteredProposals.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-[var(--bg)] flex items-center justify-center">
                        <AlertCircle size={28} className="text-[var(--text-muted)] opacity-40" />
                      </div>
                      <p className="text-sm text-[var(--text-muted)]">
                        No proposals found.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProposals.map((p) => (
                  <tr
                    key={p._id}
                    className="hover:bg-[var(--bg)] transition-colors cursor-pointer group"
                    onClick={() => navigate(`/proposal/review/${p._id}`)}
                  >
                    {/* Client & Proposal */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] font-black text-xs shrink-0">
                          PR
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors leading-tight">
                            {p.clientId?.name || p.leadId?.name || 'Unknown Client'}
                          </p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5 font-medium">
                            {p.title || 'Untitled Proposal'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={p.status} />
                    </td>

                    {/* Amount */}
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-bold text-[var(--text-primary)]">
                        ₹{Number(p.finalAmount || 0).toLocaleString('en-IN')}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wider mt-0.5">
                        Incl. GST
                      </p>
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 text-center">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {formatDateMedium(p.createdAt)}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {formatTimeOnly(p.createdAt)}
                      </p>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {/* View */}
                        <ActionIcon
                          icon={<Eye size={15} />}
                          onClick={() => navigate(`/proposal/review/${p._id}`)}
                          title="View Proposal"
                        />

                        {/* Edit / Reject / Approve — for non-finalized proposals */}
                        {!isFinal(p.status) && (
                          <>
                            <ActionIcon
                              icon={<Edit3 size={15} />}
                              onClick={() => navigate(`/proposal/create?id=${p._id}`)}
                              title="Edit Proposal"
                            />
                            <ActionIcon
                              icon={<ThumbsDown size={15} />}
                              onClick={() =>
                                openConfirmModal(
                                  p, 'reject', 'rejected',
                                  'Reject Proposal',
                                  `Reject "${p.title || 'this proposal'}"? The creator will be notified.`
                                )
                              }
                              title="Reject"
                              danger
                            />
                            <ActionIcon
                              icon={<ThumbsUp size={15} />}
                              onClick={() =>
                                openConfirmModal(
                                  p, 'approve', 'manager_approved',
                                  'Approve Proposal',
                                  `Approve "${p.title || 'this proposal'}"? It will be sent to the client automatically.`
                                )
                              }
                              title="Approve"
                              success
                            />
                          </>
                        )}

                        {/* Review CTA */}
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate(`/proposal/review/${p._id}`)}
                          className="font-bold ml-1"
                        >
                          Review
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Confirmation Modal ── */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={handleAction}
        title={confirmModal.title}
        message={confirmModal.message}
        isLoading={loading}
        showRemarks={confirmModal.action === 'reject'}
        isRemarksMandatory={confirmModal.action === 'reject'}
        remarksPlaceholder="Enter rejection reason (mandatory)..."
        variant={confirmModal.action === 'reject' ? 'danger' : 'primary'}
        confirmLabel={confirmModal.action === 'reject' ? 'Reject Proposal' : 'Approve Proposal'}
      />
    </div>
  );
};

// ── Small icon button ──────────────────────────────────────────────────────────
const ActionIcon = ({ icon, onClick, title, danger = false, success = false }) => (
  <button
    onClick={onClick}
    title={title}
    className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-150
      ${danger
        ? 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--error)]/40 hover:text-[var(--error)] hover:bg-[var(--error)]/5'
        : success
        ? 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--success)]/40 hover:text-[var(--success)] hover:bg-[var(--success)]/5'
        : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]/40 hover:text-[var(--primary)] hover:bg-[var(--primary)]/5'
      }
    `}
  >
    {icon}
  </button>
);

export default ApprovalDashboard;
