import { useState, useMemo } from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  PenTool,
  CreditCard,
  Search,
  Loader2,
  Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';
import StatusBadge from '../../../shared/components/StatusBadge/StatusBadge';
import { crmService } from '../../../shared/services/crmService';
import { formatDateShort } from '../../../shared/utils/dateUtils';
import { matchesMilestone } from '../utils/milestoneFilter';
import {
  GlobalDateFilter, DashboardRefetchOverlay, useDashboardRange, useDashboardQuery, rangeToParams,
} from '../../../shared/dashboard-filter';
import { PROPOSAL_DASHBOARD_CONFIG } from '../config/proposalDashboardConfig';

// Sub-components
import SummaryCard from './components/SummaryCard';
import QuickActions from './components/QuickActions';

// Cohort fetch — date-bounded by Proposal.createdAt server-side (all_time ⇒ all).
const fetchProposals = (range) =>
  crmService.getProposals(rangeToParams(range)).then((res) => res?.proposals || []);

const ProposalDashboard = () => {
  const navigate = useNavigate();
  const [range, setRange] = useDashboardRange(PROPOSAL_DASHBOARD_CONFIG.storageKey, PROPOSAL_DASHBOARD_CONFIG.defaultRange);
  const { data, isLoading, error, refresh } = useDashboardQuery(fetchProposals, range, {
    pollMs: PROPOSAL_DASHBOARD_CONFIG.pollMs,
    errorMessage: PROPOSAL_DASHBOARD_CONFIG.errorMessage,
  });
  const proposals = useMemo(() => data || [], [data]);
  const isInitialLoading = isLoading && !data;  // first load → table spinner
  const isRefetching = isLoading && !!data;     // range change / poll → overlay
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const stats = useMemo(() => {
    // Count by milestone reached (shared with the list page's ?milestone filter)
    // so the card number always equals what the user sees after clicking through.
    const count = (m) => proposals.filter((p) => matchesMilestone(p, m)).length;
    const total    = proposals.length;
    const pending  = count('pending_approval');
    const rejected = count('rejected');
    const approved = count('approved');
    const sent     = count('sent');
    const esign    = count('esign');
    const advance  = count('advance');

    // Each card routes to the unified proposal list with a `milestone` query
    // param so the list shows only the matching subset.
    return [
      { title: 'Total Proposals', value: total, icon: FileText, color: 'primary', path: '/proposal/list' },
      { title: 'Pending Approval', value: pending, icon: Clock, color: 'warning', path: '/proposal/list?milestone=pending_approval' },
      { title: 'Approved', value: approved, icon: CheckCircle2, color: 'success', path: '/proposal/list?milestone=approved' },
      { title: 'Rejected', value: rejected, icon: XCircle, color: 'error', path: '/proposal/list?milestone=rejected' },
      { title: 'Sent to Client', value: sent, icon: Send, color: 'blue', path: '/proposal/list?milestone=sent' },
      { title: 'eSign Received', value: esign, icon: PenTool, color: 'teal', path: '/proposal/list?milestone=esign' },
      { title: 'Advance Paid', value: advance, icon: CreditCard, color: 'success', path: '/proposal/list?milestone=advance' },
    ];
  }, [proposals]);

  const filteredProposals = proposals
    .filter(p => {
      const matchesSearch =
        p.clientId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.leadId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(p._id || '').toLowerCase().includes(searchTerm.toLowerCase());

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
        <div className="flex items-center gap-3 flex-wrap">
          <GlobalDateFilter value={range} onChange={setRange} defaultRange={PROPOSAL_DASHBOARD_CONFIG.defaultRange} disabled={isRefetching} />
          <Button variant="outline" onClick={refresh}>Refresh</Button>
          <Button variant="primary" onClick={() => navigate('/proposal/create')}>+ New Proposal</Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--error)]/20 bg-[var(--error)]/10 px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      {/* Cohort hint — Proposal KPIs are created-in-window counts, not live snapshots */}
      <p className="text-[11px] text-[var(--text-muted)]">
        Metrics reflect proposals <strong>created within the selected date range</strong> (cohort), bucketed by their current milestone.
      </p>

      <DashboardRefetchOverlay active={isRefetching} className="space-y-8">
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
                  <option value="revision_requested">Revision Requested</option>
                  <option value="manager_approved">Manager Approved</option>
                  <option value="sent">Sent to Client</option>
                  <option value="esign_received">eSign Received</option>
                  <option value="payment_received">Payment Received</option>
                  <option value="project_started">Project Started</option>
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
                  {isInitialLoading ? (
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
                            <span className="text-[10px] text-[var(--text-muted)] mt-0.5 tracking-wider font-medium">#{String(p._id || '').slice(-6).toUpperCase()}</span>
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

        {/* Right Sidebar: Quick Actions only — counts let it show live module activity */}
        <div className="lg:col-span-4">
          <QuickActions
            pendingCount={stats.find((s) => s.title === 'Pending Approval')?.value || 0}
            esignCount={stats.find((s) => s.title === 'eSign Received')?.value || 0}
          />
        </div>
      </div>
      </DashboardRefetchOverlay>
    </div>
  );
};

export default ProposalDashboard;
