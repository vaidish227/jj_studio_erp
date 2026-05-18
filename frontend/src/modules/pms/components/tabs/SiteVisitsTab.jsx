import React, { useState } from 'react';
import { Plus, MapPin, Calendar, User, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Button, Modal, Loader } from '../../../../shared/components';
import PermissionGate from '../../../../shared/components/PermissionGate/PermissionGate';
import { useToast } from '../../../../shared/notifications/ToastProvider';
import { useAuth } from '../../../../shared/context/AuthContext';
import useSiteVisits from '../../hooks/useSiteVisits';

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const PURPOSES = ['Measurement', 'Quality Check', 'Client Meeting at Site', 'Snag List', 'Final Handover'];

const STATUS_MAP = {
  planned:   { label: 'Planned',   icon: Clock,        color: 'text-[var(--accent-blue)]',  bg: 'bg-[var(--accent-blue)]/10' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-[var(--success)]',      bg: 'bg-[var(--success)]/10' },
  cancelled: { label: 'Cancelled', icon: XCircle,      color: 'text-[var(--error)]',        bg: 'bg-[var(--error)]/10' },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_MAP[status] || STATUS_MAP.planned;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
};

const EMPTY = { purpose: '', visitDate: '', observations: '', actionsRequired: '', status: 'completed', nextVisitDate: '' };

const VisitModal = ({ isOpen, onClose, onSave, userId, title }) => {
  const [form, setForm] = useState({ ...EMPTY, visitorId: userId });
  const [saving, setSaving] = useState(false);

  const handle = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.purpose || !form.visitDate) return;
    setSaving(true);
    try { await onSave(form); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Purpose *</label>
          <select
            value={form.purpose}
            onChange={(e) => handle('purpose', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          >
            <option value="">Select purpose…</option>
            {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Visit Date *</label>
            <input type="date" value={form.visitDate} onChange={(e) => handle('visitDate', e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Status</label>
            <select value={form.status} onChange={(e) => handle('status', e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              <option value="completed">Completed</option>
              <option value="planned">Planned</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Observations</label>
          <textarea value={form.observations} onChange={(e) => handle('observations', e.target.value)}
            rows={2} placeholder="What was observed on site…"
            className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Actions Required</label>
          <textarea value={form.actionsRequired} onChange={(e) => handle('actionsRequired', e.target.value)}
            rows={2} placeholder="Follow-up actions needed…"
            className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Next Visit Date</label>
          <input type="date" value={form.nextVisitDate} onChange={(e) => handle('nextVisitDate', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!form.purpose || !form.visitDate || saving}>
            {saving ? 'Saving…' : 'Log Visit'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const SiteVisitsTab = ({ project }) => {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const { visits, isLoading, error, createVisit } = useSiteVisits(project._id);
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = async (data) => {
    try { await createVisit(data); success('Site visit logged'); }
    catch (e) { toastError(e || 'Failed to log visit'); }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader label="Loading site visits…" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          Site Visits <span className="text-[var(--text-muted)] font-normal">({visits.length})</span>
        </h3>
        <PermissionGate permission="site_visits.create">
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Log Visit
          </Button>
        </PermissionGate>
      </div>

      {error && <p className="text-xs text-[var(--error)]">{error}</p>}

      {visits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center mb-3">
            <MapPin size={22} className="text-[var(--primary)]" />
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">No site visits logged</p>
          <p className="text-xs text-[var(--text-muted)] mb-4">Log visits by designers, managers, or principals.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visits.map((v) => (
            <div key={v._id} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2 flex-wrap mb-3">
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{v.purpose}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                    <span className="flex items-center gap-1"><Calendar size={11} /> {fmt(v.visitDate)}</span>
                    <span className="flex items-center gap-1"><User size={11} /> {v.visitorId?.name || '—'}</span>
                  </div>
                </div>
                <StatusBadge status={v.status} />
              </div>
              {v.observations && (
                <div className="mb-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-0.5">Observations</p>
                  <p className="text-xs text-[var(--text-secondary)]">{v.observations}</p>
                </div>
              )}
              {v.actionsRequired && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mb-0.5">Actions Required</p>
                  <p className="text-xs text-[var(--text-secondary)]">{v.actionsRequired}</p>
                </div>
              )}
              {v.nextVisitDate && (
                <p className="text-xs text-[var(--accent-blue)] mt-2">
                  Next visit: {fmt(v.nextVisitDate)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <VisitModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={handleCreate}
        userId={user?._id}
        title="Log Site Visit"
      />
    </div>
  );
};

export default SiteVisitsTab;
