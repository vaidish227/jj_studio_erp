import React, { useState, useEffect } from 'react';
import { Wind, Cpu, ChefHat } from 'lucide-react';
import { Modal, Button, FormField, Select, Input } from '../../../shared/components';
import { useToast } from '../../../shared/notifications/ToastProvider';
import { pmsService } from '../../../shared/services/pmsService';

const KIND_OPTIONS = [
  { value: '',           label: 'Select vendor kind…' },
  { value: 'ac',         label: 'AC Coordination' },
  { value: 'automation', label: 'Automation' },
  { value: 'kitchen',    label: 'Kitchen (Outsourced)' },
];

const CreateVendorEngagementModal = ({ isOpen, onClose, projectId, onCreated }) => {
  const toast = useToast();
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [form, setForm] = useState({ vendorKind: '', vendorId: '', notes: '', createWhatsAppGroup: true });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setVendorsLoading(true);
    pmsService.getVendors()
      .then((res) => setVendors(res.vendors || res.data?.vendors || []))
      .catch(() => {})
      .finally(() => setVendorsLoading(false));
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!form.vendorKind || !form.vendorId) {
      toast.error('Vendor kind and vendor are required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await pmsService.createVendorEngagement({
        projectId,
        vendorKind: form.vendorKind,
        vendorId: form.vendorId,
        notes: form.notes,
        createWhatsAppGroup: form.createWhatsAppGroup,
      });
      toast.success('Engagement opened');
      onCreated?.(res.engagement);
      onClose();
      setForm({ vendorKind: '', vendorId: '', notes: '', createWhatsAppGroup: true });
    } catch (err) {
      toast.error(err?.message || 'Failed to create engagement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Open Vendor Engagement" className="max-w-lg">
      <div className="space-y-4">
        <FormField label="Vendor Kind" required>
          <Select
            value={form.vendorKind}
            onChange={(value) => setForm((s) => ({ ...s, vendorKind: value }))}
            options={KIND_OPTIONS}
          />
        </FormField>
        <FormField label="Vendor" required>
          {vendorsLoading ? (
            <div className="px-3 py-2 text-sm text-[var(--text-muted)] border border-[var(--border)] rounded-xl bg-[var(--bg)]">
              Loading vendors…
            </div>
          ) : (
            <Select
              value={form.vendorId}
              onChange={(value) => setForm((s) => ({ ...s, vendorId: value }))}
              options={[
                { value: '', label: 'Select vendor…' },
                ...vendors.map((v) => ({ value: v._id, label: `${v.name} (${v.category || '-'})` })),
              ]}
            />
          )}
        </FormField>
        <FormField label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
            rows={2}
            placeholder="Anything the engagement should know about…"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]
                       text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30
                       focus:border-[var(--primary)] resize-none"
          />
        </FormField>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.createWhatsAppGroup}
            onChange={(e) => setForm((s) => ({ ...s, createWhatsAppGroup: e.target.checked }))}
            className="w-4 h-4 accent-[var(--primary)]"
          />
          <span className="text-sm text-[var(--text-primary)]">
            Auto-create per-vendor WhatsApp group (Designer + Principal + Client + Vendor + Supervisor)
          </span>
        </label>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={submitting}>Open Engagement</Button>
        </div>
      </div>
    </Modal>
  );
};

export default CreateVendorEngagementModal;
