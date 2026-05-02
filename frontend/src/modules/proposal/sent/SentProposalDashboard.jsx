import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
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
  const [form, setForm] = useState({
    amount: proposal.finalAmount || '',
    paymentMethod: 'bank_transfer',
    transactionRef: '',
    paidOn: new Date().toISOString().split('T')[0],
  });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--success)]/10 text-[var(--success)] flex items-center justify-center">
              <CreditCard size={18} />
            </div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">Confirm Advance Payment</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg)] text-[var(--text-muted)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Client Info */}
          <div className="bg-[var(--bg)] p-4 rounded-xl border border-[var(--border)]">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">Client</p>
            <p className="text-sm font-bold text-[var(--text-primary)]">{proposal.clientId?.name || proposal.leadId?.name}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{proposal.clientId?.phone || proposal.leadId?.phone}</p>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Advance Amount (₹)</label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              placeholder="Enter amount received..."
              className="w-full px-4 py-3 text-sm rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all font-bold"
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Payment Method</label>
            <select
              value={form.paymentMethod}
              onChange={(e) => set('paymentMethod', e.target.value)}
              className="w-full px-4 py-3 text-sm rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] transition-all"
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
            </select>
          </div>

          {/* Transaction Ref */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Transaction Ref / Cheque No. (Optional)</label>
            <input
              type="text"
              value={form.transactionRef}
              onChange={(e) => set('transactionRef', e.target.value)}
              placeholder="e.g. TXN123456 or N/A"
              className="w-full px-4 py-3 text-sm rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all"
            />
          </div>

          {/* Paid On */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Payment Date</label>
            <input
              type="date"
              value={form.paidOn}
              onChange={(e) => set('paidOn', e.target.value)}
              className="w-full px-4 py-3 text-sm rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] transition-all"
            />
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-[var(--border)]">
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="flex-1">Cancel</Button>
          <Button
            variant="primary"
            onClick={() => onConfirm(form)}
            isLoading={isLoading}
            disabled={!form.amount}
            className="flex-1 font-bold"
          >
            <CreditCard size={15} /> Confirm Payment
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const SentProposalDashboard = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [esignModal, setEsignModal] = useState(null);   // proposal object
  const [paymentModal, setPaymentModal] = useState(null); // proposal object

  useEffect(() => { fetchProposals(); }, []);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const res = await crmService.getProposals({ status: 'sent,esign_received,payment_received,project_ready,project_started' });
      setProposals(res?.proposals || []);
    } catch (err) {
      toast.error('Failed to load sent proposals');
    } finally {
      setLoading(false);
    }
  };

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
      await crmService.updateProposalStatus(paymentModal._id, {
        status: 'payment_received',
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        transactionRef: form.transactionRef || 'N/A',
        paidOn: form.paidOn,
        remarks: `Advance payment received via ${form.paymentMethod}`
      });
      toast.success('Payment marked as received!');
      setPaymentModal(null);
      fetchProposals();
    } catch (err) {
      toast.error('Failed to update payment status');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredProposals = proposals.filter(p =>
    p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.clientId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.leadId?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const esignDone = (p) => p.esign?.status === 'received' || ['esign_received', 'payment_received', 'project_ready', 'project_started'].includes(p.status);
  const paymentDone = (p) => p.payments?.status === 'received' || ['payment_received', 'project_ready', 'project_started'].includes(p.status);

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

      {/* Search */}
      <div className="relative group">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors" />
        <input
          type="text"
          placeholder="Search by client or proposal..."
          className="w-full pl-11 pr-4 py-3 text-sm rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Client & Proposal</th>
                <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest text-center">eSign</th>
                <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest text-center">Payment</th>
                <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest text-right">Amount</th>
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

                    {/* Payment */}
                    <td className="px-6 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                      {paymentDone(p) ? (
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="flex items-center gap-1.5 text-[var(--success)] text-xs font-bold">
                            <CreditCard size={14} /> Paid
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)]">Mark Paid</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs font-medium">
                            <Clock size={14} /> Pending
                          </span>
                          <button
                            onClick={() => setPaymentModal(p)}
                            className="text-[10px] font-bold text-[var(--primary)] hover:underline uppercase tracking-wide"
                          >
                            Mark Paid
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Amount + Status Badge */}
                    <td className="px-6 py-5 text-right">
                      <p className="text-sm font-bold text-[var(--text-primary)]">₹{Number(p.finalAmount || 0).toLocaleString('en-IN')}</p>
                      <div className="mt-1.5 flex justify-end">
                        <StatusBadge status={p.status} />
                      </div>
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
