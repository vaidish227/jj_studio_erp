import React, { useState } from 'react';
import { Plus, ShoppingCart, Truck, CheckCircle2, Clock, XCircle, Edit2, Trash2 } from 'lucide-react';
import { Button, Modal, Loader } from '../../../../shared/components';
import PermissionGate from '../../../../shared/components/PermissionGate/PermissionGate';
import { useToast } from '../../../../shared/notifications/ToastProvider';
import usePurchaseOrders from '../../hooks/usePurchaseOrders';
import useVendors from '../../hooks/useVendors';

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtCurrency = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

const PO_STATUS = {
  draft:          { label: 'Draft',         icon: Clock,        color: 'text-[var(--text-muted)]',  bg: 'bg-[var(--border)]' },
  sent_to_vendor: { label: 'Sent to Vendor',icon: Truck,        color: 'text-[var(--accent-blue)]', bg: 'bg-[var(--accent-blue)]/10' },
  confirmed:      { label: 'Confirmed',     icon: CheckCircle2, color: 'text-[var(--success)]',     bg: 'bg-[var(--success)]/10' },
  delivered:      { label: 'Delivered',     icon: CheckCircle2, color: 'text-[var(--primary)]',     bg: 'bg-[var(--primary)]/10' },
  cancelled:      { label: 'Cancelled',     icon: XCircle,      color: 'text-[var(--error)]',       bg: 'bg-[var(--error)]/10' },
};

const PAY_STATUS = {
  unpaid:         { label: 'Unpaid',         color: 'text-[var(--error)]' },
  partially_paid: { label: 'Partially Paid', color: 'text-[var(--warning)]' },
  fully_paid:     { label: 'Fully Paid',     color: 'text-[var(--success)]' },
};

const POStatusBadge = ({ status }) => {
  const cfg = PO_STATUS[status] || PO_STATUS.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
};

const EMPTY_ITEM = { description: '', quantity: 1, rate: 0 };

