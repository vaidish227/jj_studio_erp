import React, { useState } from 'react';
import Modal from '../../../shared/components/Modal/Modal';
import Button from '../../../shared/components/Button/Button';
import { CheckCircle, XCircle, Send, AlertCircle, User, Calendar, FileText, Info } from 'lucide-react';

const ApprovalFormModal = ({ isOpen, onClose, proposal, action, onSubmit }) => {
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);

  const isApprove = action === 'manager_approved';
  const isReject = action === 'rejected';
  const isSend = action === 'sent';
  const isSign = action === 'signed';

  // Advance Payment State
  const [advance, setAdvance] = useState({
    amount: proposal?.finalAmount ? Math.round(proposal.finalAmount * 0.1) : 0, // 10% default
    paidBy: proposal?.clientId?.name || proposal?.leadId?.name || '',
    method: 'bank_transfer',
    remarks: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isReject && !remarks.trim()) {
      alert("Please provide a reason for rejection.");
      return;
    }

    setLoading(true);
    try {
      const payload = { 
        status: action, 
        remarks 
      };

      if (isSign) {
        payload.advancePayment = {
          ...advance,
          paymentDate: new Date()
        };
      }

      await onSubmit(payload);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getUserName = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    return user?.name || 'Manager';
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isApprove ? 'bg-green-100 text-green-600' : isReject ? 'bg-red-100 text-red-600' : isSign ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
            {isApprove ? <CheckCircle size={20} /> : isReject ? <XCircle size={20} /> : isSign ? <FileText size={20} /> : <Send size={20} />}
          </div>
          <span className="font-black uppercase tracking-tight">
            {isApprove ? 'Approve Proposal' : isReject ? 'Reject Proposal' : isSign ? 'eSign Received & Approve Project' : 'Send to Client'}
          </span>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
            <div className="flex items-center gap-2 mb-1">
              <User size={14} className="text-[var(--text-muted)]" />
              <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Performed By</span>
            </div>
            <p className="text-sm font-bold text-[var(--text-primary)]">{getUserName()}</p>
          </div>
          <div className="p-4 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
            <div className="flex items-center gap-2 mb-1">
              <Calendar size={14} className="text-[var(--text-muted)]" />
              <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Action Date</span>
            </div>
            <p className="text-sm font-bold text-[var(--text-primary)]">{new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Advance Payment Section (Only for Signing/Project Approval) */}
        {isSign && (
          <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 space-y-4">
            <h3 className="text-xs font-black text-amber-800 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
              Advance Payment Details
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-amber-700 uppercase ml-1">Amount (₹)</label>
                <input 
                  type="text"
                  inputMode="numeric"
                  className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl outline-none focus:border-amber-500 font-bold text-sm"
                  placeholder="0.00"
                  value={advance.amount === 0 ? '' : advance.amount}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, '');
                    setAdvance({...advance, amount: val === '' ? 0 : Number(val)});
                  }}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-amber-700 uppercase ml-1">Payment Method</label>
                <select 
                  className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl outline-none focus:border-amber-500 font-bold text-sm"
                  value={advance.method}
                  onChange={(e) => setAdvance({...advance, method: e.target.value})}
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="online">Online / UPI</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-amber-700 uppercase ml-1">Received From (Payer Name)</label>
              <input 
                type="text"
                className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl outline-none focus:border-amber-500 font-bold text-sm"
                value={advance.paidBy}
                onChange={(e) => setAdvance({...advance, paidBy: e.target.value})}
                required
              />
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-black text-[var(--text-muted)] uppercase tracking-wider mb-2 block">
            {isReject ? 'Reason for Rejection (Mandatory)' : 'Remarks / Internal Notes'}
          </label>
          <textarea 
            className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] transition-all font-medium text-sm min-h-[100px]"
            placeholder={isReject ? "Explain why this proposal is being rejected..." : "Add any internal notes..."}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            required={isReject}
          />
        </div>

        {isApprove && (
          <div className="p-4 bg-green-50 border border-green-100 rounded-xl flex items-start gap-3">
            <AlertCircle size={18} className="text-green-600 mt-0.5" />
            <p className="text-xs text-green-700 font-medium leading-relaxed">
              Once approved, this proposal will be ready to be sent to the client. You can dispatch it immediately after this step.
            </p>
          </div>
        )}

        {isSign && (
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
            <Info size={18} className="text-blue-600 mt-0.5" />
            <p className="text-xs text-blue-700 font-medium leading-relaxed">
              Confirming eSign will mark this proposal as <b>Signed</b> and the project as <b>Active</b>. Make sure advance payment details are accurate.
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-[var(--border)]">
          <Button variant="outline" className="flex-1" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button 
            variant={isReject ? 'danger' : isSign ? 'primary' : 'primary'} 
            className={`flex-1 ${isSign ? 'bg-amber-600 hover:bg-amber-700 border-none text-white' : ''}`}
            isLoading={loading}
            type="submit"
          >
            Confirm {isApprove ? 'Approval' : isReject ? 'Rejection' : isSign ? 'eSign & Convert' : 'Send'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ApprovalFormModal;
