import React, { useEffect, useState, useCallback } from 'react';
import { Users, Loader2, FilePlus, Phone, Mail, ArrowRight, MapPin, CalendarDays, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { crmService } from '../../../shared/services/crmService';
import Button from '../../../shared/components/Button/Button';
import StatusBadge from '../../../shared/components/StatusBadge/StatusBadge';
import Avatar from '../../../shared/components/Avatar/Avatar';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { Loader } from '../../../shared/components';
import useFilters from '../../../shared/filters/useFilters';
import AdvancedFilter from '../../../shared/filters/AdvancedFilter';

const ProposalClientsPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  const {
    filters,
    hasActiveFilters,
    activeFilterCount,
    filterConfig,
    updateFilter,
    clearAllFilters,
    process
  } = useFilters('proposal', 'clients');

  const fetchInterestedLeads = useCallback(async () => {
    setLoading(true);
    try {
      // Pull leads who are marked as Interested or have a proposal sent
      const response = await crmService.getLeads({ lifecycleStage: 'interested', limit: 100 });
      setLeads(response.leads || []);
    } catch (err) {
      toast.error('Failed to fetch clients from CRM.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchInterestedLeads();
  }, [fetchInterestedLeads]);

  // Apply reusable filter system
  const filteredLeads = process(leads);

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Proposal Client List</h1>
          <p className="text-[var(--text-muted)] font-medium flex items-center gap-2">
            CRM Leads synced with Proposal Module
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
          </p>
        </div>
        <Button variant="outline" onClick={fetchInterestedLeads}>Refresh Data</Button>
      </div>

      {/* Advanced Filter System */}
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

      {loading ? (
        <Loader label="Syncing with CRM..." />
      ) : filteredLeads.length > 0 ? (
        <div className="space-y-4">
          {filteredLeads.map((lead) => (
            <div
              key={lead._id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-md hover:shadow-black/5 transition-all duration-200 group cursor-pointer"
              onClick={() => navigate(`/proposal/create?leadId=${lead._id}`)}
            >
              {/* Avatar - matches LeadCard */}
              <Avatar
                name={lead.name}
                size="lg"
                className="bg-[var(--primary)]/20 text-[var(--primary)] font-bold shrink-0"
              />

              {/* Name / Phone / City - matches LeadCard */}
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">{lead.name}</p>
                <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                  <Phone size={13} className="shrink-0" />
                  <span>{lead.phone}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                  <MapPin size={13} className="shrink-0" />
                  <span>{lead.city || 'No location'}</span>
                </div>
              </div>

              {/* Project box - matches LeadCard */}
              <div className="flex items-center gap-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2.5 sm:w-56 shrink-0">
                <Building2 size={18} className="text-[var(--text-muted)] shrink-0" />
                <span className="text-sm text-[var(--text-secondary)] leading-snug line-clamp-2">{lead.projectType}</span>
              </div>

              {/* Date + Status - matches LeadCard */}
              <div className="flex flex-col items-start sm:items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                  <CalendarDays size={14} className="shrink-0" />
                  <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                </div>
                <StatusBadge value={lead.lifecycleStage} type="lifecycle" />
              </div>

              {/* Action Buttons - User wants these smaller */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="primary"
                  className="h-8 px-3 text-[9px] font-black uppercase tracking-widest"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/proposal/create?leadId=${lead._id}`);
                  }}
                >
                  <FilePlus size={12} />
                  Draft Proposal
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="aspect-square !p-0 w-8 h-8 flex items-center justify-center hover:bg-[var(--primary)] hover:text-black border-[var(--border)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/proposal/create?leadId=${lead._id}`);
                  }}
                >
                  <ArrowRight size={14} className="text-[var(--text-primary)] group-hover:text-black transition-colors" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-3xl p-16 text-center">
          <div className="w-20 h-20 bg-[var(--bg)] rounded-full flex items-center justify-center mx-auto mb-6">
            <Users size={32} className="text-[var(--text-muted)] opacity-30" />
          </div>
          <h2 className="text-xl font-black text-[var(--text-primary)]">No Interested Leads Found</h2>
          <p className="text-[var(--text-muted)] max-w-sm mx-auto mt-2 font-medium">
            Leads marked as "Interested" in the CRM will automatically appear here for proposal generation.
          </p>
          <Button
            variant="outline"
            className="mt-8"
            onClick={() => navigate('/crm/leads')}
          >
            Go to CRM Pipeline
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProposalClientsPage;