const POModal = ({ isOpen, onClose, onSave, vendors, title }) => {
  const [form, setForm] = useState({ vendorId: '', items: [{ ...EMPTY_ITEM }], expectedDeliveryDate: '', deliveryLocation: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const handleField = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const handleItem  = (i, k, v) => setForm((p) => {
    const items = [...p.items];
    items[i] = { ...items[i], [k]: v };
    return { ...p, items };
  });
  const addItem    = () => setForm((p) => ({ ...p, items: [...p.items, { ...EMPTY_ITEM }] }));
  const removeItem = (i) => setForm((p) => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));

  const totalAmount = form.items.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.rate)), 0);

  const submit = async () => {
    if (!form.vendorId) return;
    setSaving(true);
    try {
      await onSave({ ...form, totalAmount, items: form.items.map((it) => ({ ...it, amount: it.quantity * it.rate })) });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Vendor *</label>
          <select value={form.vendorId} onChange={(e) => handleField('vendorId', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]">
            <option value="">Select vendor…</option>
            {vendors.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Line Items</label>
            <button onClick={addItem} className="text-xs text-[var(--primary)] hover:underline font-semibold">+ Add Item</button>
          </div>
          <div className="space-y-2">
            {form.items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input placeholder="Description" value={item.description} onChange={(e) => handleItem(i, 'description', e.target.value)}
                  className="col-span-6 px-2 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]" />
                <input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => handleItem(i, 'quantity', e.target.value)}
                  className="col-span-2 px-2 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]" />
                <input type="number" placeholder="Rate" value={item.rate} onChange={(e) => handleItem(i, 'rate', e.target.value)}
                  className="col-span-3 px-2 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]" />
                {form.items.length > 1 && (
                  <button onClick={() => removeItem(i)} className="col-span-1 flex justify-center text-[var(--error)] hover:bg-[var(--error)]/10 rounded-lg p-1 transition-colors">
                    <XCircle size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="text-right mt-2 text-sm font-bold text-[var(--text-primary)]">
            Total: {fmtCurrency(totalAmount)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Expected Delivery</label>
            <input type="date" value={form.expectedDeliveryDate} onChange={(e) => handleField('expectedDeliveryDate', e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Delivery Location</label>
            <input value={form.deliveryLocation} onChange={(e) => handleField('deliveryLocation', e.target.value)} placeholder="Site address or warehouse"
              className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!form.vendorId || saving}>
            {saving ? 'Creating…' : 'Create PO'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const PurchaseOrdersTab = ({ project }) => {
  const { success, error: toastError } = useToast();
  const { pos, isLoading, error, createPO, updatePO, deletePO } = usePurchaseOrders(project._id);
  const { vendors } = useVendors();
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = async (data) => {
    try { await createPO(data); success(`Purchase Order created`); }
    catch (e) { toastError(e || 'Failed to create PO'); }
  };

  const handleStatusUpdate = async (id, status) => {
    try { await updatePO(id, { status }); success('PO status updated'); }
    catch (e) { toastError(e || 'Failed to update PO'); }
  };

  const handleDelete = async (id) => {
    try { await deletePO(id); success('PO deleted'); }
    catch (e) { toastError(e || 'Failed to delete PO'); }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader label="Loading purchase orders…" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          Purchase Orders <span className="text-[var(--text-muted)] font-normal">({pos.length})</span>
        </h3>
        <PermissionGate permission="purchase_orders.create">
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Create PO</Button>
        </PermissionGate>
      </div>

      {error && <p className="text-xs text-[var(--error)]">{error}</p>}

      {pos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center mb-3">
            <ShoppingCart size={22} className="text-[var(--primary)]" />
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">No purchase orders</p>
          <p className="text-xs text-[var(--text-muted)] mb-4">Create POs for AC, automation, kitchen, or material vendors.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pos.map((po) => (
            <div key={po._id} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2 flex-wrap mb-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-0.5">{po.poNumber}</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{po.vendorId?.name || '—'}</p>
                  {po.taskId && <p className="text-xs text-[var(--text-muted)]">Task: {po.taskId.title}</p>}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <POStatusBadge status={po.status} />
                  <p className="text-xs font-bold text-[var(--text-primary)]">{fmtCurrency(po.totalAmount)}</p>
                  <span className={`text-[10px] font-semibold ${PAY_STATUS[po.paymentStatus]?.color || ''}`}>
                    {PAY_STATUS[po.paymentStatus]?.label || po.paymentStatus}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] mb-3">
                {po.expectedDeliveryDate && (
                  <span className="flex items-center gap-1"><Truck size={11} /> Expected: {fmt(po.expectedDeliveryDate)}</span>
                )}
                {po.deliveryLocation && <span>{po.deliveryLocation}</span>}
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[var(--border)]">
                <PermissionGate permission="purchase_orders.update">
                  {po.status === 'draft' && (
                    <button onClick={() => handleStatusUpdate(po._id, 'sent_to_vendor')}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/20 transition-colors">
                      Mark Sent
                    </button>
                  )}
                  {po.status === 'sent_to_vendor' && (
                    <button onClick={() => handleStatusUpdate(po._id, 'confirmed')}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[var(--success)]/10 text-[var(--success)] hover:bg-[var(--success)]/20 transition-colors">
                      Confirm
                    </button>
                  )}
                  {po.status === 'confirmed' && (
                    <button onClick={() => handleStatusUpdate(po._id, 'delivered')}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors">
                      Mark Delivered
                    </button>
                  )}
                </PermissionGate>
                <PermissionGate permission="purchase_orders.update">
                  <button onClick={() => handleDelete(po._id)}
                    className="text-[10px] font-bold px-2 py-1 rounded-lg hover:bg-[var(--error)]/10 text-[var(--text-muted)] hover:text-[var(--error)] transition-colors ml-auto flex items-center gap-1">
                    <Trash2 size={11} /> Delete
                  </button>
                </PermissionGate>
              </div>
            </div>
          ))}
        </div>
      )}

      <POModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={handleCreate}
        vendors={vendors}
        title="Create Purchase Order"
      />
    </div>
  );
};

export default PurchaseOrdersTab;
