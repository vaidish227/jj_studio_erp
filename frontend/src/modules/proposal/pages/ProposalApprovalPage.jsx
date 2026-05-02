import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Search,
  Filter,
  FileText,
  Edit3,
  ThumbsUp,
  ThumbsDown,
  ArrowUpDown,
  CheckSquare,
  Square,
  MoreVertical,
  Send,
  RotateCcw
} from 'lucide-react';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';
import { crmService } from '../../../shared/services/crmService';
import ApprovalFormModal from '../components/ApprovalFormModal';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { Loader } from '../../../shared/components';

const ProposalApprovalPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedIds, setSelectedIds] = useState([]);

  // Action Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState(null);
  const [targetProposal, setTargetProposal] = useState(null);

  const openActionModal = (proposal, action) => {
    setTargetProposal(proposal);
    setModalAction(action);
    setModalOpen(true);
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const res = await crmService.getProposals();
      setProposals(res?.proposals || []);
    } catch (err) {
      console.error('Failed to fetch proposals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleActionSubmit = async ({ status, remarks }) => {
    try {
      setLoading(true);
      await crmService.updateProposalStatus(targetProposal._id, { status, remarks });
      toast.success('Proposal updated successfully');
      fetchProposals();
    } catch (err) {
      toast.error('Failed to update proposal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProposals = proposals
    .filter(p => {
      const matchesSearch =
        p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.clientId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.leadId?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

      const projectType = p.leadId?.projectType || p.clientId?.projectType || 'Residential';
      const matchesCategory = categoryFilter === 'all' || projectType.toLowerCase() === categoryFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesCategory;
    })
    .sort((a, b) => {
      let valA, valB;

      if (sortBy === 'name') {
        valA = (a.clientId?.name || a.leadId?.name || '').toLowerCase();
        valB = (b.clientId?.name || b.leadId?.name || '').toLowerCase();
      } else {
        valA = new Date(a[sortBy]).getTime();
        valB = new Date(b[sortBy]).getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const handleBulkAction = async (action) => {
    if (!window.confirm(`Are you sure you want to ${action} ${selectedIds.length} proposals?`)) return;

    let status = action;
    if (action === 'approve') status = 'manager_approved';
    if (action === 'reject') status = 'rejected';
    if (action === 'send') status = 'sent';

    try {
      setLoading(true);
      await Promise.all(selectedIds.map(id => crmService.updateProposalStatus(id, status)));
      setSelectedIds([]);
      fetchProposals();
    } catch (err) {
      console.error('Bulk action failed:', err);
      alert('Some actions failed. Please check the list.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProposals.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProposals.map(p => p._id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setBy('createdAt');
    setSortOrder('desc');
  };

  const isFiltered = searchTerm !== '' || statusFilter !== 'all' || categoryFilter !== 'all' || sortBy !== 'createdAt' || sortOrder !== 'desc';

  const getStatusBadge = (status) => {
    const configs = {
      draft: { color: 'bg-gray-100 text-gray-700', label: 'Draft' },
      pending_approval: { color: 'bg-yellow-100 text-yellow-700', label: 'Pending Approval' },
      manager_approved: { color: 'bg-green-100 text-green-700', label: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-700', label: 'Rejected' },
      sent: { color: 'bg-blue-100 text-blue-700', label: 'Sent to Client' },
    };
    const config = configs[status] || configs.draft;
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${config.color}`}>{config.label}</span>;
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary)] flex items-center justify-center text-black shadow-lg shadow-[var(--primary)]/20">
            <CheckCircle size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight uppercase">Manager Approval</h1>
            <p className="text-[var(--text-muted)] font-medium mt-1">Review and authorize proposals before they reach clients.</p>
          </div>
        </div>
      </div>

      {/* Stats / Quick Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-gradient-to-br from-yellow-500/10 to-transparent border-yellow-500/20 shadow-none">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-yellow-600 uppercase tracking-widest mb-1">Awaiting Review</p>
              <h3 className="text-3xl font-black text-[var(--text-primary)]">
                {proposals.filter(p => p.status === 'pending_approval').length}
              </h3>
            </div>
            <div className="p-3 bg-yellow-500/20 rounded-xl text-yellow-600">
              <Clock size={24} />
            </div>
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20 shadow-none">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-green-600 uppercase tracking-widest mb-1">Approved</p>
              <h3 className="text-3xl font-black text-[var(--text-primary)]">
                {proposals.filter(p => p.status === 'manager_approved').length}
              </h3>
            </div>
            <div className="p-3 bg-green-500/20 rounded-xl text-green-600">
              <CheckCircle size={24} />
            </div>
          </div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-red-500/10 to-transparent border-red-500/20 shadow-none">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-1">Rejected</p>
              <h3 className="text-3xl font-black text-[var(--text-primary)]">
                {proposals.filter(p => p.status === 'rejected').length}
              </h3>
            </div>
            <div className="p-3 bg-red-500/20 rounded-xl text-red-600">
              <XCircle size={24} />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters & Search */}
      <Card className="p-4 flex flex-col md:flex-row items-center gap-4 border-none shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
          <input
            type="text"
            placeholder="Search by client or proposal title..."
            className="w-full pl-12 pr-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Category Filter */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
            <span className="text-[10px] font-black text-[var(--text-muted)] uppercase">Type:</span>
            <select
              className="bg-transparent text-sm font-bold outline-none"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
            <Filter size={16} className="text-[var(--text-muted)]" />
            <select
              className="bg-transparent text-sm font-bold outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="manager_approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="sent">Sent to Client</option>
            </select>
          </div>

          {/* Sorting */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
            <ArrowUpDown size={16} className="text-[var(--text-muted)]" />
            <select
              className="bg-transparent text-sm font-bold outline-none"
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setBy(field);
                setSortOrder(order);
              }}
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
            </select>
          </div>

          {isFiltered && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-2 px-4 py-2 text-xs font-black text-red-500 hover:bg-red-50 rounded-xl transition-colors uppercase tracking-widest"
            >
              <RotateCcw size={14} />
              Clear Filters
            </button>
          )}
        </div>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-[var(--primary)] text-black p-4 rounded-2xl flex items-center justify-between shadow-lg animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-black/10 flex items-center justify-center font-black">
              {selectedIds.length}
            </div>
            <p className="font-bold uppercase tracking-wider text-sm">Proposals Selected</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="bg-white/20 border-black/10 hover:bg-white/30 text-black font-bold" onClick={() => handleBulkAction('approve')}>
              <ThumbsUp size={16} className="mr-2" /> Approve All
            </Button>
            <Button variant="outline" size="sm" className="bg-white/20 border-black/10 hover:bg-white/30 text-black font-bold" onClick={() => handleBulkAction('reject')}>
              <ThumbsDown size={16} className="mr-2" /> Reject All
            </Button>
            <Button variant="outline" size="sm" className="bg-white/20 border-black/10 hover:bg-white/30 text-black font-bold" onClick={() => handleBulkAction('send')}>
              <Send size={16} className="mr-2" /> Send to Clients
            </Button>
            <div className="w-px h-6 bg-black/10 mx-2" />
            <button onClick={() => setSelectedIds([])} className="p-2 hover:bg-black/10 rounded-lg transition-colors">
              <XCircle size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Proposal Table */}
      <Card className="overflow-hidden border-none shadow-xl shadow-black/5 p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                <th className="px-6 py-5 w-10">
                  <button onClick={toggleSelectAll} className="text-[var(--primary)]">
                    {selectedIds.length === filteredProposals.length && filteredProposals.length > 0 ? (
                      <CheckSquare size={20} />
                    ) : (
                      <Square size={20} />
                    )}
                  </button>
                </th>
                <th className="px-6 py-5 text-xs font-black text-[var(--text-muted)] uppercase tracking-wider">Client & Proposal</th>
                <th className="px-6 py-5 text-xs font-black text-[var(--text-muted)] uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-5 text-xs font-black text-[var(--text-muted)] uppercase tracking-wider text-right">Amount</th>
                <th className="px-6 py-5 text-xs font-black text-[var(--text-muted)] uppercase tracking-wider text-center">Submitted Date</th>
                <th className="px-6 py-5 text-xs font-black text-[var(--text-muted)] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-[var(--text-muted)] font-bold animate-pulse">Loading proposals...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredProposals.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-40">
                      <FileText size={64} className="text-[var(--text-muted)]" />
                      <div>
                        <p className="text-xl font-black text-[var(--text-primary)]">No Proposals Found</p>
                        <p className="text-[var(--text-muted)] font-medium">There are no proposals matching your criteria.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProposals.map((p) => (
                  <tr key={p._id} className={`hover:bg-[var(--bg)] transition-colors group ${selectedIds.includes(p._id) ? 'bg-[var(--primary)]/5' : ''}`}>
                    <td className="px-6 py-5">
                      <button onClick={() => toggleSelect(p._id)} className={selectedIds.includes(p._id) ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}>
                        {selectedIds.includes(p._id) ? <CheckSquare size={20} /> : <Square size={20} />}
                      </button>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)] font-black text-xs">
                          {p.title?.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-[var(--text-primary)] leading-tight group-hover:text-[var(--primary)] transition-colors">
                            {p.clientId?.name || p.leadId?.name || 'Unknown Client'}
                          </p>
                          <p className="text-xs text-[var(--text-muted)] font-bold mt-0.5">{p.title || 'Estimate'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      {getStatusBadge(p.status)}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <p className="font-black text-[var(--text-primary)]">₹{p.finalAmount?.toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-tighter">Incl. GST</p>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                          {new Date(p.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] font-bold">
                          {new Date(p.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 transition-all duration-300">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 w-9 p-0 rounded-xl border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)] shadow-sm bg-white transition-all hover:scale-110 active:scale-95"
                          onClick={() => navigate(`/proposal/review/${p._id}`)}
                          title="Quick View"
                        >
                          <Eye size={16} />
                        </Button>

                        {p.status === 'pending_approval' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 w-9 p-0 rounded-xl border-[var(--border)] hover:border-blue-500 hover:text-blue-500 shadow-sm bg-white transition-all hover:scale-110 active:scale-95"
                              onClick={() => navigate(`/proposal/create?id=${p._id}`)}
                              title="Edit Proposal"
                            >
                              <Edit3 size={16} />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 w-9 p-0 rounded-xl border-[var(--border)] hover:border-red-500 hover:text-red-500 shadow-sm bg-white text-red-400 transition-all hover:scale-110 active:scale-95"
                              onClick={() => openActionModal(p, 'rejected')}
                              title="Reject with Reason"
                            >
                              <ThumbsDown size={16} />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 w-9 p-0 rounded-xl border-[var(--border)] hover:border-green-500 hover:text-green-500 shadow-sm bg-white text-green-500 transition-all hover:scale-110 active:scale-95"
                              onClick={() => openActionModal(p, 'manager_approved')}
                              title="Approve Proposal"
                            >
                              <ThumbsUp size={16} />
                            </Button>
                          </>
                        )}

                        {p.status === 'manager_approved' && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="h-9 px-4 rounded-xl shadow-lg shadow-[var(--primary)]/20 text-xs font-black uppercase tracking-wider"
                            onClick={() => openActionModal(p, 'sent')}
                            title="Send to Client"
                          >
                            <Send size={14} className="mr-2" />
                            Send
                          </Button>
                        )}
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

export default ProposalApprovalPage;
