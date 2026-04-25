import React, { useState } from 'react';
import { X } from 'lucide-react';
import Input from '../../../shared/components/Input/Input';
import Button from '../../../shared/components/Button/Button';
import FormField from '../../../shared/components/FormField/FormField';
import Select from '../../../shared/components/Select/Select';
import { Phone, MapPin, User, FileText } from 'lucide-react';

const PRIORITY_OPTIONS = [
  { value: 'high',   label: 'High Priority' },
  { value: 'medium', label: 'Medium Priority' },
  { value: 'low',    label: 'Low Priority' },
];

const initialForm = { name: '', phone: '', city: '', project: '', priority: 'medium' };

const AddLeadModal = ({ isOpen, onClose, onSubmit }) => {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const set = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())    e.name    = 'Name is required.';
    if (!form.phone.trim())   e.phone   = 'Phone number is required.';
    if (!form.city.trim())    e.city    = 'City is required.';
    if (!form.project.trim()) e.project = 'Project requirement is required.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setIsLoading(true);
    await onSubmit?.({ ...form, status: 'NEW', date: new Date().toLocaleDateString('en-US') });
    setIsLoading(false);
    setForm(initialForm);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="
        fixed inset-0 z-50 flex items-center justify-center p-4
        pointer-events-none
      ">
        <div className="
          w-full max-w-lg bg-[var(--surface)] rounded-2xl shadow-2xl
          pointer-events-auto max-h-[90vh] overflow-y-auto
        ">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[var(--border)]">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Add New Lead</h2>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">Fill in the lead details below</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-[var(--bg)] text-[var(--text-muted)] transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <FormField label="Full Name" error={errors.name}>
              <Input
                icon={User}
                placeholder="e.g. Raj Patel"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                error={errors.name}
              />
            </FormField>

            <FormField label="Phone Number" error={errors.phone}>
              <Input
                icon={Phone}
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                error={errors.phone}
              />
            </FormField>

            <FormField label="City" error={errors.city}>
              <Input
                icon={MapPin}
                placeholder="e.g. Mumbai"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                error={errors.city}
              />
            </FormField>

            <FormField label="Project Requirement" error={errors.project}>
              <div className="relative group">
                <FileText
                  size={18}
                  className="absolute left-4 top-3.5 text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors"
                />
                <textarea
                  rows={3}
                  placeholder="e.g. Living Room Renovation - Modern Design"
                  value={form.project}
                  onChange={(e) => set('project', e.target.value)}
                  className={`
                    w-full pl-11 pr-4 py-3 text-sm rounded-xl border
                    bg-[var(--surface)] resize-none transition-all duration-200
                    placeholder:text-[var(--text-muted)] text-[var(--text-primary)]
                    focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]
                    ${errors.project ? 'border-[var(--error)]' : 'border-[var(--border)]'}
                  `}
                />
              </div>
              {errors.project && (
                <p className="text-xs text-[var(--error)] font-medium mt-1 ml-0.5">{errors.project}</p>
              )}
            </FormField>

            <Select
              label="Priority"
              value={form.priority}
              onChange={(val) => set('priority', val)}
              options={PRIORITY_OPTIONS}
            />

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isLoading} className="flex-1">
                Add Lead
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default AddLeadModal;
