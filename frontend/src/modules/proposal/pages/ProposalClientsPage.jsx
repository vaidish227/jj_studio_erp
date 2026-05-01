import React, { useEffect, useState } from 'react';
import { Users, Search, Loader2, FilePlus, Phone, Mail, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { crmService } from '../../../shared/services/crmService';
import Card from '../../../shared/components/Card/Card';
import Button from '../../../shared/components/Button/Button';
import StatusBadge from '../../../shared/components/StatusBadge/StatusBadge';

const ProposalClientsPage = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchInterestedLeads = async () => {
    setLoading(true);
    try {
      // Pull leads who are marked as Interested or have a proposal sent
      const response = await crmService.getLeads({ lifecycleStage: 'interested' });
      setLeads(response.leads || []);
    } catch (err) {
      console.error('Failed to fetch proposal clients', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterestedLeads();
  }, []);

  const filteredLeads = leads.filter(lead => 
    lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.phone?.includes(searchTerm)
  );

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

      <div className="relative group max-w-2xl">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors"
        />
        <input
          type="text"
          placeholder="Search by name, email or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-11 pr-4 py-4 text-sm rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all shadow-sm"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
          <Loader2 size={40} className="animate-spin mb-4 opacity-20" />
          <p className="text-sm font-bold uppercase tracking-widest">Syncing with CRM...</p>
        </div>
      ) : filteredLeads.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredLeads.map((lead) => (
            <Card key={lead._id} className="p-0 overflow-hidden border-none shadow-xl shadow-black/5 hover:shadow-2xl hover:shadow-[var(--primary)]/5 transition-all group">
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-black text-xl">
                    {lead.name.charAt(0)}
                  </div>
                  <StatusBadge value={lead.lifecycleStage} type="lifecycle" />
                </div>
                
                <div>
                  <h3 className="text-lg font-black text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">{lead.name}</h3>
                  <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider mt-0.5">{lead.projectType || 'Standard Project'}</p>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                    <Phone size={14} className="text-[var(--text-muted)]" />
                    <span className="font-medium">{lead.phone || 'No phone'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                    <Mail size={14} className="text-[var(--text-muted)]" />
                    <span className="font-medium truncate">{lead.email || 'No email'}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[var(--bg)]/50 border-t border-[var(--border)] flex gap-2">
                <Button 
                  variant="primary" 
                  fullWidth 
                  className="py-3 text-[10px] font-black uppercase tracking-widest"
                  onClick={() => navigate(`/proposal/create?leadId=${lead._id}`)}
                >
                  <FilePlus size={14} />
                  Draft Proposal
                </Button>
                <Button 
                  variant="outline" 
                  className="aspect-square p-0 w-12 flex items-center justify-center hover:bg-[var(--primary)] hover:text-black border-[var(--border)]"
                  onClick={() => navigate(`/proposal/create?leadId=${lead._id}`)}
                >
                  <ArrowRight size={18} />
                </Button>
              </div>
            </Card>
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
