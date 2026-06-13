import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2, Edit3, Trash2, Power, Zap, ArrowRight } from 'lucide-react';
import Button from '../../../shared/components/Button/Button';
import Card from '../../../shared/components/Card/Card';
import { ConfirmationModal } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { kitService } from '../../../shared/services/kitService';

const AutomationsPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [workflows, setWorkflows] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const labelFor = useCallback(
    (event) => catalog.find((t) => t.event === event)?.label || event,
    [catalog]
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [wf, cat] = await Promise.all([kitService.getWorkflows(), kitService.getTriggerCatalog()]);
      setWorkflows(wf?.data || []);
      setCatalog(cat?.data?.triggers || []);
    } catch (err) {
      toast.error(err?.message || 'Failed to load automations');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggle = async (w) => {
    setBusyId(w._id);
    try {
      const res = await kitService.toggleWorkflow(w._id);
      setWorkflows((prev) => prev.map((x) => (x._id === w._id ? { ...x, isActive: res.data.isActive } : x)));
      toast.success(res.data.isActive ? 'Automation activated' : 'Automation paused');
    } catch (err) {
      toast.error(err?.message || 'Failed to toggle');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await kitService.deleteWorkflow(deleteId);
      setWorkflows((prev) => prev.filter((w) => w._id !== deleteId));
      toast.success('Automation deleted');
      setDeleteId(null);
    } catch (err) {
      toast.error(err?.message || 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'color-mix(in srgb, var(--warning) 16%, transparent)', color: 'var(--warning)' }}>
            <Zap size={24} />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Automations</h1>
            <p className="text-[var(--text-muted)] font-medium">WHEN something happens → IF conditions match → THEN run actions</p>
          </div>
        </div>
        <Button variant="primary" onClick={() => navigate('/kit/automations/create')} className="px-6 py-3">
          <Plus size={18} /> New Automation
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 text-[var(--text-muted)]">
          <Loader2 size={40} className="animate-spin mb-4 opacity-20" />
          <p className="text-sm font-bold uppercase tracking-widest">Loading automations...</p>
        </div>
      ) : workflows.length === 0 ? (
        <div className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-3xl p-16 text-center">
          <div className="w-20 h-20 bg-[var(--bg)] rounded-full flex items-center justify-center mx-auto mb-6">
            <Zap size={32} className="text-[var(--text-muted)] opacity-30" />
          </div>
          <h2 className="text-xl font-black text-[var(--text-primary)]">No Automations Yet</h2>
          <p className="text-[var(--text-muted)] max-w-sm mx-auto mt-2 font-medium">
            Wire a trigger to an action — e.g. "When Lead Created → Start Welcome Campaign".
          </p>
          <Button variant="outline" className="mt-8" onClick={() => navigate('/kit/automations/create')}>
            <Plus size={16} /> New Automation
          </Button>
        </div>
      ) : (
        <Card className="p-0 border-none shadow-xl shadow-black/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[var(--surface)] text-[var(--text-muted)] border-b border-[var(--border)] uppercase tracking-wider text-[11px] font-black">
                <tr>
                  <th className="px-6 py-4">Automation</th>
                  <th className="px-6 py-4">Trigger → Actions</th>
                  <th className="px-6 py-4">Fired</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {workflows.map((w) => (
                  <tr key={w._id} className="hover:bg-[var(--surface)]/50 transition-colors group">
                    <td className="px-6 py-4">
                      <button onClick={() => navigate(`/kit/automations/${w._id}`)}
                        className="font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors text-left">
                        {w.name}
                      </button>
                      {w.conditions?.length > 0 && (
                        <p className="text-xs text-[var(--text-muted)]">{w.conditions.length} condition{w.conditions.length > 1 ? 's' : ''}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-2 text-[var(--text-secondary)] font-medium">
                        <span className="px-2 py-0.5 rounded-md bg-[var(--warning)]/10 text-[var(--warning)] text-xs font-bold">{labelFor(w.trigger?.event)}</span>
                        <ArrowRight size={14} className="text-[var(--text-muted)]" />
                        <span className="text-xs font-bold">{w.actions?.length || 0} action{(w.actions?.length || 0) !== 1 ? 's' : ''}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[var(--text-secondary)] font-bold">{w.fireCount ?? 0}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${w.isActive ? 'text-[var(--success,#27AE60)]' : 'text-[var(--text-muted)]'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${w.isActive ? 'bg-[var(--success,#27AE60)]' : 'bg-[var(--text-muted)]'}`} />
                        {w.isActive ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => toggle(w)} disabled={busyId === w._id} title={w.isActive ? 'Pause' : 'Activate'}
                          className="p-2 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-colors disabled:opacity-40">
                          {busyId === w._id ? <Loader2 size={18} className="animate-spin" /> : <Power size={18} />}
                        </button>
                        <button onClick={() => navigate(`/kit/automations/${w._id}`)} title="Edit"
                          className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] rounded-lg transition-colors">
                          <Edit3 size={18} />
                        </button>
                        <button onClick={() => setDeleteId(w._id)} title="Delete"
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
        title="Delete Automation"
        message="Delete this automation? Active enrollments it created are not affected."
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default AutomationsPage;
