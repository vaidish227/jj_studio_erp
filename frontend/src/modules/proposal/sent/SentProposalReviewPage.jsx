import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, MapPin, FileText, CreditCard, Clock, PlayCircle, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Button, Loader, StatusBadge } from '../../../shared/components';
import { crmService } from '../../../shared/services/crmService';
import { useToast } from '../../../shared/notifications/ToastProvider';

const SentProposalReviewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [proposal, setProposal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { fetchData(); }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await crmService.getProposalById(id);
      setProposal(res.proposal);
    } catch { toast.error('Failed to load proposal'); }
    finally { setIsLoading(false); }
  };

  const handleAction = async (status, extra = {}) => {
    setActionLoading(true);
    try {
      await crmService.updateProposalStatus(id, { status, ...extra });
      toast.success('Status updated!');
      fetchData();
    } catch { toast.error('Action failed'); }
    finally { setActionLoading(false); }
  };

  if (isLoading) return <Loader fullPage label="Loading proposal detail..." />;
  if (!proposal) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <AlertCircle size={40} className="text-[var(--error)] opacity-30" />
      <p className="text-[var(--text-muted)]">Proposal not found.</p>
      <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
    </div>
  );

  const client = proposal.clientId || proposal.leadId || {};
  const esignDone = proposal.esign?.status === 'received';
  const paymentDone = proposal.payments?.status === 'received';
  const isReady = proposal.status === 'project_ready';
  const isStarted = proposal.status === 'project_started';
  const sections = proposal.content?.sections || [];

  const methodLabel = {
    cash: 'Cash', bank_transfer: 'Bank Transfer',
    cheque: 'Cheque', upi: 'UPI', card: 'Card'
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Banner */}
      {(isReady || isStarted) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center text-xl">🚀</div>
            <div>
              <p className="text-base font-bold text-[var(--text-primary)]">
                {isStarted ? 'Project is underway!' : 'Ready to start the project?'}
              </p>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                {isStarted ? 'Project has been officially initiated.' : 'Finalise the sales process and transition to official project management.'}
              </p>
            </div>
          </div>
          {isReady && (
            <Button variant="primary" onClick={() => handleAction('project_started', { remarks: 'Project officially started.' })} isLoading={actionLoading} className="font-bold shrink-0">
              <PlayCircle size={16} /> PROJECT INITIATED →
            </Button>
          )}
          {isStarted && (
            <div className="flex items-center gap-2 text-[var(--success)] font-bold text-sm shrink-0">
              <CheckCircle2 size={18} /> Started
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/proposal/sent')} className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{client.name || 'Client'}</h1>
          <StatusBadge status={proposal.status} />
        </div>
      </div>

      {/* Three-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CLIENT INFORMATION */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5 pb-4 border-b border-[var(--border)]">
            <div className="w-7 h-7 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center"><User size={14} /></div>
            <h2 className="text-xs font-black uppercase tracking-widest text-[var(--primary)]">Client Information</h2>
          </div>
          <div className="space-y-4">
            {[
              { icon: User, label: 'Name', value: client.name },
              { icon: Mail, label: 'Email', value: client.email },
              { icon: Phone, label: 'Phone', value: client.phone },
              { icon: MapPin, label: 'Site Address', value: client.address },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <Icon size={14} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
                  <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">{value || 'N/A'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PROPOSAL SUMMARY */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5 pb-4 border-b border-[var(--border)]">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] flex items-center justify-center"><FileText size={14} /></div>
            <h2 className="text-xs font-black uppercase tracking-widest text-[var(--accent-blue)]">Proposal Summary</h2>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Project Type', value: proposal.leadId?.projectType || 'Interior Design' },
              { label: 'eSign Status', value: esignDone ? 'Completed' : 'Pending', highlight: esignDone },
              { label: 'Signed At', value: proposal.esign?.signed_at ? new Date(proposal.esign.signed_at).toLocaleDateString('en-IN') : 'N/A' },
              { label: 'Proposal Title', value: proposal.title },
            ].map(({ label, value, highlight }) => (
              <div key={label}>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
                <p className={`text-sm font-semibold mt-0.5 ${highlight ? 'text-[var(--success)]' : 'text-[var(--text-primary)]'}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
        {/* Full History */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[var(--warning)]/10 text-[var(--warning)] flex items-center justify-center"><Clock size={14} /></div>
              <h2 className="text-xs font-black uppercase tracking-widest text-[var(--warning)]">Full History</h2>
            </div>
            <span className="text-[10px] font-black text-[var(--success)] uppercase tracking-widest">Live</span>
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {proposal.approvalHistory?.length > 0 ? (
              [...proposal.approvalHistory].reverse().map((log, i) => (
                <div key={i} className="relative pl-5 before:absolute before:left-0 before:top-2 before:bottom-0 before:w-px before:bg-[var(--border)] last:before:hidden">
                  <div className={`absolute left-[-3px] top-1.5 w-1.5 h-1.5 rounded-full ${
                    log.action?.includes('approve') || log.action?.includes('project') ? 'bg-[var(--success)]' :
                    log.action?.includes('reject') ? 'bg-[var(--error)]' : 'bg-[var(--primary)]'
                  }`} />
                  <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">{log.action?.replace(/_/g, ' ')}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    {log.timestamp ? new Date(log.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                  {log.remarks && <p className="text-[10px] text-[var(--text-secondary)] italic mt-1">"{log.remarks}"</p>}
                </div>
              ))
            ) : (
              <p className="text-xs text-[var(--text-muted)] text-center py-8 opacity-40">No history yet.</p>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default SentProposalReviewPage;
