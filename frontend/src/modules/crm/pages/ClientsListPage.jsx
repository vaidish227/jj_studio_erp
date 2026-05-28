import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, RefreshCw, Eye, Plus, Upload } from 'lucide-react';
import { crmService } from '../../../shared/services/crmService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';
import ImportClientsModal from '../components/ImportClientsModal';

const STATUS_CONFIG = {
  new:        { label: 'New',        color: 'bg-blue-100 text-blue-700' },
  contacted:  { label: 'Contacted',  color: 'bg-violet-100 text-violet-700' },
  interested: { label: 'Interested', color: 'bg-emerald-100 text-emerald-700' },
  converted:  { label: 'Converted',  color: 'bg-green-100 text-green-700' },
  lost:       { label: 'Lost',       color: 'bg-red-100 text-red-700' },
};

const LIFECYCLE_LABELS = {
  new_enquiry:       'New Enquiry',
  meeting_scheduled: 'Meeting Scheduled',
  meeting_done:      'Meeting Done',
  followup_due:      'Follow-up Due',
  interested:        'Interested',
  proposal_sent:     'Proposal Sent',
  proposal_approved: 'Proposal Approved',
  negotiation:       'Negotiation',
  converted:         'Converted',
  project_started:   'Project Started',
  lost:              'Lost',
};

const ClientsListPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [importOpen, setImportOpen] = useState(false);

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

  const filtered = clients.filter(c => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(searchTerm) ||
      c.city?.toLowerCase().includes(q) ||
      c.trackingId?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesType = typeFilter === 'all' || c.projectType?.toLowerCase() === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const stats = {
    total:     clients.length,
    new:       clients.filter(c => c.status === 'new').length,
    active:    clients.filter(c => !['new', 'converted', 'lost'].includes(c.status)).length,
    converted: clients.filter(c => c.status === 'converted').length,
    lost:      clients.filter(c => c.status === 'lost').length,
  };

  const STATS = [
    { label: 'Total',     value: stats.total,     textColor: 'text-[var(--primary)]' },
    { label: 'New',       value: stats.new,        textColor: 'text-blue-600' },
    { label: 'Active',    value: stats.active,     textColor: 'text-violet-600' },
    { label: 'Converted', value: stats.converted,  textColor: 'text-green-600' },
    { label: 'Lost',      value: stats.lost,       textColor: 'text-red-500' },
  ];

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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {STATS.map(s => (
          <Card key={s.label} className="p-5 border-none shadow-sm">
            <p className={`text-xs font-black uppercase tracking-widest ${s.textColor}`}>{s.label}</p>
            <p className="text-3xl font-black text-[var(--text-primary)] mt-1">
              {loading ? <span className="animate-pulse">—</span> : s.value}
            </p>
          </Card>
        ))}
      </div>

      {/* Search & Filters */}
      <Card className="p-4 flex flex-col md:flex-row items-center gap-4 border-none shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
          <input
            type="text"
            placeholder="Search by name, phone, email, city or tracking ID..."
            className="w-full pl-11 pr-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] transition-all text-sm font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            className="flex-1 md:flex-none px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-bold outline-none focus:border-[var(--primary)] cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="interested">Interested</option>
            <option value="converted">Converted</option>
            <option value="lost">Lost</option>
          </select>
          <select
            className="flex-1 md:flex-none px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-bold outline-none focus:border-[var(--primary)] cursor-pointer"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
          </select>
          <button
            onClick={fetchClients}
            className="p-3 rounded-xl border border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </Card>

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
                      <Users size={56} className="text-[var(--text-muted)]" />
                      <div>
                        <p className="text-xl font-black text-[var(--text-primary)]">No Clients Found</p>
                        <p className="text-[var(--text-muted)] font-medium text-sm">Try adjusting your search or filters.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(client => {
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
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${sc.color}`}>
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

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg)]">
            <p className="text-xs font-bold text-[var(--text-muted)]">
              Showing <span className="text-[var(--text-primary)]">{filtered.length}</span> of{' '}
              <span className="text-[var(--text-primary)]">{clients.length}</span> clients
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ClientsListPage;
