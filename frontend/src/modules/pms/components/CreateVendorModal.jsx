import React, { useState, useEffect } from 'react';
import { Modal, Button, FormField, Input, Select } from '../../../shared/components';
import { pmsService } from '../../../shared/services/pmsService';
import { useToast } from '../../../shared/notifications/ToastProvider';

const CATEGORIES = [
  { value: '',            label: 'Select category...' },
  { value: 'AC',          label: 'AC' },
  { value: 'Automation',  label: 'Automation' },
  { value: 'Kitchen',     label: 'Kitchen' },
  { value: 'Carpentry',   label: 'Carpentry' },
  { value: 'Electrical',  label: 'Electrical' },
  { value: 'Plumbing',    label: 'Plumbing' },
  { value: 'Other',       label: 'Other' },
];

const INITIAL = {
  name: '', category: '', contactPerson: '',
  phone: '', email: '', address: '', notes: '',
};

const CreateVendorModal = ({ isOpen, onClose, editVendor = null, onSaved }) => {
  const toast = useToast();
  const [form, setForm]             = useState(INITIAL);
  const [errors, setErrors]         = useState({});
  const [isSubmitting, setSubmitting] = useState(false);

  const isEdit = !!editVendor;

  useEffect(() => {
    if (editVendor) {
      setForm({
        name:          editVendor.name          || '',
        category:      editVendor.category      || '',
        contactPerson: editVendor.contactPerson || '',
        phone:         editVendor.phone         || '',
        email:         editVendor.email         || '',
        address:       editVendor.address       || '',
        notes:         editVendor.notes         || '',
      });
    } else {
      setForm(INITIAL);
    }
    setErrors({});
  }, [editVendor, isOpen]);

  const set = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())     e.name     = 'Name is required';
    if (!form.category)        e.category = 'Category is required';
    if (!form.phone.trim())    e.phone    = 'Phone is required';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSubmitting(true);
    try {
      if (isEdit) {
        await pmsService.updateVendor(editVendor._id, form);
        toast.success('Vendor updated');
      } else {
        await pmsService.createVendor(form);
        toast.success(`Vendor "${form.name}" added`);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err || 'Failed to save vendor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => { setForm(INITIAL); setErrors({}); onClose(); };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={isEdit ? 'Edit Vendor' : 'Add Vendor'}>
      <div className="space-y-4">

        <FormField label="Vendor Name" error={errors.name} required>
          <Input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. CoolTech HVAC Services"
          />
        </FormField>

        <FormField label="Category" error={errors.category} required>
          <Select
            value={form.category}
            onChange={(val) => set('category', val)}
            options={CATEGORIES}
          />
        </FormField>

        <FormField label="Contact Person">
          <Input
            value={form.contactPerson}
            onChange={(e) => set('contactPerson', e.target.value)}
            placeholder="Rajesh Kumar"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Phone" error={errors.phone} required>
            <Input
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+91 98765 43210"
            />
          </FormField>
          <FormField label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="vendor@company.com"
            />
          </FormField>
        </div>

        <FormField label="Address">
          <Input
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="Office / warehouse address"
          />
        </FormField>

        <FormField label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            placeholder="Specialties, past work, availability..."
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]
                       text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30
                       focus:border-[var(--primary)] resize-none transition-colors"
          />
        </FormField>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Add Vendor'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CreateVendorModal;
