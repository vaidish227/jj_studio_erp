import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  RefreshCw,
  Eye,
  Plus,
  Upload,
  AlertCircle,
} from 'lucide-react';
import { crmService } from '../../../shared/services/crmService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';
import { Pagination } from '../../../shared/components';
import useFilters from '../../../shared/filters/useFilters';
import AdvancedFilter from '../../../shared/filters/AdvancedFilter';
import ImportClientsModal from '../components/ImportClientsModal';

const PAGE_SIZE = 25;

const STATUS_CONFIG = {
  new:            { label: 'New',            color: 'bg-blue-100 text-blue-700' },
  contacted:      { label: 'Contacted',      color: 'bg-violet-100 text-violet-700' },
  meeting_done:   { label: 'Meeting Done',   color: 'bg-purple-100 text-purple-700' },
  proposal_sent:  { label: 'Proposal Sent',  color: 'bg-orange-100 text-orange-700' },
  interested:     { label: 'Interested',     color: 'bg-emerald-100 text-emerald-700' },
  converted:      { label: 'Converted',      color: 'bg-green-100 text-green-700' },
  lost:           { label: 'Lost',           color: 'bg-red-100 text-red-700' },
};

const LIFECYCLE_LABELS = {
  enquiry:           'Enquiry',
  new_enquiry:       'New Enquiry',
  kit:               'KIT',
  meeting_scheduled: 'Meeting Scheduled',
  meeting_done:      'Meeting Done',
  followup_due:      'Follow-up Due',
  interested:        'Interested',
  proposal_sent:     'Proposal Sent',
  proposal_approved: 'Proposal Approved',
  negotiation:       'Negotiation',
  converted:         'Converted',
  project_moved:     'Project Moved',
  project_started:   'Project Started',
  lost:              'Lost',
};

const ClientsListPage = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const {
    filters,
    filterConfig,
    updateFilter,
    clearAllFilters,
    hasActiveFilters,
    activeFilterCount,
    process,
  } = useFilters('crm', 'clients');

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await crmService.getLeads({ limit: 500 });
      setClients(res?.leads || res?.clients || []);
    } catch {
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  // Run the AdvancedFilter pipeline: search + status[] + category +
  // lifecycleStage + source + priority + dateRange + sort.
  const filtered = useMemo(() => process(clients), [process, clients]);

  // Reset to page 1 whenever the filter set changes (otherwise the user could
  // be stranded on, say, page 4 of a list that now only has 2 pages of results).
  useEffect(() => { setCurrentPage(1); }, [filters]);

  // Clamp the page if the filtered count shrinks below the current window
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filtered.length);
  const paginated = filtered.slice(pageStart, pageEnd);

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary)] flex items-center justify-center text-black shadow-lg shadow-[var(--primary)]/20">
            <Users size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight uppercase">All Clients</h1>
            <p className="text-[var(--text-muted)] font-medium mt-1">
              Complete client registry across all pipeline stages.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchClients}
            title="Refresh"
            className="p-3 rounded-xl border border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload size={16} className="mr-2" />
            Import
          </Button>
          <Button variant="primary" onClick={() => navigate('/crm/forms/enquiry')}>
            <Plus size={16} className="mr-2" />
            New Enquiry
          </Button>
        </div>
      </div>

      <ImportClientsModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={fetchClients}
      />

      {/* Filters */}
      <AdvancedFilter
        filters={filters}
        filterConfig={filterConfig}
        updateFilter={updateFilter}
        clearAllFilters={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        showSearch={true}
        compact={false}
      />

      {/* Table */}
      <Card className="overflow-hidden border-none shadow-xl shadow-black/5 p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                <th className="px-6 py-5 text-xs font-black text-[var(--text-muted)] uppercase tracking-wider">Client</th>
                <th className="px-6 py-5 text-xs font-black text-[var(--text-muted)] uppercase tracking-wider">Contact</th>
                <th className="px-6 py-5 text-xs font-black text-[var(--text-muted)] uppercase tracking-wider">Location</th>
                <th className="px-6 py-5 text-xs font-black text-[var(--text-muted)] uppercase tracking-wider">Project</th>
                <th className="px-6 py-5 text-xs font-black text-[var(--text-muted)] uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-5 text-xs font-black text-[var(--text-muted)] uppercase tracking-wider">Stage</th>
                <th className="px-6 py-5 text-xs font-black text-[var(--text-muted)] uppercase tracking-wider text-center">Added</th>
                <th className="px-6 py-5 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                      <p className="text-[var(--text-muted)] font-bold animate-pulse">Loading clients...</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-40">
                      <AlertCircle size={48} className="text-[var(--text-muted)]" />
                      <div>
                        <p className="text-xl font-black text-[var(--text-primary)]">No Clients Found</p>
                        <p className="text-[var(--text-muted)] font-medium text-sm">Try adjusting your search or filters.</p>
                      </div>
                      {hasActiveFilters && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearAllFilters}
                        >
                          Clear all filters
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((client) => {
                  const sc = STATUS_CONFIG[client.status] || { label: client.status || 'Unknown', color: 'bg-gray-100 text-gray-600' };
                  const stageLabel = LIFECYCLE_LABELS[client.lifecycleStage] || client.lifecycleStage || '—';
                  return (
                    <tr
                      key={client._id}
                      className="hover:bg-[var(--bg)] transition-colors cursor-pointer group"
                      onClick={() => navigate(`/crm/leads/${client._id}`)}
                    >
                      {/* Name + Tracking ID */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] font-black text-sm shrink-0">
                            {client.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors leading-tight">
                              {client.name}
                            </p>
                            <p className="text-[10px] font-black text-[var(--text-muted)] mt-0.5 tracking-wider">
                              {client.trackingId}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-[var(--text-primary)]">{client.phone || '—'}</p>
                        <p className="text-xs text-[var(--text-muted)] truncate max-w-[160px]">{client.email || '—'}</p>
                      </td>

                      {/* Location */}
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{client.city || '—'}</p>
                      </td>

                      {/* Project Type */}
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{client.projectType || '—'}</p>
                        {client.approxArea ? (
                          <p className="text-xs text-[var(--text-muted)]">{client.approxArea} sqft</p>
                        ) : null}
                      </td>

                      {/* Status Badge */}
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${sc.color}`}>
                          {sc.label}
                        </span>
                      </td>

                      {/* Lifecycle Stage */}
                      <td className="px-6 py-4">
                        <p className="text-xs font-semibold text-[var(--text-muted)]">{stageLabel}</p>
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4 text-center">
                        <p className="text-xs font-bold text-[var(--text-muted)]">
                          {client.createdAt
                            ? new Date(client.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                        </p>
                      </td>

                      {/* View Button */}
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/crm/leads/${client._id}`); }}
                          className="w-8 h-8 rounded-xl border border-[var(--border)] flex items-center justify-center opacity-0 group-hover:opacity-100 hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: count + pagination */}
        {!loading && filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-[var(--border)] bg-[var(--bg)] flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs font-bold text-[var(--text-muted)]">
              Showing{' '}
              <span className="text-[var(--text-primary)]">{pageStart + 1}</span>
              {'–'}
              <span className="text-[var(--text-primary)]">{pageEnd}</span>{' '}
              of <span className="text-[var(--text-primary)]">{filtered.length}</span>
              {filtered.length !== clients.length && (
                <span className="text-[var(--text-muted)]"> (filtered from {clients.length})</span>
              )}
            </p>

            {totalPages > 1 && (
              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                onChange={setCurrentPage}
              />
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ClientsListPage;
