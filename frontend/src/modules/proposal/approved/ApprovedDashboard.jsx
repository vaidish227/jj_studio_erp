import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Search,
  RotateCcw,
  PlayCircle,
  Eye,
  CheckCircle2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Card, Button, Loader, StatusBadge } from '../../../shared/components';
import { crmService } from '../../../shared/services/crmService';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { formatDateMedium } from '../../../shared/utils/dateUtils';

const ApprovedDashboard = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchProposals(); }, []);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const res = await crmService.getProposals({ status: 'project_ready,project_started' });
      setProposals(res?.proposals || []);
    } catch (err) {
      toast.error('Failed to load project-ready proposals');
    } finally {
      setLoading(false);
    }
  };

  const startProject = async (id) => {
    try {
      setLoading(true);
      await crmService.updateProposalStatus(id, { status: 'project_started', remarks: 'Project officially started.' });
      toast.success('Project started successfully!');
      fetchProposals();
    } catch (err) {
      toast.error('Failed to start project');
    } finally {
      setLoading(false);
    }
  };

  const filteredProposals = proposals.filter(p =>
    p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.clientId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.leadId?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="border-l-4 border-[var(--primary)] pl-4">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Approved & Ready</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Signed & Paid proposals ready for project initiation.</p>
        </div>
        <Button variant="outline" onClick={fetchProposals} className="w-full sm:w-auto">
          <RotateCcw size={16} /> Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="relative group">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors" />
        <input
          type="text"
          placeholder="Search by client or proposal..."
          className="w-full pl-11 pr-4 py-3 text-sm rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-20 text-center"><Loader label="Checking project readiness..." /></div>
      ) : filteredProposals.length === 0 ? (
        <div className="py-20 text-center bg-[var(--surface)] rounded-2xl border border-dashed border-[var(--border)]">
          <div className="w-14 h-14 rounded-full bg-[var(--bg)] flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={28} className="text-[var(--text-muted)] opacity-40" />
          </div>
          <p className="text-sm text-[var(--text-muted)]">No proposals are ready to start a project yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProposals.map((p) => (
            <Card key={p._id} padding="p-6" className="hover:border-[var(--primary)]/30 transition-all">
              <div className="flex justify-between items-start mb-5">
                <div className="w-12 h-12 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] font-black text-xs">
                  {p.title?.substring(0, 2).toUpperCase() || 'PR'}
                </div>
                <StatusBadge status={p.status} />
              </div>

              <h3 className="text-base font-bold text-[var(--text-primary)] leading-tight">
                {p.clientId?.name || p.leadId?.name}
              </h3>
              <p className="text-xs text-[var(--text-muted)] font-medium mt-0.5 mb-5">{p.title}</p>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-[var(--bg)] p-3 rounded-xl border border-[var(--border)]">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">eSign</p>
                  <div className="flex items-center gap-1.5 text-[var(--success)] text-[10px] font-bold">
                    <CheckCircle2 size={12} /> Received
                  </div>
                </div>
                <div className="bg-[var(--bg)] p-3 rounded-xl border border-[var(--border)]">
                  <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">Advance</p>
                  <div className="flex items-center gap-1.5 text-[var(--success)] text-[10px] font-bold">
                    <CheckCircle2 size={12} /> Received
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  <Calendar size={13} />
                  <span className="text-[10px] font-medium">{formatDateMedium(p.createdAt)}</span>
                </div>
                {p.status === 'project_ready' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    className="font-bold"
                    onClick={() => startProject(p._id)}
                  >
                    <PlayCircle size={14} /> Start Project
                  </Button>
                ) : (
                  <div className="text-[var(--success)] text-[10px] font-bold flex items-center gap-1.5">
                    <CheckCircle2 size={13} /> Started
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-[var(--border)] flex justify-between items-center">
                <button
                  onClick={() => navigate(`/proposal/review/${p._id}`)}
                  className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors flex items-center gap-1.5"
                >
                  <Eye size={13} /> Review
                </button>
                <span className="text-sm font-bold text-[var(--text-primary)]">₹{p.finalAmount?.toLocaleString('en-IN')}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ApprovedDashboard;
