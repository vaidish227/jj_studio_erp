import React, { useState } from 'react';
import { Plus, Package, Edit2 } from 'lucide-react';
import { Button, Modal, Loader } from '../../../../shared/components';
import PermissionGate from '../../../../shared/components/PermissionGate/PermissionGate';
import { useToast } from '../../../../shared/notifications/ToastProvider';
import useMaterials from '../../hooks/useMaterials';

const CATEGORIES = ['Flooring', 'Fittings', 'Paint', 'Hardware', 'Lighting', 'Furniture', 'Other'];
const STATUSES   = ['proposed', 'selected_by_client', 'ordered', 'delivered_at_site'];
const SOURCES    = ['showroom', 'catalog', 'website', 'sample_at_office'];

const STATUS_LABELS = {
  proposed:           { label: 'Proposed',          color: 'text-[var(--text-muted)]',   bg: 'bg-[var(--border)]' },
  selected_by_client: { label: 'Client Selected',   color: 'text-[var(--accent-blue)]',  bg: 'bg-[var(--accent-blue)]/10' },
  ordered:            { label: 'Ordered',            color: 'text-[var(--warning)]',      bg: 'bg-[var(--warning)]/10' },
  delivered_at_site:  { label: 'Delivered at Site',  color: 'text-[var(--success)]',      bg: 'bg-[var(--success)]/10' },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_LABELS[status] || STATUS_LABELS.proposed;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>;
};

const EMPTY = { category: '', itemName: '', brand: '', specification: '', quantity: '', unit: 'pcs', selectionStatus: 'proposed', selectionSource: '', notes: '' };

const MaterialModal = ({ isOpen, onClose, onSave, initial = EMPTY, title }) => {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const handle = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.category || !form.itemName.trim()) return;
    setSaving(true);
    try { await onSave(form); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Category *</label>
            <select value={form.category} onChange={(e) => handle('category', e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]">
              <option value="">Select…</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Status</label>
            <select value={form.selectionStatus} onChange={(e) => handle('selectionStatus', e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]">
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]?.label || s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Item Name *</label>
          <input value={form.itemName} onChange={(e) => handle('itemName', e.target.value)} placeholder="e.g. Vitrified Tile 600x600"
            className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Brand</label>
            <input value={form.brand} onChange={(e) => handle('brand', e.target.value)} placeholder="Brand name"
              className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Specification</label>
            <input value={form.specification} onChange={(e) => handle('specification', e.target.value)} placeholder="Color, size, model…"
              className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Quantity</label>
            <input type="number" value={form.quantity} onChange={(e) => handle('quantity', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Unit</label>
            <input value={form.unit} onChange={(e) => handle('unit', e.target.value)} placeholder="pcs / sqft / ltr"
              className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Source</label>
          <select value={form.selectionSource} onChange={(e) => handle('selectionSource', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]">
            <option value="">Not specified</option>
            {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Notes</label>
          <textarea value={form.notes} onChange={(e) => handle('notes', e.target.value)} rows={2} placeholder="Additional notes…"
            className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!form.category || !form.itemName.trim() || saving}>
            {saving ? 'Saving…' : 'Save Material'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const CATEGORY_COLORS = {
  Flooring: 'bg-[var(--warning)]/10 text-[var(--warning)]', Fittings: 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]',
  Paint:    'bg-[var(--accent-teal)]/10 text-[var(--accent-teal)]',   Hardware: 'bg-[var(--bg)] text-[var(--text-muted)]',
  Lighting: 'bg-[var(--primary)]/10 text-[var(--primary)]', Furniture: 'bg-[var(--accent-green)]/10 text-[var(--accent-green)]',
  Other:    'bg-[var(--border)] text-[var(--text-muted)]',
};

const MaterialsTab = ({ project }) => {
  const { success, error: toastError } = useToast();
  const { materials, isLoading, error, createMaterial, updateMaterial } = useMaterials(project._id);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing]       = useState(null);

  const grouped = materials.reduce((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  if (isLoading) return <div className="flex justify-center py-16"><Loader label="Loading materials…" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          Materials <span className="text-[var(--text-muted)] font-normal">({materials.length})</span>
        </h3>
        <PermissionGate permission="materials.create">
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Add Material</Button>
        </PermissionGate>
      </div>

      {error && <p className="text-xs text-[var(--error)]">{error}</p>}

      {materials.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center mb-3">
            <Package size={22} className="text-[var(--primary)]" />
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">No materials tracked</p>
          <p className="text-xs text-[var(--text-muted)] mb-4">Add tiles, fittings, paint and other material selections.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${CATEGORY_COLORS[category] || CATEGORY_COLORS.Other}`}>{category}</span>
                <span className="text-xs text-[var(--text-muted)]">{items.length} item{items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((m) => (
                  <div key={m._id} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[var(--text-primary)] truncate">{m.itemName}</p>
                        {m.brand && <p className="text-xs text-[var(--text-muted)]">{m.brand}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <StatusBadge status={m.selectionStatus} />
                        <PermissionGate permission="materials.update">
                          <button onClick={() => setEditing(m)} className="p-1 rounded-lg hover:bg-[var(--bg)] text-[var(--text-muted)] transition-colors ml-1">
                            <Edit2 size={12} />
                          </button>
                        </PermissionGate>
                      </div>
                    </div>
                    {m.specification && <p className="text-xs text-[var(--text-secondary)] mb-1">{m.specification}</p>}
                    <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                      {m.quantity && <span>{m.quantity} {m.unit}</span>}
                      {m.selectionSource && <span className="capitalize">{m.selectionSource.replace(/_/g, ' ')}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <MaterialModal isOpen={showCreate} onClose={() => setShowCreate(false)} onSave={async (d) => { try { await createMaterial(d); success('Material added'); } catch (e) { toastError(e || 'Failed'); } }} title="Add Material" />
      {editing && (
        <MaterialModal
          isOpen={!!editing}
          onClose={() => setEditing(null)}
          onSave={async (d) => { try { await updateMaterial(editing._id, d); success('Material updated'); setEditing(null); } catch (e) { toastError(e || 'Failed'); } }}
          initial={{ category: editing.category, itemName: editing.itemName, brand: editing.brand || '', specification: editing.specification || '', quantity: editing.quantity || '', unit: editing.unit || 'pcs', selectionStatus: editing.selectionStatus, selectionSource: editing.selectionSource || '', notes: editing.notes || '' }}
          title="Edit Material"
        />
      )}
    </div>
  );
};

export default MaterialsTab;
