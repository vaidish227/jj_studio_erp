import React, { useEffect, useState, useMemo } from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  PenTool,
  CreditCard,
  Search,
  Filter,
  Loader2,
  ChevronRight,
  Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';
import StatusBadge from '../../../shared/components/StatusBadge/StatusBadge';
import { crmService } from '../../../shared/services/crmService';
import { formatDateShort } from '../../../shared/utils/dateUtils';

// Sub-components
import SummaryCard from './components/SummaryCard';
import ActivityList from './components/ActivityList';
import StatusTracker from './components/StatusTracker';
import QuickActions from './components/QuickActions';

const ProposalDashboard = () => {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const response = await crmService.getProposals();
      setProposals(response.proposals || []);
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const stats = useMemo(() => {
    const total = proposals.length;
    const pending = proposals.filter(p => p.status === 'pending_approval').length;
    const approved = proposals.filter(p => p.status === 'manager_approved').length;
    const rejected = proposals.filter(p => p.status === 'rejected').length;
    const sent = proposals.filter(p => p.status === 'sent').length;
    const esign = proposals.filter(p => p.status === 'esign_received').length;
    const advance = proposals.filter(p => p.status === 'payment_received').length;

    return [
      { title: 'Total Proposals', value: total, icon: FileText, color: 'primary', path: '/proposal/list' },
      { title: 'Pending Approval', value: pending, icon: Clock, color: 'warning', path: '/proposal/approval' },
      { title: 'Approved', value: approved, icon: CheckCircle2, color: 'success', path: '/proposal/approved' },
      { title: 'Rejected', value: rejected, icon: XCircle, color: 'error', path: '/proposal/list' },
      { title: 'Sent to Client', value: sent, icon: Send, color: 'blue', path: '/proposal/sent' },
      { title: 'eSign Received', value: esign, icon: PenTool, color: 'teal', path: '/proposal/sent' },
      { title: 'Advance Paid', value: advance, icon: CreditCard, color: 'success', path: '/proposal/approved' },
    ];
  }, [proposals]);

  const activities = [
    { type: 'created', message: 'New Proposal created for Modern Apartment', client: 'John Doe', time: '2 hours ago' },
    { type: 'approved', message: 'Proposal #PR-4521 Approved by Manager', client: 'Alice Smith', time: '5 hours ago' },
    { type: 'sent', message: 'Proposal sent to client via Email', client: 'Michael Chen', time: '1 day ago' },
    { type: 'signed', message: 'eSignature received for Villa Project', client: 'Sarah Johnson', time: '2 days ago' },
  ];

  const filteredProposals = proposals
    .filter(p => {
      const matchesSearch =
        p.clientId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.leadId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p._id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .slice(0, 5); // Only show top 5 for preview

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="border-l-4 border-[var(--primary)] pl-4">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Proposal Dashboard</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Centralized tracking for all quotations and agreements.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchDashboardData}>Refresh</Button>
          <Button variant="primary" onClick={() => navigate('/proposal/create')}>+ New Proposal</Button>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {stats.map((stat, idx) => (
          <SummaryCard key={idx} {...stat} />
        ))}
      </div>

      {/* Middle Section: Status Tracker + Activities + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-8">
          {/* Visual Status Flow */}
          {/* <div className="space-y-4">
            <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              Pipeline Health
              <span className="px-2 py-0.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)] text-[10px] font-black uppercase tracking-widest">Live</span>
            </h3>
            <StatusTracker currentStatus="sent" />
          </div> */}

          {/* Proposal List Preview */}
          <Card padding="p-0" className="overflow-hidden border-none shadow-xl shadow-black/5 bg-[var(--surface)]">
            <div className="p-6 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[var(--surface)] to-[var(--bg)]/30">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Recent Proposals</h3>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 text-xs rounded-lg bg-[var(--bg)] border border-[var(--border)] focus:outline-none focus:border-[var(--primary)] w-40 sm:w-64 transition-all"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-lg bg-[var(--bg)] border border-[var(--border)] focus:outline-none focus:border-[var(--primary)]"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="manager_approved">Manager Approved</option>
                  <option value="sent">Sent to Client</option>
                  <option value="client_approved">Client Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] bg-[var(--bg)]/50 font-bold">
                  <tr>
                    <th className="px-6 py-4">Client / Project</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4 text-right">Date</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {isLoading ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center">
                        <Loader2 size={24} className="animate-spin mx-auto text-[var(--primary)] opacity-50" />
                      </td>
                    </tr>
                  ) : filteredProposals.length > 0 ? (
                    filteredProposals.map((p) => (
                      <tr 
                        key={p._id} 
                        className="hover:bg-[var(--bg)]/30 transition-colors cursor-pointer group"
                        onClick={() => navigate(`/proposal/review/${p._id}`)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                              {p.clientId?.name || p.leadId?.name || 'Untitled Project'}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)] mt-0.5 tracking-wider font-medium">#{p._id.slice(-6).toUpperCase()}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <StatusBadge status={p.status} />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-[var(--text-primary)]">
                          ₹{Number(p.finalAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4 text-right text-[var(--text-muted)] font-medium">
                          {formatDateShort(p.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/proposal/review/${p._id}`);
                            }}
                            className="p-2 rounded-lg hover:bg-[var(--primary)]/10 text-[var(--text-muted)] hover:text-[var(--primary)] transition-all"
                            title="Review Proposal"
                          >
                            <Eye size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-[var(--text-muted)] text-sm italic">
                        No proposals found matching criteria
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-[var(--border)] bg-[var(--bg)]/20 text-center">
              <button
                onClick={() => navigate('/proposal/list')}
                className="text-xs font-black text-[var(--primary)] uppercase tracking-[0.2em] hover:opacity-70 transition-opacity"
              >
                View Full Proposal List
              </button>
            </div>
          </Card>
        </div>

        {/* Right Sidebar: Quick Actions + Recent Activity */}
        <div className="lg:col-span-4 space-y-8">
          {/* Integration Section: Leads needing Proposals */}
          <ReadyForProposalLeads />
          <QuickActions />
          {/* <ActivityList activities={activities} /> */}
        </div>
      </div>
    </div>
  );
};

const ReadyForProposalLeads = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInterestedLeads = async () => {
      try {
        // Fetch leads at stages where proposals are typically created
        const [showProjectRes, interestedRes] = await Promise.all([
          crmService.getLeads({ lifecycleStage: 'show_project', limit: 2 }),
          crmService.getLeads({ lifecycleStage: 'interested', limit: 2 })
        ]);

        const combined = [
          ...(showProjectRes.leads || []),
          ...(interestedRes.leads || [])
        ].slice(0, 3); // Keep top 3

        setLeads(combined);
      } catch (err) {
        console.error('Failed to fetch interested leads', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInterestedLeads();
  }, []);

  if (loading) return null;
  if (leads.length === 0) return null;

  return (
    <Card className="border-none shadow-xl shadow-black/5 bg-[var(--surface)] overflow-hidden">
      <div className="p-4 bg-gradient-to-br from-[var(--primary)]/10 to-transparent border-b border-[var(--border)]">
        <h3 className="text-sm font-black text-[var(--text-primary)] flex items-center gap-2 uppercase tracking-wider">
          <Clock size={16} className="text-[var(--primary)]" />
          Ready for Proposal
        </h3>
        <p className="text-[10px] text-[var(--text-muted)] font-bold mt-1">Leads from CRM in Project Showcase stage</p>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {leads.map(lead => (
          <div key={lead._id} className="p-4 hover:bg-[var(--bg)]/30 transition-colors group">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-bold text-[var(--text-primary)]">{lead.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-[var(--text-muted)]">{lead.projectType || 'Project'}</span>
                  <span className="w-1 h-1 rounded-full bg-[var(--border)]" />
                  <span className="text-[10px] font-black text-[var(--primary)] uppercase">Show Project Done</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-[10px] font-black uppercase border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-black transition-all"
                onClick={() => navigate(`/crm/leads/${lead._id}`)}
              >
                Draft Proposal
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 bg-[var(--bg)]/20 text-center">
        <button
          onClick={() => navigate('/crm/new-leads')}
          className="text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors uppercase tracking-widest"
        >
          View Pipeline in CRM
        </button>
      </div>
    </Card>
  );
};

export default ProposalDashboard;
