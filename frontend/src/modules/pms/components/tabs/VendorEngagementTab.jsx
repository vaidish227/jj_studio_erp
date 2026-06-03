import React, { useState } from 'react';
import {
  Wind, Cpu, ChefHat, MessageCircle, FileText, IndianRupee, CheckCircle2,
  AlertTriangle, Plus, ArrowRight, ShoppingBag, Truck, MapPin,
} from 'lucide-react';
import { Button, Modal, FormField, Input } from '../../../../shared/components';
import { useToast } from '../../../../shared/notifications/ToastProvider';
import { useAuth } from '../../../../shared/context/AuthContext';
import { pmsService } from '../../../../shared/services/pmsService';
import useVendorEngagements from '../../hooks/useVendorEngagements';
import CreateVendorEngagementModal from '../CreateVendorEngagementModal';

const KIND_META = {
  ac:         { label: 'AC',          icon: <Wind size={14} />,    color: 'text-[var(--accent-blue)]' },
  automation: { label: 'Automation',  icon: <Cpu size={14} />,     color: 'text-[var(--primary)]'    },
  kitchen:    { label: 'Kitchen',     icon: <ChefHat size={14} />, color: 'text-[var(--warning)]'    },
};

const STATUS_ORDER = ['requested', 'quoted', 'client_approved', 'po_emitted', 'delivered', 'site_received'];
const STATUS_LABELS = {
  requested:       'Requested',
  quoted:          'Quoted',
  client_approved: 'Client Approved',
  po_emitted:      'PO Emitted',
  delivered:       'Delivered',
  site_received:   'Site Received',
  cancelled:       'Cancelled',
};

const fmtINR = (n) => (n ? `₹${Number(n).toLocaleString('en-IN')}` : '—');

