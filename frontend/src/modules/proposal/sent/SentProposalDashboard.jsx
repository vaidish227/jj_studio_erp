import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RotateCcw,
  Eye,
  FileCheck,
  CreditCard,
  Clock,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';
import { Button, Loader, StatusBadge } from '../../../shared/components';
import { crmService } from '../../../shared/services/crmService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import useFilters from '../../../shared/filters/useFilters';
import AdvancedFilter from '../../../shared/filters/AdvancedFilter';
import PaymentStatusModal from '../../../shared/components/PaymentStatusModal';

// ─── eSign Confirmation Modal ────────────────────────────────────────────────
const EsignModal = ({ proposal, onClose, onConfirm, isLoading }) => {
  const [signedAt, setSignedAt] = useState(new Date().toISOString().split('T')[0]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-teal)]/10 text-[var(--accent-teal)] flex items-center justify-center">
              <FileCheck size={18} />
            </div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">Confirm eSign Received</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg)] text-[var(--text-muted)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Client Info */}
          <div className="bg-[var(--bg)] p-4 rounded-xl border border-[var(--border)]">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">Proposal</p>
            <p className="text-sm font-bold text-[var(--text-primary)]">{proposal.clientId?.name || proposal.leadId?.name}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{proposal.title}</p>
          </div>

          {/* Signed Date */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Date Signed</label>
            <input
              type="date"
              value={signedAt}
              onChange={(e) => setSignedAt(e.target.value)}
              className="w-full px-4 py-3 text-sm rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all"
            />
          </div>

          <p className="text-xs text-[var(--text-muted)] italic">
            Confirming will mark the eSign as received and update the proposal lifecycle.
          </p>
        </div>

        <div className="flex gap-3 p-6 border-t border-[var(--border)]">
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="flex-1">Cancel</Button>
          <Button
            variant="primary"
            onClick={() => onConfirm({ signedAt })}
            isLoading={isLoading}
            className="flex-1 font-bold"
          >
            <FileCheck size={15} /> Confirm eSign
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Payment Confirmation Modal ───────────────────────────────────────────────
const PaymentModal = ({ proposal, onClose, onConfirm, isLoading }) => {
  return (
    <PaymentStatusModal
      proposal={proposal}
      onClose={onClose}
      onConfirm={onConfirm}
      isLoading={isLoading}
    />
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const SentProposalDashboard = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [proposals, setProposals] = useState([]);

  // Modal state
  const [esignModal, setEsignModal] = useState(null);   // proposal object
  const [paymentModal, setPaymentModal] = useState(null); // proposal object

  const {
    filters,
    hasActiveFilters,
    activeFilterCount,
    filterConfig,
    updateFilter,
    clearAllFilters,
    process
  } = useFilters('proposal', 'sent');

  const fetchProposals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await crmService.getProposals({ status: 'sent,esign_received,payment_received,project_ready,project_started' });
      setProposals(res?.proposals || []);
    } catch (err) {
      toast.error('Failed to load sent proposals');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  const handleEsignConfirm = async ({ signedAt }) => {
    try {
      setActionLoading(true);
      await crmService.updateProposalStatus(esignModal._id, {
        status: 'esign_received',
        signedAt,
        remarks: 'eSign confirmed by admin'
      });
      toast.success('eSign marked as received!');
      setEsignModal(null);
      fetchProposals();
    } catch (err) {
      toast.error('Failed to update eSign status');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePaymentConfirm = async (form) => {
    try {
      setActionLoading(true);
      const newStatus = form.status === 'received' ? 'payment_received' : 'sent';
      
      await crmService.updateProposalStatus(paymentModal._id, {
        status: newStatus,
        paymentStatus: form.status,
        paidOn: form.paidOn,
        remarks: `Payment status updated to ${form.status}`
      });
      
      toast.success('Payment status updated successfully!');
      setPaymentModal(null);
      fetchProposals();
    } catch (err) {
      toast.error('Failed to update payment status');
    } finally {
      setActionLoading(false);
    }
  };

  // Apply reusable filter system
  const filteredProposals = process(proposals);

  const esignDone = (p) => p.esign?.status === 'received' || ['esign_received', 'payment_received', 'project_ready', 'project_started'].includes(p.status);
  const paymentStatus = (p) => {
    if (['payment_received', 'project_ready', 'project_started'].includes(p.status)) return 'received';
    return 'pending';
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="border-l-4 border-[var(--primary)] pl-4">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Sent & eSign Track</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {loading ? 'Loading...' : `${filteredProposals.length} proposal${filteredProposals.length !== 1 ? 's' : ''} being tracked`}
          </p>
        </div>
        <Button variant="outline" onClick={fetchProposals} className="w-full sm:w-auto">
          <RotateCcw size={16} /> Refresh
        </Button>
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

      {/* Table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Client & Proposal</th>
                <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest text-center">eSign</th>
                <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest text-center">Payment Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr><td colSpan="5" className="py-20 text-center"><Loader label="Tracking lifecycle..." /></td></tr>
              ) : filteredProposals.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-[var(--bg)] flex items-center justify-center">
                        <AlertCircle size={28} className="text-[var(--text-muted)] opacity-40" />
                      </div>
                      <p className="text-sm text-[var(--text-muted)]">No sent proposals being tracked.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProposals.map((p) => (
                  <tr
                    key={p._id}
                    className="hover:bg-[var(--bg)] transition-colors group cursor-pointer"
                    onClick={() => navigate(`/proposal/sent/${p._id}`)}
                  >
                    {/* Client & Proposal */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] font-black text-xs shrink-0">PR</div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                            {p.clientId?.name || p.leadId?.name}
                          </p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5 font-medium">{p.title}</p>
                        </div>
                      </div>
                    </td>

                    {/* eSign */}
                    <td className="px-6 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                      {esignDone(p) ? (
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="flex items-center gap-1.5 text-[var(--accent-teal)] text-xs font-bold">
                            <FileCheck size={14} /> Received
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)]">Mark Signed</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs font-medium">
                            <Clock size={14} /> Pending
                          </span>
                          <button
                            onClick={() => setEsignModal(p)}
                            className="text-[10px] font-bold text-[var(--primary)] hover:underline uppercase tracking-wide"
                          >
                            Mark Signed
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Payment Status */}
                    <td className="px-6 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                      {paymentStatus(p) === 'received' ? (
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="flex items-center gap-1.5 text-[var(--success)] text-xs font-bold">
                            <CreditCard size={14} /> Received
                          </span>
                          <span className="text-[9px] text-[var(--text-muted)]">Payment Complete</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="flex items-center gap-1.5 text-[var(--warning)] text-xs font-bold">
                            <Clock size={14} /> Pending
                          </span>
                          <button
                            onClick={() => setPaymentModal(p)}
                            className="text-[10px] font-bold text-[var(--primary)] hover:underline uppercase tracking-wide"
                          >
                            Update Status
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/proposal/sent/${p._id}`)}
                          title="Review Detail"
                          className="w-8 h-8 rounded-lg border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--primary)] hover:border-[var(--primary)]/40 transition-all"
                        >
                          <Eye size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {esignModal && (
        <EsignModal
          proposal={esignModal}
          onClose={() => setEsignModal(null)}
          onConfirm={handleEsignConfirm}
          isLoading={actionLoading}
        />
      )}
      {paymentModal && (
        <PaymentModal
          proposal={paymentModal}
          onClose={() => setPaymentModal(null)}
          onConfirm={handlePaymentConfirm}
          isLoading={actionLoading}
        />
      )}
    </div>
  );
};

export default SentProposalDashboard;
