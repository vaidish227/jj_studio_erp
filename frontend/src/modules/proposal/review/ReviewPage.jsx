import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Printer,
  History,
  FileText,
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  Edit,
  Save,
  Send,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
  Layout
} from 'lucide-react';
import {
  Card,
  Button,
  Loader,
  ProposalViewer,
  SectionCard,
  StatusBadge,
  ActionBar,
  ConfirmationModal
} from '../../../shared/components';
import { crmService } from '../../../shared/services/crmService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { formatDateTime } from '../../../shared/utils/dateUtils';

const ReviewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [proposal, setProposal] = useState(null);
  const [client, setClient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState(null);

  // Editable fields
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedData, setEditedData] = useState({ title: '', notes: '' });

  // Modal
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: '', message: '', action: null, status: ''
  });

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch (e) { console.error('Failed to parse user'); }
    }
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await crmService.getProposalById(id);
      const p = response.proposal;
      setProposal(p);
      setClient(p?.clientId || p?.leadId);
      setEditedData({ title: p.title || '', notes: p.notes || '' });
    } catch (err) {
      toast.error('Failed to load proposal');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus, remarks = '') => {
    setIsSubmitting(true);
    try {
      await crmService.updateProposalStatus(id, { status: newStatus, remarks });
      toast.success(`Proposal ${newStatus.replace(/_/g, ' ')} successfully!`);
      const response = await crmService.getProposalById(id);
      setProposal(response.proposal);
      setConfirmModal({ ...confirmModal, isOpen: false });
    } catch (err) {
      toast.error('Failed to update proposal status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveUpdate = async () => {
    setIsSubmitting(true);
    try {
      await crmService.updateProposal(id, editedData);
      setProposal({ ...proposal, ...editedData });
      setIsEditMode(false);
      toast.success('Proposal updated successfully!');
    } catch (err) {
      toast.error('Failed to save updates');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openConfirmModal = (action, status, title, message) => {
    setConfirmModal({ isOpen: true, title, message, action, status });
  };

  if (isLoading) return <Loader fullPage label="Preparing proposal review..." />;
  if (!proposal) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-16 h-16 rounded-full bg-[var(--error)]/10 flex items-center justify-center">
        <AlertCircle size={32} className="text-[var(--error)]" />
      </div>
      <p className="text-lg font-bold text-[var(--text-primary)]">Proposal not found</p>
      <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
    </div>
  );

  const role = user?.role?.toLowerCase() || '';
  const isManager = role === 'manager' || role === 'admin';
  const isPending = proposal.status === 'pending_approval';
  const isApproved = proposal.status === 'manager_approved';
  const isDraft = proposal.status === 'draft';
  const isRejected = proposal.status === 'rejected';
  const canEditFields = isEditMode && (isDraft || isRejected || isManager);

  return (
    <div className="space-y-6 pb-20">
      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors shrink-0 mt-1"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Proposal Review</h1>
              <StatusBadge status={proposal.status} />
            </div>
            <p className="text-xs text-[var(--text-muted)] font-medium mt-1">
              REF: #{proposal._id.slice(-8).toUpperCase()} • Created {new Date(proposal.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer size={16} /> Print / PDF
          </Button>

          {/* User Actions */}
          {!isManager && (
            <>
              {isEditMode ? (
                <Button variant="primary" size="sm" onClick={handleSaveUpdate} isLoading={isSubmitting}>
                  <Save size={16} /> Save Changes
                </Button>
              ) : (
                (isDraft || isRejected) && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>
                    <Edit size={16} /> Edit
                  </Button>
                )
              )}
              {isDraft && !isEditMode && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => openConfirmModal('submit', 'pending_approval', 'Send for Approval', 'Send this proposal to the manager for approval?')}
                >
                  <Send size={16} /> Send for Approval
                </Button>
              )}
            </>
          )}

          {/* Manager Actions */}
          {isManager && (
            <>
              {isEditMode ? (
                <Button variant="primary" size="sm" onClick={handleSaveUpdate} isLoading={isSubmitting}>
                  <Save size={16} /> Save Changes
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>
                  <Edit size={16} /> Edit
                </Button>
              )}

              {(isPending || isDraft) && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[var(--error)]/30 text-[var(--error)] hover:bg-[var(--error)]/5"
                    onClick={() => openConfirmModal('reject', 'rejected', 'Reject Proposal', 'Reject this proposal? The user will be notified.')}
                  >
                    <XCircle size={16} /> Reject
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => openConfirmModal('approve', 'manager_approved', 'Approve Proposal', 'Approve and auto-send this proposal to the client?')}
                  >
                    <CheckCircle size={16} /> Approve
                  </Button>
                </>
              )}

              {isApproved && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => openConfirmModal('send', 'sent', 'Send to Client', 'Send this approved proposal to the client via email?')}
                >
                  <Send size={16} /> Send to Client
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Info Panel */}
        <div className="lg:col-span-4 space-y-4 print:hidden">

          {/* Client Details */}
          <Card>
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-[var(--border)]">
              <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                <User size={16} />
              </div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Client Details</h2>
            </div>
            <div className="space-y-4">
              {[
                { icon: User, label: 'Full Name', value: client?.name },
                { icon: Phone, label: 'Phone', value: client?.phone },
                { icon: Mail, label: 'Email', value: client?.email },
                { icon: MapPin, label: 'Site Address', value: client?.address },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[var(--bg)] text-[var(--text-muted)] shrink-0">
                    <Icon size={14} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
                    <p className="text-sm font-medium text-[var(--text-primary)] mt-0.5">{value || 'N/A'}</p>
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-[var(--border)] flex justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Lead Status</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)] text-[10px] font-black uppercase tracking-wider">
                    {client?.status?.replace('_', ' ') || 'Active'}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Project Type</p>
                  <p className="text-xs font-semibold text-[var(--text-primary)] mt-1">{proposal.leadId?.projectType || 'Interior Design'}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Proposal Details */}
          <Card>
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-[var(--border)]">
              <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                <Layout size={16} />
              </div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Proposal Details</h2>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1.5">Proposal Title</p>
                {canEditFields ? (
                  <input
                    type="text"
                    value={editedData.title}
                    onChange={(e) => setEditedData({ ...editedData, title: e.target.value })}
                    className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all"
                  />
                ) : (
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{proposal.title}</p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1.5">Template Used</p>
                <p className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
                  <FileText size={14} className="text-[var(--text-muted)]" />
                  {proposal.templateId?.name || 'Custom / Multiple Templates'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1.5">Notes</p>
                {canEditFields ? (
                  <textarea
                    value={editedData.notes}
                    onChange={(e) => setEditedData({ ...editedData, notes: e.target.value })}
                    className="w-full h-20 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all resize-none"
                    placeholder="Add notes..."
                  />
                ) : (
                  <p className="text-sm text-[var(--text-secondary)] italic">
                    {proposal.notes || 'No additional notes.'}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Financial Summary */}
          <Card>
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--border)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Financial Summary</h2>
              <span className="text-xs font-bold text-[var(--primary)]">₹ INR</span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--text-muted)] font-medium">Subtotal</span>
                <span className="font-semibold text-[var(--text-primary)]">₹{Number(proposal.subtotal || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--text-muted)] font-medium">GST (18%)</span>
                <span className="font-semibold text-[var(--text-primary)]">₹{Number(proposal.gst || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="pt-3 border-t border-[var(--border)] flex justify-between items-center">
                <span className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Total</span>
                <span className="text-xl font-bold text-[var(--primary)]">₹{Number(proposal.finalAmount || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </Card>

          {/* Timeline */}
          <Card>
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-[var(--border)]">
              <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                <Clock size={16} />
              </div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Timeline & History</h2>
            </div>
            <div className="space-y-4">
              {proposal.approvalHistory?.length > 0 ? (
                proposal.approvalHistory
                  .slice()
                  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                  .map((log, idx) => (
                    <div key={idx} className="relative pl-5 before:absolute before:left-0 before:top-2 before:bottom-0 before:w-px before:bg-[var(--border)] last:before:hidden">
                      <div className={`absolute left-[-3px] top-1.5 w-1.5 h-1.5 rounded-full ${
                        log.action?.includes('approve') ? 'bg-[var(--success)]' :
                        log.action?.includes('reject') ? 'bg-[var(--error)]' : 'bg-[var(--primary)]'
                      }`} />
                      <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">{log.action?.replace(/_/g, ' ')}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{formatDateTime(log.timestamp)}</p>
                      {log.remarks && (
                        <div className="mt-1.5 bg-[var(--bg)] p-2.5 rounded-lg border border-[var(--border)]">
                          <p className="text-xs text-[var(--text-secondary)] italic">"{log.remarks}"</p>
                        </div>
                      )}
                    </div>
                  ))
              ) : (
                <div className="text-center py-6">
                  <History size={28} className="mx-auto mb-2 text-[var(--text-muted)] opacity-30" />
                  <p className="text-xs text-[var(--text-muted)]">No activity recorded yet.</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right: Proposal Viewer */}
        <div className="lg:col-span-8">
          <div className="bg-[var(--bg)] rounded-2xl border border-[var(--border)] p-4 sm:p-8 min-h-[600px] flex justify-center">
            <ProposalViewer proposal={proposal} client={client} />
          </div>
          <p className="text-center text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-widest mt-4 flex items-center justify-center gap-2 print:hidden">
            <AlertCircle size={12} /> Live Preview · Proposal Quotation Table
          </p>
        </div>
      </div>

      {/* ── Confirmation Modal ── */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={(remarks) => handleStatusUpdate(confirmModal.status, remarks)}
        title={confirmModal.title}
        message={confirmModal.message}
        isLoading={isSubmitting}
        showRemarks={['reject', 'modify'].includes(confirmModal.action)}
        isRemarksMandatory={confirmModal.action === 'reject'}
        remarksPlaceholder={confirmModal.action === 'reject' ? 'Reason for rejection (mandatory)...' : 'Add optional remarks...'}
        confirmLabel={confirmModal.title}
        variant={confirmModal.action === 'reject' ? 'danger' : 'primary'}
      />
    </div>
  );
};

export default ReviewPage;