const StatusTimeline = ({ status }) => {
  const idx = STATUS_ORDER.indexOf(status);
  return (
    <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
      {STATUS_ORDER.map((s, i) => {
        const done = i < idx;
        const here = i === idx;
        return (
          <React.Fragment key={s}>
            <span
              className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0
                ${done ? 'bg-[var(--success)]/10 text-[var(--success)]' : ''}
                ${here ? 'bg-[var(--primary)]/15 text-[var(--primary)]' : ''}
                ${!done && !here ? 'text-[var(--text-muted)] bg-[var(--bg)] border border-[var(--border)]' : ''}
              `}
            >
              {STATUS_LABELS[s]}
            </span>
            {i < STATUS_ORDER.length - 1 && (
              <ArrowRight size={10} className={done ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const QuoteModal = ({ engagement, isOpen, onClose, onSaved }) => {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error('Enter a positive quote amount');
      return;
    }
    setSubmitting(true);
    try {
      await pmsService.recordVendorQuote(engagement._id, {
        amount: Number(amount),
        quotationUrl: url || undefined,
      });
      toast.success('Quote recorded');
      onSaved?.();
      onClose();
      setAmount('');
      setUrl('');
    } catch (err) {
      toast.error(err?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Vendor Quote" className="max-w-md">
      <div className="space-y-4">
        <FormField label="Amount (₹)" required>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" />
        </FormField>
        <FormField label="Quotation URL (optional)">
          <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </FormField>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSave} isLoading={submitting}>Save Quote</Button>
        </div>
      </div>
    </Modal>
  );
};

const EmitPOModal = ({ engagement, isOpen, onClose, onSaved }) => {
  const toast = useToast();
  const [itemName, setItemName] = useState('Engagement deliverable');
  const [qty, setQty] = useState('1');
  const [rate, setRate] = useState(engagement?.amount ? String(engagement.amount) : '');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await pmsService.emitVendorPO(engagement._id, {
        items: [
          {
            itemName: itemName || 'Engagement deliverable',
            quantity: Number(qty) || 1,
            unit: 'unit',
            rate: Number(rate) || engagement.amount || 0,
          },
        ],
      });
      toast.success('PO emitted');
      onSaved?.();
      onClose();
    } catch (err) {
      const msg = err?.code === 'PO_EMIT_NOT_ALLOWED'
        ? 'PO emission requires client approval first.'
        : err?.message || 'Failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Emit Purchase Order" className="max-w-md">
      <div className="space-y-4">
        <FormField label="Line item description" required>
          <Input value={itemName} onChange={(e) => setItemName(e.target.value)} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Quantity" required>
            <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
          </FormField>
          <FormField label="Rate (₹)" required>
            <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
          </FormField>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Total: <span className="font-bold text-[var(--text-primary)]">
            {fmtINR((Number(qty) || 0) * (Number(rate) || 0))}
          </span>
        </p>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSave} isLoading={submitting}>Emit PO</Button>
        </div>
      </div>
    </Modal>
  );
};

const EngagementCard = ({ engagement, onRefresh }) => {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [poOpen, setPOOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const meta = KIND_META[engagement.vendorKind] || { label: engagement.vendorKind, icon: null, color: '' };
  const isCancelled = engagement.status === 'cancelled';

  const handleClientApproval = async () => {
    setSubmitting(true);
    try {
      await pmsService.recordVendorClientApproval(engagement._id);
      toast.success('Client approval recorded — gate cascade triggered');
      onRefresh?.();
    } catch (err) {
      toast.error(err?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkDelivered = async () => {
    setSubmitting(true);
    try {
      await pmsService.markVendorDelivered(engagement._id);
      toast.success('Marked delivered');
      onRefresh?.();
    } catch (err) {
      toast.error(err?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkSiteReceived = async () => {
    setSubmitting(true);
    try {
      await pmsService.markVendorSiteReceived(engagement._id);
      toast.success('Marked site received');
      onRefresh?.();
    } catch (err) {
      toast.error(err?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 lg:p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`shrink-0 ${meta.color}`}>{meta.icon}</span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{meta.label}</p>
              <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">
                {engagement.vendorId?.name || 'Unknown vendor'}
              </h3>
            </div>
          </div>
          {isCancelled ? (
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--error)] bg-[var(--error)]/10 px-2 py-0.5 rounded-md">
              Cancelled
            </span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded-md">
              {STATUS_LABELS[engagement.status]}
            </span>
          )}
        </div>

        {/* Status timeline */}
        {!isCancelled && <StatusTimeline status={engagement.status} />}

        {/* Quick facts */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <Fact icon={<IndianRupee size={11} />} label="Quote" value={fmtINR(engagement.amount)} />
          <Fact
            icon={<FileText size={11} />}
            label="Quote File"
            value={
              engagement.quotationUrl ? (
                <a href={engagement.quotationUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[var(--primary)] hover:underline">
                  View
                </a>
              ) : '—'
            }
          />
          <Fact
            icon={<CheckCircle2 size={11} />}
            label="Client Approval"
            value={
              ['client_approved', 'po_emitted', 'delivered', 'site_received'].includes(engagement.status)
                ? <span className="text-[var(--success)] font-bold">Obtained</span>
                : <span className="text-[var(--warning)] font-bold">Pending</span>
            }
          />
          <Fact
            icon={<ShoppingBag size={11} />}
            label="PO"
            value={engagement.poId?.poNumber || (engagement.poId ? 'Emitted' : '—')}
          />
        </div>

        {/* WhatsApp group */}
        {engagement.whatsappGroupId && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2">
            <MessageCircle size={12} className="text-[var(--success)]" />
            <span className="font-semibold truncate">
              {engagement.whatsappGroupId.groupName || 'Per-vendor WhatsApp group created'}
            </span>
            {engagement.whatsappGroupId.syncStatus && (
              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] ml-auto shrink-0">
                {engagement.whatsappGroupId.syncStatus}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        {!isCancelled && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
            {engagement.status === 'requested' && (
              <Button size="sm" onClick={() => setQuoteOpen(true)}>
                <FileText size={13} className="mr-1.5" /> Record Quote
              </Button>
            )}
            {engagement.status === 'quoted' && (
              <Button size="sm" onClick={handleClientApproval} disabled={submitting}>
                <CheckCircle2 size={13} className="mr-1.5" /> Mark Client Approved
              </Button>
            )}
            {engagement.status === 'client_approved' && hasPermission('purchase_orders.create') && (
              <Button size="sm" onClick={() => setPOOpen(true)}>
                <ShoppingBag size={13} className="mr-1.5" /> Emit PO
              </Button>
            )}
            {engagement.status === 'po_emitted' && (
              <Button size="sm" variant="outline" onClick={handleMarkDelivered} disabled={submitting}>
                <Truck size={13} className="mr-1.5" /> Mark Delivered
              </Button>
            )}
            {engagement.status === 'delivered' && (
              <Button size="sm" variant="outline" onClick={handleMarkSiteReceived} disabled={submitting}>
                <MapPin size={13} className="mr-1.5" /> Site Received
              </Button>
            )}
          </div>
        )}
      </div>

      <QuoteModal engagement={engagement} isOpen={quoteOpen} onClose={() => setQuoteOpen(false)} onSaved={onRefresh} />
      <EmitPOModal engagement={engagement} isOpen={poOpen} onClose={() => setPOOpen(false)} onSaved={onRefresh} />
    </>
  );
};

const Fact = ({ icon, label, value }) => (
  <div>
    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-1">
      {icon} {label}
    </p>
    <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">{value}</p>
  </div>
);

const VendorEngagementTab = ({ project }) => {
  const projectId = project?._id;
  const { engagements, isLoading, error, refresh } = useVendorEngagements(projectId);
  const [createOpen, setCreateOpen] = useState(false);
  const { hasPermission } = useAuth();

  const canCreate = hasPermission('vendor.update');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--text-muted)]">
          Per-vendor workflows. PO emission requires Client Approval.
        </p>
        {canCreate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={13} className="mr-1.5" /> New Engagement
          </Button>
        )}
      </div>

      {isLoading && engagements.length === 0 && (
        <p className="text-center text-sm text-[var(--text-muted)] py-8">Loading engagements…</p>
      )}

      {error && (
        <div className="bg-[var(--error)]/8 border border-[var(--error)]/20 rounded-2xl p-4 text-sm text-[var(--error)]">
          <AlertTriangle size={14} className="inline mr-2" />
          {error}
        </div>
      )}

      {engagements.length === 0 && !isLoading && !error && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 text-center">
          <p className="text-sm text-[var(--text-muted)] mb-2">No vendor engagements yet.</p>
          <p className="text-xs text-[var(--text-muted)]">
            Open one for AC, Automation, or Kitchen Outsourced to spawn a per-vendor WhatsApp group.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {engagements.map((e) => (
          <EngagementCard key={e._id} engagement={e} onRefresh={refresh} />
        ))}
      </div>

      <CreateVendorEngagementModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={projectId}
        onCreated={refresh}
      />
    </div>
  );
};

export default VendorEngagementTab;
