import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  FileText, 
  Eye, 
  Send, 
  Calendar,
  CheckCircle,
  Clock,
  ArrowUpDown,
  User,
  Info,
  PenTool
} from 'lucide-react';
import { 
  Card, 
  Button, 
  Input, 
  StatusBadge, 
  SearchInput,
  Select 
} from '../../../shared/components';
import { crmService } from '../../../shared/services/crmService';
import ApprovalFormModal from '../components/ApprovalFormModal';

const SentProposalDashboard = ({ initialEsignFilter = 'all' }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [esignFilter, setEsignFilter] = useState(initialEsignFilter);
  const [sortBy, setSortBy] = useState('sentAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Action Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState(null);
  const [targetProposal, setTargetProposal] = useState(null);

  useEffect(() => {
    fetchSentProposals();
  }, []);

  const fetchSentProposals = async () => {
    try {
      setLoading(true);
      const res = await crmService.getProposals({ 
        status: 'sent,esign_pending,signed,client_approved' 
      });
      setProposals(res?.proposals || []);
    } catch (err) {
      console.error('Failed to fetch sent proposals:', err);
    } finally {
      setLoading(false);
    }
  };

  const openActionModal = (proposal, action) => {
    setTargetProposal(proposal);
    setModalAction(action);
    setModalOpen(true);
  };

  const handleActionSubmit = async (data) => {
    try {
      setLoading(true);
      await crmService.updateProposalStatus(targetProposal._id, data);
      fetchSentProposals();
      setModalOpen(false);
    } catch (err) {
      console.error('Action failed:', err);
      alert('Failed to update status.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProposals = proposals.filter(p => {
    const clientName = (p.clientId?.name || p.leadId?.name || '').toLowerCase();
    const proposalId = p._id.toLowerCase();
    const matchesSearch = clientName.includes(searchTerm.toLowerCase()) || proposalId.includes(searchTerm.toLowerCase());
    const matchesEsign = esignFilter === 'all' || p.esignStatus === esignFilter;
    return matchesSearch && matchesEsign;
  }).sort((a, b) => {
    const valA = a[sortBy];
    const valB = b[sortBy];
    if (sortOrder === 'asc') return valA > valB ? 1 : -1;
    return valA < valB ? 1 : -1;
  });

  const getEsignLabel = (status) => {
    switch(status) {
      case 'completed': return 'Completed';
      case 'pending': return 'Pending';
      default: return 'Pending';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[var(--border)] shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight uppercase mb-1">
            Sent & eSign Track
          </h1>
          <p className="text-[var(--text-muted)] font-medium text-sm">
            Track and manage proposals sent to clients and their eSign status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
            <Send size={14} />
            <span className="text-xs font-black uppercase">{proposals.length} Sent</span>
          </div>
          <div className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg border border-green-100">
            <CheckCircle size={14} />
            <span className="text-xs font-black uppercase">
              {proposals.filter(p => p.esignStatus === 'completed').length} Signed
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 w-full">
            <SearchInput 
              placeholder="Search by client name or proposal ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-[var(--bg)] px-3 py-2 rounded-xl border border-[var(--border)] min-w-[200px]">
              <Filter size={16} className="text-[var(--text-muted)]" />
              <select 
                className="bg-transparent border-none outline-none text-sm font-bold text-[var(--text-primary)] w-full"
                value={esignFilter}
                onChange={(e) => setEsignFilter(e.target.value)}
              >
                <option value="all">All eSign Status</option>
                <option value="pending">eSign Pending</option>
                <option value="completed">eSign Completed</option>
              </select>
            </div>
            <Button variant="outline" onClick={fetchSentProposals} className="h-10">
              <Calendar size={16} />
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Table View */}
      <Card className="overflow-hidden border-[var(--border)] shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg)] border-b border-[var(--border)]">
                <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                  Client & Contact
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                  Proposal Info
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest text-center">
                  Status
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest text-center">
                  eSign Status
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest animate-pulse">Syncing Dashboard...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredProposals.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-40">
                      <FileText size={48} />
                      <p className="text-sm font-bold text-[var(--text-muted)]">No sent proposals found matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProposals.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary)] to-amber-500 flex items-center justify-center text-white font-black shadow-lg">
                          {(p.clientId?.name || p.leadId?.name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-[var(--text-primary)] leading-tight">
                            {p.clientId?.name || p.leadId?.name || 'Unknown Client'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <User size={12} className="text-[var(--text-muted)]" />
                            <span className="text-[10px] text-[var(--text-muted)] font-medium">
                              {p.clientId?.email || p.leadId?.email || 'No Email'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-xs font-black text-[var(--text-primary)] uppercase tracking-tighter">
                        ID: #{p._id.slice(-6)}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[var(--text-muted)]">
                        <Clock size={12} />
                        <span className="text-[10px] font-bold">
                          Sent {new Date(p.sentAt || p.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <StatusBadge value={p.status} />
                    </td>
                    <td className="px-6 py-5 text-center">
                      <StatusBadge value={p.esignStatus || 'pending'} type="status" />
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-9 w-9 p-0 rounded-xl border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all hover:scale-110 shadow-sm"
                          onClick={() => navigate(`/proposal/review/${p._id}`)}
                          title="View Review"
                        >
                          <Eye size={16} />
                        </Button>
                        
                        {(p.status === 'sent' || p.status === 'esign_pending') && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-9 w-9 p-0 rounded-xl border-[var(--border)] hover:border-amber-600 hover:text-amber-600 transition-all hover:scale-110 shadow-sm bg-amber-50/30"
                            onClick={() => openActionModal(p, 'signed')}
                            title="eSign Received & Approve Project"
                          >
                            <PenTool size={16} />
                          </Button>
                        )}

                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-9 w-9 p-0 rounded-xl border-[var(--border)] hover:border-blue-500 hover:text-blue-500 transition-all hover:scale-110 shadow-sm"
                          onClick={() => alert('Resend feature coming soon')}
                          title="Resend Proposal"
                        >
                          <Send size={16} />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-9 w-9 p-0 rounded-xl border-[var(--border)] hover:border-amber-500 hover:text-amber-500 transition-all hover:scale-110 shadow-sm"
                          onClick={() => alert(`Tracking Details: ${p.status}`)}
                          title="Status Details"
                        >
                          <Info size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ApprovalFormModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        proposal={targetProposal}
        action={modalAction}
        onSubmit={handleActionSubmit}
      />
    </div>
  );
};

export default SentProposalDashboard;
