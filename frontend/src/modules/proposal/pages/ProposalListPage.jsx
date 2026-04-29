import React, { useEffect, useState } from 'react';
import { FileText, Loader2, Search, ExternalLink, Mail, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';
import StatusBadge from '../../../shared/components/StatusBadge/StatusBadge';
import { crmService } from '../../../shared/services/crmService';
import { formatDateShort } from '../../../shared/utils/dateUtils';

const ProposalListPage = () => {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchProposals = async () => {
    setIsLoading(true);
    try {
      const response = await crmService.getProposals();
      setProposals(response.proposals || []);
    } catch (err) {
      setError('Failed to fetch proposals');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const filteredProposals = proposals.filter(p => 
    p.leadId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.clientId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p._id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSendEmail = async (id) => {
    try {
      await crmService.sendProposal(id);
      fetchProposals(); // Refresh to show 'sent' status
    } catch (err) {
      alert('Failed to send proposal email');
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

      <div className="relative group">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors"
        />
        <input
          type="text"
          placeholder="Search by client name or proposal ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-11 pr-4 py-3 text-sm rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all duration-200"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-[var(--text-muted)]">
          <Loader2 size={40} className="animate-spin mb-4 opacity-20" />
          <p className="text-sm">Loading proposals...</p>
        </div>
      ) : error ? (
        <div className="text-center py-10 text-[var(--error)] text-sm">{error}</div>
      ) : filteredProposals.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredProposals.map((proposal) => (
            <Card key={proposal._id} className="hover:shadow-md transition-shadow cursor-default">
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
                      <span className="text-xs text-[var(--text-muted)]">#{proposal._id.slice(-6).toUpperCase()}</span>
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">
                      Created on {formatDateShort(proposal.createdAt)}
                    </p>
                    <div className="flex items-center gap-4 text-xs font-medium mt-2">
                      <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                        Items: {proposal.items?.length || 0}
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
                    <ProposalStatusBadge status={proposal.status} />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/crm/leads/${proposal.leadId?._id || proposal.leadId}`)}
                    >
                      <ExternalLink size={14} />
                      View Lead
                    </Button>
                    {proposal.status === 'draft' && (
                      <Button 
                        variant="primary" 
                        size="sm"
                        onClick={() => handleSendEmail(proposal._id)}
                      >
                        <Mail size={14} />
                        Send Email
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-24 bg-[var(--surface)] rounded-2xl border border-dashed border-[var(--border)]">
          <FileText size={48} className="text-[var(--text-muted)] opacity-20 mx-auto mb-4" />
          <p className="text-[var(--text-muted)] text-sm">
            {searchTerm ? `No proposals matching "${searchTerm}"` : 'No proposals found.'}
          </p>
        </div>
      )}
    </div>
  );
};

const ProposalStatusBadge = ({ status }) => {
  const configs = {
    draft: { icon: Clock, color: 'text-[var(--text-muted)]', bg: 'bg-[var(--bg)]', label: 'Draft' },
    sent: { icon: Mail, color: 'text-[var(--primary)]', bg: 'bg-[var(--primary)]/10', label: 'Sent' },
    approved: { icon: CheckCircle2, color: 'text-[var(--success)]', bg: 'bg-[var(--success)]/10', label: 'Approved' },
    rejected: { icon: XCircle, color: 'text-[var(--error)]', bg: 'bg-[var(--error)]/10', label: 'Rejected' },
  };

  const config = configs[status] || configs.draft;
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${config.color} ${config.bg} border border-current/20`}>
      <Icon size={12} />
      {config.label}
    </div>
  );
};

export default ProposalListPage;
