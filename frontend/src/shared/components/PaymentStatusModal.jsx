import React, { useState } from 'react';
import { CreditCard, X } from 'lucide-react';
import Button from './Button/Button';

/**
 * Simplified payment status confirmation modal
 * Only tracks payment status (Received/Pending) without amount
 */
const PaymentStatusModal = ({ proposal, onClose, onConfirm, isLoading }) => {
  const [paymentStatus, setPaymentStatus] = useState('received');

  const handleConfirm = () => {
    onConfirm({
      status: paymentStatus,
      paidOn: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--success)]/10 text-[var(--success)] flex items-center justify-center">
              <CreditCard size={18} />
            </div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">Update Payment Status</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg)] text-[var(--text-muted)] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Client Info */}
          <div className="bg-[var(--bg)] p-4 rounded-xl border border-[var(--border)]">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">Proposal</p>
            <p className="text-sm font-bold text-[var(--text-primary)]">{proposal.clientId?.name || proposal.leadId?.name}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{proposal.title}</p>
          </div>

          {/* Payment Status Selection */}
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Payment Status</label>
            <div className="space-y-2">
              <label className="flex items-center p-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] cursor-pointer hover:bg-[var(--surface)] transition-colors">
                <input
                  type="radio"
                  name="paymentStatus"
                  value="received"
                  checked={paymentStatus === 'received'}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="mr-3 text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--success)]"></div>
                  <span className="text-sm font-medium text-[var(--text-primary)]">Payment Received</span>
                </div>
              </label>
              
              <label className="flex items-center p-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] cursor-pointer hover:bg-[var(--surface)] transition-colors">
                <input
                  type="radio"
                  name="paymentStatus"
                  value="pending"
                  checked={paymentStatus === 'pending'}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="mr-3 text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--warning)]"></div>
                  <span className="text-sm font-medium text-[var(--text-primary)]">Payment Pending</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-[var(--border)]">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 font-bold"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            isLoading={isLoading}
            className="flex-1 font-bold"
          >
            <CreditCard size={15} /> Confirm
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaymentStatusModal;
