import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2, Edit3, Trash2, Play, Pause, Megaphone, Users, Search } from 'lucide-react';
import Button from '../../../shared/components/Button/Button';
import Card from '../../../shared/components/Card/Card';
import { ConfirmationModal } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { kitService } from '../../../shared/services/kitService';
import { CAMPAIGN_STATUS_META } from '../constants';

const StatusPill = ({ status }) => {
  const meta = CAMPAIGN_STATUS_META[status] || CAMPAIGN_STATUS_META.draft;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: meta.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
};

const CampaignsPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await kitService.getCampaigns();
      setCampaigns(res?.data || []);
    } catch (err) {
      toast.error(err?.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter((c) => [c.name, c.audience].some((f) => (f || '').toLowerCase().includes(q)));
  }, [campaigns, search]);

  const toggleStatus = async (c) => {
    const next = c.status === 'active' ? 'paused' : 'active';
    setBusyId(c._id);
    try {
      const res = await kitService.updateCampaign(c._id, { status: next });
      setCampaigns((prev) => prev.map((x) => (x._id === c._id ? { ...x, status: res.data.status } : x)));
      toast.success(next === 'active' ? 'Campaign activated' : 'Campaign paused');
    } catch (err) {
      toast.error(err?.message || 'Failed to update status');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await kitService.deleteCampaign(deleteId);
      setCampaigns((prev) => prev.filter((c) => c._id !== deleteId));
      toast.success('Campaign deleted');
      setDeleteId(null);
    } catch (err) {
      toast.error(err?.message || 'Failed to delete campaign');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)', color: 'var(--primary)' }}>
            <Megaphone size={24} />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Campaigns</h1>
            <p className="text-[var(--text-muted)] font-medium">Multi-step nurture journeys that send automatically</p>
          </div>
        </div>
        <Button variant="primary" onClick={() => navigate('/kit/campaigns/create')} className="px-6 py-3">
          <Plus size={18} /> New Campaign
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search campaigns..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] transition-colors" />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 text-[var(--text-muted)]">
          <Loader2 size={40} className="animate-spin mb-4 opacity-20" />
          <p className="text-sm font-bold uppercase tracking-widest">Loading campaigns...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-3xl p-16 text-center">
          <div className="w-20 h-20 bg-[var(--bg)] rounded-full flex items-center justify-center mx-auto mb-6">
            <Megaphone size={32} className="text-[var(--text-muted)] opacity-30" />
          </div>
          <h2 className="text-xl font-black text-[var(--text-primary)]">No Campaigns Yet</h2>
          <p className="text-[var(--text-muted)] max-w-sm mx-auto mt-2 font-medium">
            Build your first nurture journey — add steps with delays and templates, then enroll leads.
          </p>
          <Button variant="outline" className="mt-8" onClick={() => navigate('/kit/campaigns/create')}>
            <Plus size={16} /> New Campaign
          </Button>
        </div>
      ) : (
        <Card className="p-0 border-none shadow-xl shadow-black/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[var(--surface)] text-[var(--text-muted)] border-b border-[var(--border)] uppercase tracking-wider text-[11px] font-black">
                <tr>
                  <th className="px-6 py-4">Campaign</th>
                  <th className="px-6 py-4">Audience</th>
                  <th className="px-6 py-4">Steps</th>
                  <th className="px-6 py-4">Active</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((c) => (
                  <tr key={c._id} className="hover:bg-[var(--surface)]/50 transition-colors group">
                    <td className="px-6 py-4">
                      <button onClick={() => navigate(`/kit/campaigns/${c._id}`)}
                        className="font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors text-left">
                        {c.name}
                      </button>
                      {c.description && <p className="text-xs text-[var(--text-muted)] truncate max-w-[320px]">{c.description}</p>}
                    </td>
                    <td className="px-6 py-4 capitalize text-[var(--text-secondary)] font-medium">{c.audience?.replace('_', ' ')}</td>
                    <td className="px-6 py-4 text-[var(--text-secondary)] font-bold">{c.stepCount ?? 0}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] font-bold">
                        <Users size={14} /> {c.activeEnrollments ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4"><StatusPill status={c.status} /></td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {c.status !== 'archived' && (
                          <button onClick={() => toggleStatus(c)} disabled={busyId === c._id}
                            title={c.status === 'active' ? 'Pause' : 'Activate'}
                            className="p-2 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-colors disabled:opacity-40">
                            {busyId === c._id ? <Loader2 size={18} className="animate-spin" /> : (c.status === 'active' ? <Pause size={18} /> : <Play size={18} />)}
                          </button>
                        )}
                        <button onClick={() => navigate(`/kit/campaigns/${c._id}`)} title="Edit"
                          className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] rounded-lg transition-colors">
                          <Edit3 size={18} />
                        </button>
                        <button onClick={() => setDeleteId(c._id)} title="Delete"
                          className="p-2 text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 rounded-lg transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ConfirmationModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Campaign"
        message="Deleting this campaign removes its steps and stops all active enrollments. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default CampaignsPage;
